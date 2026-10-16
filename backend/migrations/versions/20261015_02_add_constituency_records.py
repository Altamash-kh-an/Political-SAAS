"""Add Panchayat, Booth, and Voter records.

Revision ID: 20261015_02
Revises: 20261014_01
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa

revision = "20261015_02"
down_revision = "20261014_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "panchayats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_table(
        "booths",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "panchayat_id",
            sa.Integer(),
            sa.ForeignKey("panchayats.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("booth_number", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "panchayat_id", "booth_number", name="uq_booths_panchayat_number"
        ),
    )
    op.create_index("ix_booths_panchayat_id", "booths", ["panchayat_id"])
    op.create_table(
        "voters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "booth_id",
            sa.Integer(),
            sa.ForeignKey("booths.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("electoral_roll_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_voters_booth_id", "voters", ["booth_id"])


def downgrade() -> None:
    raise RuntimeError(
        "This migration creates tables that can contain constituency data. "
        "Dropping them would delete records and requires a separately reviewed migration."
    )
