import asyncio
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

import main


async def reset_admin_password(email: str, new_password: str) -> None:
    if not 8 <= len(new_password) <= 128:
        raise ValueError("Password must be between 8 and 128 characters.")

    async with main.async_session_maker() as session:
        admin = await session.scalar(
            select(main.User)
            .where(main.User.email == email, main.User.role == "admin")
            .with_for_update()
        )
        if admin is None:
            raise RuntimeError("No Admin account matches that email.")

        admin.password_hash = main.password_hasher.hash(new_password)
        try:
            await session.commit()
        except SQLAlchemyError as exc:
            await session.rollback()
            raise RuntimeError("Unable to save the Admin password change.") from exc


def main_cli() -> None:
    try:
        raw_email = input("Admin email: ").strip()
        try:
            email = str(TypeAdapter(EmailStr).validate_python(raw_email)).lower()
        except ValidationError:
            raise SystemExit("Enter a valid email address.") from None

        password = getpass("New Admin password (8-128 characters): ")
        confirmation = getpass("Confirm new password: ")
        if not 8 <= len(password) <= 128:
            raise SystemExit("Password must be between 8 and 128 characters.")
        if password != confirmation:
            raise SystemExit("Passwords do not match.")

        confirmation_phrase = input(
            "This will replace the password for the matching Admin account. "
            "Type RESET to continue: "
        )
        if confirmation_phrase != "RESET":
            raise SystemExit("Password reset cancelled.")

        asyncio.run(reset_admin_password(email, password))
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc
    except SQLAlchemyError:
        raise SystemExit("Database operation failed; no password reset was made.") from None
    finally:
        asyncio.run(main.engine.dispose())

    print("Admin password updated.")


if __name__ == "__main__":
    main_cli()
