import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


migration_path = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20261018_03_add_block_hierarchy.py"
)
migration_spec = importlib.util.spec_from_file_location(
    "block_hierarchy_migration", migration_path
)
if migration_spec is None or migration_spec.loader is None:
    raise RuntimeError("Unable to load the Block hierarchy migration for testing")
migration = importlib.util.module_from_spec(migration_spec)
migration_spec.loader.exec_module(migration)


class FakeResult:
    def __init__(self, scalar_value=None, rows=()):
        self.scalar_value = scalar_value
        self.rows = rows

    def scalar_one(self):
        return self.scalar_value

    def all(self):
        return self.rows


class FakeConnection:
    def __init__(self, assigned_count, rows):
        self.assigned_count = assigned_count
        self.rows = rows

    def execute(self, statement):
        statement_text = str(statement)
        if "count(*)" in statement_text:
            return FakeResult(scalar_value=self.assigned_count)
        if "SELECT id, name, parent_id FROM blocks" in statement_text:
            return FakeResult(rows=self.rows)
        raise AssertionError(f"Unexpected migration query: {statement_text}")


class FakeOperations:
    def __init__(self, connection):
        self.connection = connection
        self.dropped = []

    def get_bind(self):
        return self.connection

    def drop_constraint(self, *args, **kwargs):
        self.dropped.append(("constraint", args, kwargs))

    def drop_index(self, *args, **kwargs):
        self.dropped.append(("index", args, kwargs))

    def drop_column(self, *args, **kwargs):
        self.dropped.append(("column", args, kwargs))

    def drop_table(self, *args, **kwargs):
        self.dropped.append(("table", args, kwargs))


class BlockMigrationTests(unittest.TestCase):
    def test_downgrade_refuses_to_drop_assigned_panchayats(self):
        operations = FakeOperations(FakeConnection(1, ()))
        with patch.object(migration, "op", operations):
            with self.assertRaisesRegex(RuntimeError, "Panchayats are assigned"):
                migration.downgrade()
        self.assertEqual(operations.dropped, [])

    def test_downgrade_refuses_modified_or_additional_blocks(self):
        rows = [
            (1, "Nathnagar Block", None),
            (2, "Nathnagar", 1),
            (3, "Jagdishpur", 1),
            (4, "Sabour", 1),
            (5, "Additional Block", 1),
        ]
        operations = FakeOperations(FakeConnection(0, rows))
        with patch.object(migration, "op", operations):
            with self.assertRaisesRegex(RuntimeError, "seeded records changed"):
                migration.downgrade()
        self.assertEqual(operations.dropped, [])

    def test_downgrade_drops_only_the_unassigned_seed_hierarchy(self):
        rows = [
            (1, "Nathnagar Block", None),
            (2, "Nathnagar", 1),
            (3, "Jagdishpur", 1),
            (4, "Sabour", 1),
        ]
        operations = FakeOperations(FakeConnection(0, rows))
        with patch.object(migration, "op", operations):
            migration.downgrade()

        self.assertEqual(
            [operation[0] for operation in operations.dropped],
            ["constraint", "index", "column", "index", "table"],
        )


if __name__ == "__main__":
    unittest.main()
