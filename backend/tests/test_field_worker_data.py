import os
import secrets
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost/test"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)

import jwt
from fastapi.testclient import TestClient

import main


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, user, panchayats, booths, voters, blocks):
        self.user = user
        self.panchayats = panchayats
        self.booths = booths
        self.voters = voters
        self.blocks = blocks

    def block_context(self, panchayat):
        block = next(
            (item for item in self.blocks if item.id == panchayat.block_id), None
        )
        parent = next(
            (item for item in self.blocks if block and item.id == block.parent_id),
            None,
        )
        return block, parent

    async def get(self, model, record_id):
        if model is main.User and self.user.id == record_id:
            return self.user
        return next(
            (
                record
                for record in self.blocks
                if model is main.Block and record.id == record_id
            ),
            None,
        )

    async def scalars(self, _statement):
        return FakeResult(self.blocks)

    async def execute(self, statement):
        statement_text = str(statement)
        if "FROM panchayats" in statement_text:
            rows = [
                (panchayat, *self.block_context(panchayat))
                for panchayat in self.panchayats
            ]
        elif "FROM booths" in statement_text:
            rows = [
                (booth, panchayat.name, *self.block_context(panchayat))
                for booth in self.booths
                for panchayat in self.panchayats
                if panchayat.id == booth.panchayat_id
            ]
        else:
            rows = [
                (
                    voter,
                    booth.booth_number,
                    booth.name,
                    panchayat.name,
                    *self.block_context(panchayat),
                )
                for voter in self.voters
                for booth in self.booths
                if booth.id == voter.booth_id
                for panchayat in self.panchayats
                if panchayat.id == booth.panchayat_id
            ]
        return FakeResult(rows)


class FieldWorkerDataTests(unittest.TestCase):
    def setUp(self):
        self.user = main.User(
            id=10,
            email="worker@example.com",
            role="field_worker",
            password_hash="unused",
        )
        timestamp = datetime.now(timezone.utc)
        self.panchayat = main.Panchayat(
            id=2, name="North Panchayat", block_id=3, created_at=timestamp
        )
        self.blocks = [
            main.Block(id=1, name="Nathnagar Block", created_at=timestamp),
            main.Block(
                id=2, name="Nathnagar", parent_id=1, created_at=timestamp
            ),
            main.Block(id=3, name="Sabour", parent_id=1, created_at=timestamp),
            main.Block(
                id=4, name="Jagdishpur", parent_id=1, created_at=timestamp
            ),
        ]
        self.booth = main.Booth(
            id=4,
            panchayat_id=2,
            booth_number="001",
            name="Central Polling Station",
            address="Main Road",
            created_at=timestamp,
        )
        self.voter = main.Voter(
            id=5,
            booth_id=4,
            electoral_roll_id="AB-123",
            name="A Voter",
            created_at=timestamp,
        )
        self.session = FakeSession(
            self.user, [self.panchayat], [self.booth], [self.voter], self.blocks
        )

        async def override_db():
            yield self.session

        main.app.app.dependency_overrides[main.get_db] = override_db
        self.client = TestClient(main.app)

    def tearDown(self):
        main.app.app.dependency_overrides.clear()
        self.client.close()

    def worker_token(self):
        now = datetime.now(timezone.utc)
        return jwt.encode(
            {
                "sub": str(self.user.id),
                "iat": now,
                "exp": now.replace(year=now.year + 1),
            },
            main.jwt_secret_key,
            algorithm="HS256",
        )

    def test_field_worker_can_read_admin_managed_records(self):
        headers = {"Authorization": f"Bearer {self.worker_token()}"}
        for path in ("/workspace/panchayats", "/workspace/booths", "/workspace/voters"):
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.json()), 1)

        self.assertEqual(
            self.client.get("/workspace/panchayats", headers=headers).json()[0]["name"],
            "North Panchayat",
        )
        panchayat_response = self.client.get(
            "/workspace/panchayats", headers=headers
        ).json()[0]
        self.assertEqual(panchayat_response["block_name"], "Sabour")
        self.assertEqual(panchayat_response["parent_block_name"], "Nathnagar Block")
        booth_response = self.client.get("/workspace/booths", headers=headers).json()[0]
        self.assertEqual(booth_response["panchayat_name"], "North Panchayat")
        self.assertEqual(booth_response["block_name"], "Sabour")
        voter_response = self.client.get("/workspace/voters", headers=headers).json()[0]
        self.assertEqual(voter_response["booth_id"], 4)
        self.assertEqual(voter_response["electoral_roll_id"], "AB-123")
        self.assertEqual(voter_response["parent_block_name"], "Nathnagar Block")

        blocks_response = self.client.get("/workspace/blocks", headers=headers)
        self.assertEqual(blocks_response.status_code, 200)
        self.assertEqual(
            {block["name"] for block in blocks_response.json()},
            {"Nathnagar Block", "Nathnagar", "Jagdishpur", "Sabour"},
        )

    def test_existing_unassigned_panchayat_remains_readable(self):
        self.panchayat.block_id = None
        headers = {"Authorization": f"Bearer {self.worker_token()}"}

        response = self.client.get("/workspace/panchayats", headers=headers)

        self.assertEqual(response.status_code, 200)
        record = response.json()[0]
        self.assertEqual(record["name"], "North Panchayat")
        self.assertIsNone(record["block_id"])
        self.assertIsNone(record["block_name"])
        self.assertIsNone(record["parent_block_id"])
        self.assertIsNone(record["parent_block_name"])

    def test_field_worker_reads_are_authenticated_and_admin_writes_remain_forbidden(self):
        self.assertEqual(self.client.get("/workspace/panchayats").status_code, 401)
        self.assertEqual(self.client.get("/workspace/blocks").status_code, 401)
        headers = {"Authorization": f"Bearer {self.worker_token()}"}
        self.assertEqual(self.client.get("/admin/panchayats", headers=headers).status_code, 403)
        self.assertEqual(self.client.get("/admin/blocks", headers=headers).status_code, 403)
        self.assertEqual(
            self.client.post(
                "/admin/panchayats",
                headers=headers,
                json={"name": "Not Allowed"},
            ).status_code,
            403,
        )

    def test_empty_database_returns_empty_record_lists(self):
        self.session.panchayats = []
        self.session.booths = []
        self.session.voters = []
        headers = {"Authorization": f"Bearer {self.worker_token()}"}

        for path in ("/workspace/panchayats", "/workspace/booths", "/workspace/voters"):
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [])


if __name__ == "__main__":
    unittest.main()
