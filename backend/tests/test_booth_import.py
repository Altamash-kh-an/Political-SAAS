import os
import secrets
import sys
import unittest
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:password@localhost/test"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)

from fastapi import HTTPException
from openpyxl import Workbook
from sqlalchemy.exc import IntegrityError

import main
from booth_import import BoothImportFormatError, parse_booth_import


class FakeScalars:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeImportSession:
    def __init__(self, blocks=None, panchayats=None, existing_booths=None):
        self.blocks = blocks or []
        self.panchayats = panchayats or []
        self.existing_booths = existing_booths or []
        self.added = []
        self.committed = False
        self.rolled_back = False

    async def scalars(self, statement):
        model = statement.column_descriptions[0]["entity"]
        if model is main.Block:
            return FakeScalars(self.blocks)
        if model is main.Panchayat:
            return FakeScalars(self.panchayats)
        raise AssertionError(f"Unexpected model query: {model}")

    async def execute(self, _statement):
        return FakeResult(self.existing_booths)

    def add_all(self, records):
        self.added.extend(records)

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True


def make_row(row_number=2, booth_number="001", **changes):
    row = {
        "row_number": row_number,
        "booth_number": booth_number,
        "polling_station_name": "मुख्य मतदान केंद्र",
        "polling_station_address": "मुख्य सड़क",
        "block_name": "Sabour",
        "village_name": "नया टोला",
        "panchayat_name": "North Panchayat",
    }
    row.update(changes)
    return row


class BoothImportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.block = main.Block(id=1, name="Sabour", parent_id=10)
        self.panchayat = main.Panchayat(
            id=2,
            name="North Panchayat",
            block_id=1,
        )

    def test_csv_parser_preserves_booth_number_and_hindi(self):
        contents = (
            "\ufeffbooth_number,polling_station_name,polling_station_address,"
            "block_name,village_name,panchayat_name\n"
            "001,मुख्य मतदान केंद्र,मुख्य सड़क,Sabour,नया टोला,North Panchayat\n"
        ).encode("utf-8")

        rows = parse_booth_import("booths.csv", contents)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["booth_number"], "001")
        self.assertEqual(rows[0]["polling_station_name"], "मुख्य मतदान केंद्र")
        self.assertEqual(rows[0]["village_name"], "नया टोला")

    def test_xlsx_parser_preserves_zero_format_and_hindi(self):
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append([
            "booth_number",
            "polling_station_name",
            "polling_station_address",
            "block_name",
            "village_name",
            "panchayat_name",
        ])
        worksheet.append([1, "मुख्य मतदान केंद्र", "मुख्य सड़क", "Sabour", "नया टोला", "North Panchayat"])
        worksheet["A2"].number_format = "000"
        output = BytesIO()
        workbook.save(output)

        rows = parse_booth_import("booths.xlsx", output.getvalue())

        self.assertEqual(rows[0]["booth_number"], "001")
        self.assertEqual(rows[0]["polling_station_name"], "मुख्य मतदान केंद्र")

    def test_parser_rejects_missing_columns_and_unsupported_file_types(self):
        with self.assertRaises(BoothImportFormatError):
            parse_booth_import("booths.csv", b"booth_number,panchayat_name\n1,North")
        with self.assertRaises(BoothImportFormatError):
            parse_booth_import("booths.xls", b"not an xlsx file")

    def test_csv_parser_marks_extra_row_values_for_review(self):
        contents = (
            "booth_number,polling_station_name,polling_station_address,"
            "block_name,village_name,panchayat_name\n"
            "001,Station,Address,Sabour,Village,North Panchayat,unexpected\n"
        ).encode("utf-8")

        rows = parse_booth_import("booths.csv", contents)

        self.assertEqual(
            rows[0]["parse_errors"],
            ["This row has values under an unlabeled column."],
        )

    async def test_validation_checks_relationships_and_duplicate_conflicts(self):
        session = FakeImportSession(
            blocks=[self.block],
            panchayats=[self.panchayat],
            existing_booths=[(2, "009")],
        )
        rows = [
            make_row(row_number=2),
            make_row(row_number=3),
            make_row(row_number=4, booth_number="009"),
            make_row(row_number=5, block_name="Missing Block"),
        ]

        validated = await main.validate_booth_import_rows(session, rows)

        self.assertEqual(validated[0]["errors"], [
            "Duplicate booth number in this file (row 3)."
        ])
        self.assertEqual(validated[1]["errors"], [
            "Duplicate booth number in this file (row 2)."
        ])
        self.assertTrue(any("already exists" in error for error in validated[2]["errors"]))
        self.assertTrue(any("does not exist" in error for error in validated[3]["errors"]))
        self.assertEqual(validated[0]["panchayat_id"], 2)

    async def test_confirmation_inserts_every_row_in_one_commit(self):
        session = FakeImportSession(
            blocks=[self.block],
            panchayats=[self.panchayat],
        )
        confirmation = main.BoothImportConfirmation(
            confirmed=True,
            rows=[
                main.BoothImportRow(**make_row(row_number=2)),
                main.BoothImportRow(**make_row(row_number=3, booth_number="002")),
            ],
        )

        result = await main.confirm_booth_import(
            confirmation,
            main.User(
                email="admin@example.com",
                role="admin",
                password_hash="unused",
            ),
            session,
        )

        self.assertEqual(result, {"imported_count": 2})
        self.assertTrue(session.committed)
        self.assertEqual(len(session.added), 2)
        self.assertEqual(session.added[0].village_name, "नया टोला")
        self.assertEqual(session.added[1].booth_number, "002")

    async def test_confirmation_rejects_invalid_rows_without_writing(self):
        session = FakeImportSession(
            blocks=[self.block],
            panchayats=[self.panchayat],
            existing_booths=[(2, "001")],
        )
        confirmation = main.BoothImportConfirmation(
            confirmed=True,
            rows=[main.BoothImportRow(**make_row())],
        )

        with self.assertRaises(HTTPException) as raised:
            await main.confirm_booth_import(
                confirmation,
                main.User(
                    email="admin@example.com",
                    role="admin",
                    password_hash="unused",
                ),
                session,
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(session.added, [])
        self.assertFalse(session.committed)

    async def test_validation_rejects_a_panchayat_assigned_to_another_block(self):
        panchayat = main.Panchayat(id=3, name="South Panchayat", block_id=4)
        session = FakeImportSession(
            blocks=[self.block],
            panchayats=[panchayat],
        )

        validated = await main.validate_booth_import_rows(
            session,
            [make_row(panchayat_name="South Panchayat")],
        )

        self.assertTrue(any("is not assigned to Block" in error for error in validated[0]["errors"]))

    async def test_concurrent_conflict_rolls_back_the_whole_import(self):
        class ConflictingSession(FakeImportSession):
            async def commit(self):
                raise IntegrityError("insert", {}, RuntimeError("unique conflict"))

        session = ConflictingSession(
            blocks=[self.block],
            panchayats=[self.panchayat],
        )
        confirmation = main.BoothImportConfirmation(
            confirmed=True,
            rows=[main.BoothImportRow(**make_row())],
        )

        with self.assertRaises(HTTPException) as raised:
            await main.confirm_booth_import(
                confirmation,
                main.User(
                    email="admin@example.com",
                    role="admin",
                    password_hash="unused",
                ),
                session,
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertTrue(session.rolled_back)
