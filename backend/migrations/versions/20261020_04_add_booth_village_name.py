"""Add an optional village name to booths.

Revision ID: 20261020_04
Revises: 20261018_03
Create Date: 2026-10-20
"""
from alembic import op
import sqlalchemy as sa


revision = "20261020_04"
down_revision = "20261018_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booths",
        sa.Column("village_name", sa.String(length=150), nullable=True),
    )


def downgrade() -> None:
    connection = op.get_bind()
    village_count = connection.execute(
        sa.text("SELECT count(*) FROM booths WHERE village_name IS NOT NULL")
    ).scalar_one()
    if village_count:
        raise RuntimeError(
            "Cannot remove village_name while Booth records contain village data."
        )
    op.drop_column("booths", "village_name")
