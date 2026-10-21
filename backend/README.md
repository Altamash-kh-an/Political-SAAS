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
dependent records. No sample Panchayat, Booth, or Voter records are seeded.

The `20261018_03` migration adds a Block hierarchy with `Nathnagar Block` as the
parent of `Nathnagar`, `Jagdishpur`, and `Sabour`. Panchayats gain a nullable
Block reference. Existing Panchayats are intentionally left unassigned; assign
them only after their correct Block is verified. Booth and Voter responses
derive Block information through their existing Panchayat and Booth references.
The downgrade refuses to proceed if any Panchayat is assigned or the seeded
Block rows have changed or been extended, preventing removal of user data.

The Admin Booth Management page supports previewing `.xlsx` and UTF-8 `.csv`
files with the `booth_number`, `polling_station_name`,
`polling_station_address`, `block_name`, `village_name`, and `panchayat_name`
columns. Names are matched to existing Blocks/Panchayats after trimming and
case-folding, and each Panchayat must already be assigned to the named Block.
The preview also checks booth-number conflicts; it does not create or update
Blocks or Panchayats. Only an explicit confirmation imports the entire valid
batch in one transaction. Files are limited to 10 MB and 5,000 data rows.

The Booth API/model now includes nullable `village_name`, which requires the
`20261020_04` migration. Apply that migration only after verifying the database
revision and its prerequisite Block hierarchy migration. Do not enable the
updated API against a database that has not applied this column migration.

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
