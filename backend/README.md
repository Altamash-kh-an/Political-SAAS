# Backend setup

The API uses PostgreSQL. Configure `DATABASE_URL` and a cryptographically random,
URL-safe Base64 `JWT_SECRET_KEY` in `backend/.env` before starting the API. Do not
put either value in frontend code or commit `backend/.env`.

Check the existing database before applying migrations: the repository's
`20261014_01` migration assumes that a `users` table already exists. The
constituency-record migration extends that history and is not a baseline for a
fresh database. Do not run the migration command below on an uninitialized
database until its `users` schema and Alembic revision have been confirmed.

After confirming that prerequisite, apply migrations from the `backend` directory:

```powershell
python -m alembic upgrade head
```

The constituency-record migration creates empty Panchayat, Booth, and Voter
tables. Panchayats store a unique name; Booths store a number, name, and address
and reference one Panchayat; Voters store a name and unique electoral-roll ID
and reference one Booth. A parent record cannot be deleted while it has
dependent records. No sample records are seeded.

Provision the first Admin interactively from the `backend` directory after the
migrations have completed:

```powershell
python create_admin.py
```

The password is entered without echoing, only its hash is stored, and this
one-time setup command refuses to run if an Admin already exists. Public
registration continues to create Field Worker accounts only.

To reset the password for an existing Admin, run this separate interactive
utility from the `backend` directory:

```powershell
python reset_admin_password.py
```

It requires the existing database configuration, prompts for the Admin email
and a hidden password/confirmation, then requires typing `RESET` before saving.
It only updates the password hash of a user whose role is exactly `admin`;
it never creates a user or changes a role. Public registration remains
Field Worker-only.
