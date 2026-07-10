#!/usr/bin/env python3
"""Unit tests for the Hungry Excel source-quality display gate."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from audit_excel_source_quality import classify_row, unapproved_display_rows  # noqa: E402


def row(**overrides):
    value = {
        "Menu Source": "official_online_seed:https://merchant.example/menu",
        "Menu Items": "Chicken Rice, Laksa, Nasi Lemak, Mee Soto, Satay, Roti Prata, Kaya Toast, Char Kway Teow",
        "Image URL": "https://merchant.example/stall.jpg",
        "Dishes Image URL": "https://merchant.example/dish.jpg",
        "Image Rights Status": "merchant_owned",
        "Menu Rights Status": "merchant_owned",
        "Approved for Display": "yes",
        "Source URL": "https://merchant.example",
        "Google Website": "",
        "Google Place ID": "",
        "Google Rating": "",
        "Google Review Count": "",
    }
    value.update(overrides)
    return value


class AuditExcelSourceQualityTest(unittest.TestCase):
    def test_licensed_or_merchant_owned_row_is_display_approved(self):
        flags, _status = classify_row(row())

        self.assertIn("menu_display_approved", flags)
        self.assertIn("image_display_approved", flags)
        self.assertNotIn("production_menu_unverified", flags)
        self.assertNotIn("production_image_unverified", flags)
        self.assertEqual([], unapproved_display_rows([{"QA Flags": ";".join(flags)}]))

    def test_delivery_app_rows_are_quarantined_even_when_marked_approved(self):
        flags, _status = classify_row(
            row(
                **{
                    "Menu Source": "official_online_seed:https://foodpanda.sg/restaurant/test",
                    "Source URL": "https://foodpanda.sg/restaurant/test",
                    "Image Rights Status": "unverified",
                    "Menu Rights Status": "unverified",
                },
            ),
        )

        self.assertIn("delivery_app_source_quarantine", flags)
        self.assertIn("production_menu_unverified", flags)
        self.assertIn("production_image_unverified", flags)
        self.assertEqual(1, len(unapproved_display_rows([{"QA Flags": ";".join(flags)}])))

    def test_official_source_still_needs_explicit_approval_and_rights_status(self):
        flags, _status = classify_row(
            row(
                **{
                    "Approved for Display": "",
                    "Menu Rights Status": "",
                    "Image Rights Status": "",
                },
            ),
        )

        self.assertIn("menu_operator_source", flags)
        self.assertNotIn("menu_display_approved", flags)
        self.assertNotIn("image_display_approved", flags)
        self.assertEqual(1, len(unapproved_display_rows([{"QA Flags": ";".join(flags)}])))

    def test_placeholder_images_are_not_display_approved(self):
        flags, _status = classify_row(
            row(
                **{
                    "Image URL": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
                    "Dishes Image URL": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
                    "Image Rights Status": "merchant_owned",
                },
            ),
        )

        self.assertIn("storefront_image_placeholder", flags)
        self.assertIn("dish_image_placeholder", flags)
        self.assertIn("production_image_unverified", flags)
        self.assertEqual(1, len(unapproved_display_rows([{"QA Flags": ";".join(flags)}])))


if __name__ == "__main__":
    unittest.main()
