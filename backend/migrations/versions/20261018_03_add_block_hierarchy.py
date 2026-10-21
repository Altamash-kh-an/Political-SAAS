"""Add the Nathnagar Block hierarchy and optional Panchayat assignment.

Revision ID: 20261018_03
Revises: 20261015_02
Create Date: 2026-10-18
"""
from alembic import op
import sqlalchemy as sa


revision = "20261018_03"
down_revision = "20261015_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    blocks = op.create_table(
        "blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False, unique=True),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("blocks.id", name="fk_blocks_parent_id_blocks", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_blocks_parent_id", "blocks", ["parent_id"])

    connection = op.get_bind()
    connection.execute(
        sa.insert(blocks).values(name="Nathnagar Block", parent_id=None)
    )
    for name in ("Nathnagar", "Jagdishpur", "Sabour"):
        connection.execute(
            sa.insert(blocks).values(
                name=name,
                parent_id=sa.select(blocks.c.id)
                .where(blocks.c.name == "Nathnagar Block")
                .scalar_subquery(),
            )
        )

    op.add_column(
        "panchayats",
        sa.Column("block_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_panchayats_block_id", "panchayats", ["block_id"])
    op.create_foreign_key(
        "fk_panchayats_block_id_blocks",
        "panchayats",
        "blocks",
        ["block_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    connection = op.get_bind()
    assigned_count = connection.execute(
        sa.text("SELECT count(*) FROM panchayats WHERE block_id IS NOT NULL")
    ).scalar_one()
    if assigned_count:
        raise RuntimeError(
            "Cannot remove the Block hierarchy while Panchayats are assigned to "
            "Blocks. Unassign them in a separately reviewed operation first."
        )

    rows = connection.execute(
        sa.text("SELECT id, name, parent_id FROM blocks")
    ).all()
    blocks_by_name = {
        name: (block_id, parent_id) for block_id, name, parent_id in rows
    }
    expected_names = {
        "Nathnagar Block",
        "Nathnagar",
        "Jagdishpur",
        "Sabour",
    }
    parent = blocks_by_name.get("Nathnagar Block")
    parent_id = parent[0] if parent else None
    if (
        len(rows) != len(expected_names)
        or set(blocks_by_name) != expected_names
        or parent_id is None
        or any(
            blocks_by_name[name][1] != parent_id
            for name in ("Nathnagar", "Jagdishpur", "Sabour")
        )
        or parent[1] is not None
    ):
        raise RuntimeError(
            "Cannot remove the Block hierarchy because its seeded records changed "
            "or additional Block records exist."
        )

    op.drop_constraint(
        "fk_panchayats_block_id_blocks", "panchayats", type_="foreignkey"
    )
    op.drop_index("ix_panchayats_block_id", table_name="panchayats")
    op.drop_column("panchayats", "block_id")
    op.drop_index("ix_blocks_parent_id", table_name="blocks")
    op.drop_table("blocks")
