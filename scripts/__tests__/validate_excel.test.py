#!/usr/bin/env python3
"""Unit tests for the Hungry Excel workbook validator."""

from __future__ import annotations

import sys
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_excel_workbook import EXPECTED_COLUMNS, dedupe_key, validate_row  # noqa: E402


def valid_row(**overrides):
    row = {
        "_row_number": 2,
        "Business ID": "SFA-TEST-001",
        "Stall ID": "STALL-001",
        "Licence No": "LIC-001",
        "Stall / Restaurant Name": "Test Chicken Rice",
        "Business Name Normalized": "test chicken rice",
        "Stall Type": "Hawker Stall",
        "Latitude": "1.3521",
        "Longitude": "103.8198",
        "Postal Code": "238801",
        "Price Min (SGD)": "4.50",
        "Price Max (SGD)": "6.00",
        "Last Verified Date": "2026-06-06",
        "Google Rating": "4.2",
        "Google Review Count": "120",
        "Google Price Level": "1",
    }
    row.update(overrides)
    return row


class ValidateExcelWorkbookTest(unittest.TestCase):
    def test_expected_columns_include_google_and_menu_fields(self):
        self.assertIn("Google Place ID", EXPECTED_COLUMNS)
        self.assertIn("Menu Items", EXPECTED_COLUMNS)

    def test_valid_row_has_no_errors(self):
        row = valid_row()
        issues = validate_row(row, Counter({dedupe_key(row): 1}))
        self.assertEqual([], issues)

    def test_missing_name_and_bad_coordinates_are_errors(self):
        row = valid_row(
            **{
                "Stall / Restaurant Name": "",
                "Latitude": "2.0",
                "Longitude": "not-a-number",
            },
        )
        issues = validate_row(row, Counter({dedupe_key(row): 1}))
        codes = {issue["error_code"] for issue in issues}
        self.assertIn("missing_stall_name", codes)
        self.assertIn("invalid_latitude", codes)
        self.assertIn("missing_longitude", codes)

    def test_duplicate_source_key_is_warning(self):
        row = valid_row()
        issues = validate_row(row, Counter({dedupe_key(row): 2}))
        self.assertEqual(["duplicate_source_key"], [issue["error_code"] for issue in issues])
        self.assertEqual(["warning"], [issue["severity"] for issue in issues])


if __name__ == "__main__":
    unittest.main()
