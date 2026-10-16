import asyncio
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

import main


async def create_initial_admin(email: str, full_name: str, password: str) -> None:
    async with main.async_session_maker() as session:
        await session.execute(text("LOCK TABLE users IN EXCLUSIVE MODE"))
        existing_admin_count = await session.scalar(
            select(func.count(main.User.id)).where(main.User.role == "admin")
        )
        if existing_admin_count:
            raise RuntimeError(
                "An Admin account already exists; initial provisioning is disabled."
            )

        existing_user_id = await session.scalar(
            select(main.User.id).where(main.User.email == email)
        )
        if existing_user_id is not None:
            raise RuntimeError("That email is already registered.")

        admin = main.User(
            email=email,
            password_hash=main.password_hasher.hash(password),
            role="admin",
            full_name=full_name or None,
        )
        session.add(admin)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise RuntimeError(
                "Could not provision the Admin account; verify that the email is unused."
            ) from exc


def main_cli() -> None:
    raw_email = input("Admin email: ").strip()
    try:
        email = str(TypeAdapter(EmailStr).validate_python(raw_email)).lower()
    except ValidationError:
        raise SystemExit("Enter a valid email address.") from None

    full_name = input("Admin name (optional): ").strip()
    if len(full_name) > 150:
        raise SystemExit("Admin name must be 150 characters or fewer.")

    password = getpass("Admin password (8-128 characters): ")
    confirmation = getpass("Confirm password: ")
    if not 8 <= len(password) <= 128:
        raise SystemExit("Password must be between 8 and 128 characters.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    try:
        asyncio.run(create_initial_admin(email, full_name, password))
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc
    finally:
        asyncio.run(main.engine.dispose())

    print("Initial Admin account created. No constituency records were added.")


if __name__ == "__main__":
    main_cli()
