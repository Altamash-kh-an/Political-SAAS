"""Add optional profile columns to existing users.

Revision ID: 20261014_01
Revises:
Create Date: 2026-10-14
"""
from alembic import op
import sqlalchemy as sa

revision = "20261014_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=150), nullable=True))
    op.add_column("users", sa.Column("mobile_number", sa.String(length=13), nullable=True))
    op.add_column("users", sa.Column("father_name", sa.String(length=150), nullable=True))
    op.add_column("users", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("qualification", sa.String(length=150), nullable=True))
    op.add_column("users", sa.Column("nearby_location", sa.String(length=255), nullable=True))


def downgrade() -> None:
    raise RuntimeError(
        "This migration adds profile data columns. Downgrading would delete profile "
        "data and requires a separately reviewed, explicitly approved migration."
    )
