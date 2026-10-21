import os
import secrets
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost/test"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from starlette.requests import Request

import main


class FakeSession:
    def __init__(self, records=None, scalar_value=0, query_rows=None):
        self.records = records or {}
        self.scalar_value = scalar_value
        self.query_rows = query_rows or []
        self.added = None
        self.deleted = None
        self.statement = None
        self.committed = False
        self.rolled_back = False

    async def get(self, model, record_id):
        return self.records.get((model, record_id))

    async def scalar(self, _statement):
        return self.scalar_value

    async def scalars(self, _statement):
        return self

    async def execute(self, statement):
        self.statement = statement
        return self

    def all(self):
        return self.query_rows

    def add(self, record):
        self.added = record

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, record):
        record.id = record.id or 1
        record.created_at = datetime.now(timezone.utc)

    async def delete(self, record):
        self.deleted = record


class AdminDataTests(unittest.IsolatedAsyncioTestCase):
    def make_user(self, role):
        return main.User(
            email="user@example.com",
            role=role,
            password_hash="unused-hash",
        )

    async def test_admin_dependency_rejects_field_workers(self):
        with self.assertRaises(HTTPException) as raised:
            await main.get_admin_user(self.make_user("field_worker"))
        self.assertEqual(raised.exception.status_code, 403)

    async def test_admin_dependency_accepts_admins(self):
        user = self.make_user("admin")
        self.assertIs(await main.get_admin_user(user), user)

    async def test_database_errors_are_logged_and_return_a_useful_response(self):
        request = Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/admin/voters",
                "headers": [],
            }
        )
        with self.assertLogs(main.logger, level="ERROR") as captured:
            try:
                raise SQLAlchemyError("database detail")
            except SQLAlchemyError as error:
                response = await main.handle_database_error(request, error)

        self.assertEqual(response.status_code, 500)
        self.assertIn("Database request failed for /admin/voters", captured.output[0])
        self.assertNotIn("database detail", response.body.decode())

    def test_management_schemas_strip_values_and_normalize_roll_id(self):
        panchayat = main.PanchayatCreate(name="  North Panchayat ")
        booth = main.BoothCreate(
            panchayat_id=1,
            booth_number="001",
            name="Polling Station",
            address="Main Road",
            village_name="  नया टोला ",
        )
        booth_update = main.BoothUpdate(village_name="  पुराना टोला ")
        voter = main.VoterCreate(
            booth_id=1,
            electoral_roll_id=" ab-123 ",
            name="  A Voter ",
        )
        self.assertEqual(panchayat.name, "North Panchayat")
        self.assertEqual(booth.village_name, "नया टोला")
        self.assertEqual(booth_update.village_name, "पुराना टोला")
        self.assertEqual(voter.electoral_roll_id, "AB-123")
        self.assertEqual(voter.name, "A Voter")

    def test_management_schemas_reject_empty_values_and_invalid_ids(self):
        with self.assertRaises(ValidationError):
            main.PanchayatCreate(name="  ")
        with self.assertRaises(ValidationError):
            main.PanchayatCreate(name="Valid Panchayat", block_id=0)
        self.assertIsNone(main.PanchayatUpdate(block_id=None).block_id)
        with self.assertRaises(ValidationError):
            main.BoothCreate(
                panchayat_id=0,
                booth_number="1",
                name="Polling Station",
                address="Main Road",
            )
        with self.assertRaises(ValidationError):
            main.VoterUpdate(name=None)
        with self.assertRaises(ValidationError):
            main.VoterCreate(booth_id=1, electoral_roll_id="A-1", name="A")

    async def test_list_voters_joins_through_booth_and_panchayat_explicitly(self):
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        parent = main.Block(id=1, name="Nathnagar Block")
        block = main.Block(id=3, name="Sabour", parent_id=1)
        booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="001",
            name="Central Polling Station",
            address="Main Road",
        )
        voter = main.Voter(
            id=5,
            booth_id=4,
            electoral_roll_id="AB-123",
            name="A Voter",
            created_at=datetime.now(timezone.utc),
        )
        session = FakeSession(
            query_rows=[
                (voter, booth.booth_number, booth.name, panchayat.name, block, parent)
            ]
        )

        result = await main.list_voters(self.make_user("admin"), session)
        statement = str(session.statement)

        self.assertIn("JOIN booths ON voters.booth_id = booths.id", statement)
        self.assertIn(
            "JOIN panchayats ON booths.panchayat_id = panchayats.id", statement
        )
        self.assertEqual(result[0].booth_id, booth.id)
        self.assertEqual(result[0].electoral_roll_id, "AB-123")
        self.assertEqual(result[0].panchayat_name, panchayat.name)
        self.assertEqual(result[0].block_name, "Sabour")
        self.assertEqual(result[0].parent_block_name, "Nathnagar Block")

    async def test_list_booths_joins_from_booths_to_panchayats_explicitly(self):
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        parent = main.Block(id=1, name="Nathnagar Block")
        block = main.Block(id=3, name="Sabour", parent_id=1)
        booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="001",
            name="Central Polling Station",
            address="Main Road",
            village_name="नया टोला",
            created_at=datetime.now(timezone.utc),
        )
        session = FakeSession(
            query_rows=[(booth, panchayat.name, block, parent)]
        )

        result = await main.list_booths(self.make_user("admin"), session)
        statement = str(session.statement)

        self.assertIn("FROM booths", statement)
        self.assertIn(
            "JOIN panchayats ON booths.panchayat_id = panchayats.id", statement
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].id, booth.id)
        self.assertEqual(result[0].village_name, "नया टोला")
        self.assertEqual(result[0].panchayat_name, panchayat.name)
        self.assertEqual(result[0].block_name, "Sabour")
        self.assertEqual(result[0].parent_block_name, "Nathnagar Block")

    async def test_create_panchayat_persists_record(self):
        session = FakeSession()
        result = await main.create_panchayat(
            main.PanchayatCreate(name="North Panchayat"),
            self.make_user("admin"),
            session,
        )
        self.assertTrue(session.committed)
        self.assertEqual(session.added.name, "North Panchayat")
        self.assertEqual(result.id, 1)
        self.assertIsNone(result.block_id)

    async def test_create_panchayat_can_be_assigned_to_a_child_block(self):
        parent = main.Block(id=1, name="Nathnagar Block")
        block = main.Block(id=3, name="Sabour", parent_id=1)
        session = FakeSession(
            records={(main.Block, 3): block, (main.Block, 1): parent}
        )

        result = await main.create_panchayat(
            main.PanchayatCreate(name="North Panchayat", block_id=3),
            self.make_user("admin"),
            session,
        )

        self.assertTrue(session.committed)
        self.assertEqual(session.added.block_id, 3)
        self.assertEqual(result.block_name, "Sabour")
        self.assertEqual(result.parent_block_name, "Nathnagar Block")

    async def test_create_panchayat_rejects_parent_area_as_assignment(self):
        parent = main.Block(id=1, name="Nathnagar Block")
        session = FakeSession(records={(main.Block, 1): parent})

        with self.assertRaises(HTTPException) as raised:
            await main.create_panchayat(
                main.PanchayatCreate(name="North Panchayat", block_id=1),
                self.make_user("admin"),
                session,
            )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIsNone(session.added)
        self.assertFalse(session.committed)

    async def test_admin_block_list_includes_parent_and_child_records(self):
        parent = main.Block(id=1, name="Nathnagar Block", parent_id=None)
        child = main.Block(id=2, name="Jagdishpur", parent_id=1)
        session = FakeSession(query_rows=[parent, child])

        result = await main.list_blocks(self.make_user("admin"), session)

        self.assertEqual([block.name for block in result], ["Nathnagar Block", "Jagdishpur"])

    async def test_create_booth_requires_existing_panchayat(self):
        session = FakeSession()
        with self.assertRaises(HTTPException) as raised:
            await main.create_booth(
                main.BoothCreate(
                    panchayat_id=12,
                    booth_number="001",
                    name="Central Polling Station",
                    address="Main Road",
                ),
                self.make_user("admin"),
                session,
            )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIsNone(session.added)

    async def test_create_booth_saves_parent_relationship(self):
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        session = FakeSession(records={(main.Panchayat, 2): panchayat})
        result = await main.create_booth(
            main.BoothCreate(
                panchayat_id=2,
                booth_number="001",
                name="Central Polling Station",
                address="Main Road",
                village_name="नया टोला",
            ),
            self.make_user("admin"),
            session,
        )
        self.assertTrue(session.committed)
        self.assertEqual(session.added.panchayat_id, 2)
        self.assertEqual(session.added.village_name, "नया टोला")
        self.assertEqual(result.village_name, "नया टोला")
        self.assertEqual(result.panchayat_name, "North Panchayat")

    async def test_create_voter_attaches_voter_to_existing_booth(self):
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="001",
            name="Central Polling Station",
            address="Main Road",
        )
        session = FakeSession(
            records={(main.Booth, 4): booth, (main.Panchayat, 2): panchayat}
        )
        result = await main.create_voter(
            main.VoterCreate(
                booth_id=4,
                electoral_roll_id="AB-123",
                name="A Voter",
            ),
            self.make_user("admin"),
            session,
        )
        self.assertTrue(session.committed)
        self.assertEqual(session.added.booth_id, 4)
        self.assertEqual(result.panchayat_name, "North Panchayat")

    async def test_update_panchayat_persists_changes(self):
        panchayat = main.Panchayat(id=2, name="Old Name")
        session = FakeSession(records={(main.Panchayat, 2): panchayat})
        result = await main.update_panchayat(
            2,
            main.PanchayatUpdate(name="New Name"),
            self.make_user("admin"),
            session,
        )
        self.assertTrue(session.committed)
        self.assertEqual(result.name, "New Name")

    async def test_update_panchayat_can_assign_and_clear_block(self):
        parent = main.Block(id=1, name="Nathnagar Block")
        block = main.Block(id=3, name="Sabour", parent_id=1)
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        session = FakeSession(
            records={
                (main.Panchayat, 2): panchayat,
                (main.Block, 3): block,
                (main.Block, 1): parent,
            }
        )

        assigned = await main.update_panchayat(
            2,
            main.PanchayatUpdate(block_id=3),
            self.make_user("admin"),
            session,
        )
        self.assertEqual(assigned.block_id, 3)
        self.assertEqual(assigned.parent_block_name, "Nathnagar Block")

        unassigned = await main.update_panchayat(
            2,
            main.PanchayatUpdate(block_id=None),
            self.make_user("admin"),
            session,
        )
        self.assertIsNone(unassigned.block_id)
        self.assertIsNone(unassigned.block_name)

    async def test_update_booth_can_reassign_parent(self):
        old_panchayat = main.Panchayat(id=2, name="North Panchayat")
        new_panchayat = main.Panchayat(id=3, name="South Panchayat")
        booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="001",
            name="Central Polling Station",
            address="Main Road",
        )
        session = FakeSession(
            records={
                (main.Booth, 4): booth,
                (main.Panchayat, 2): old_panchayat,
                (main.Panchayat, 3): new_panchayat,
            }
        )
        result = await main.update_booth(
            4,
            main.BoothUpdate(panchayat_id=3, village_name="नया टोला"),
            self.make_user("admin"),
            session,
        )
        self.assertTrue(session.committed)
        self.assertEqual(result.panchayat_id, 3)
        self.assertEqual(result.village_name, "नया टोला")
        self.assertEqual(result.panchayat_name, "South Panchayat")

        cleared = await main.update_booth(
            4,
            main.BoothUpdate(village_name=None),
            self.make_user("admin"),
            session,
        )
        self.assertIsNone(cleared.village_name)

    async def test_update_voter_can_reassign_booth(self):
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="002",
            name="Community Hall",
            address="Main Road",
        )
        voter = main.Voter(
            id=5,
            booth_id=3,
            electoral_roll_id="AB-123",
            name="A Voter",
        )
        session = FakeSession(
            records={
                (main.Voter, 5): voter,
                (main.Booth, 4): booth,
                (main.Panchayat, 2): panchayat,
            }
        )
        result = await main.update_voter(
            5,
            main.VoterUpdate(booth_id=4),
            self.make_user("admin"),
            session,
        )
        self.assertTrue(session.committed)
        self.assertEqual(result.booth_id, 4)
        self.assertEqual(result.booth_number, "002")

    async def test_leaf_records_can_be_deleted(self):
        voter = main.Voter(
            id=5,
            booth_id=4,
            electoral_roll_id="AB-123",
            name="A Voter",
        )
        session = FakeSession(records={(main.Voter, 5): voter})
        await main.delete_voter(5, self.make_user("admin"), session)
        self.assertTrue(session.committed)
        self.assertIs(session.deleted, voter)

    async def test_panchayat_with_booths_cannot_be_deleted(self):
        panchayat = main.Panchayat(id=2, name="North Panchayat")
        session = FakeSession(records={(main.Panchayat, 2): panchayat}, scalar_value=1)
        with self.assertRaises(HTTPException) as raised:
            await main.delete_panchayat(2, self.make_user("admin"), session)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIsNone(session.deleted)
        self.assertFalse(session.committed)

    async def test_booth_with_voters_cannot_be_deleted(self):
        booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="001",
            name="Central Polling Station",
            address="Main Road",
        )
        session = FakeSession(records={(main.Booth, 4): booth}, scalar_value=1)
        with self.assertRaises(HTTPException) as raised:
            await main.delete_booth(4, self.make_user("admin"), session)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIsNone(session.deleted)
        self.assertFalse(session.committed)


if __name__ == "__main__":
    unittest.main()
