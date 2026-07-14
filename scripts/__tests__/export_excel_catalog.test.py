#!/usr/bin/env python3
"""Focused safety tests for the Excel app-catalog exporter."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from export_excel_catalog_for_app import (  # noqa: E402
    CatalogValidationError,
    build_catalog,
    load_sheet_rows,
    validate_export_inputs,
    validate_generated_catalog,
)


def source_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "_row_number": 2,
        "Business ID": "business-1",
        "Stall ID": "",
        "Licence No": "",
        "Stall / Restaurant Name": "Safe Venue",
        "Postal Code": "238801",
        "Unit No.": "#01-01",
        "Latitude": 1.3,
        "Longitude": 103.8,
        "Menu Items": "Chicken Rice ($5.00)",
        "Image URL": "",
        "Dishes Image URL": "",
        "Logo URL": "",
    }
    row.update(overrides)
    return row


def venue_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "_row_number": 2,
        "id": "venue-1",
        "business_id": "business-1",
        "name": "Safe Venue",
        "postal_code": "238801",
        "unit_number": "#01-01",
        "menu_approved_for_display": True,
        "menu_rights_status": "operator_owned",
        "media_approved_for_display": False,
        "media_rights_status": "unverified",
        "image_url": "",
        "logo_url": "",
    }
    row.update(overrides)
    return row


def dish_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "_row_number": 2,
        "id": "dish-1",
        "venue_id": "venue-1",
        "name": "Chicken Rice",
        "menu_approved_for_display": True,
        "menu_rights_status": "licensed",
        "media_approved_for_display": False,
        "media_rights_status": "unverified",
        "image_url": "",
    }
    row.update(overrides)
    return row


def write_workbook(path: Path, source: dict[str, object], venue: dict[str, object], dish: dict[str, object]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Sheet1"
    source_headers = [key for key in source if not key.startswith("_")]
    sheet.append(source_headers)
    sheet.append([source.get(header) for header in source_headers])
    for sheet_name, row in (("Supabase Venues", venue), ("Supabase Dishes", dish)):
        target = workbook.create_sheet(sheet_name)
        headers = [key for key in row if not key.startswith("_")]
        target.append(headers)
        target.append([row.get(header) for header in headers])
    workbook.save(path)
    workbook.close()


class ExportExcelCatalogTest(unittest.TestCase):
    def test_safe_build_uses_cache_authorization_and_ignores_sheet1_media(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "safe.xlsx"
            write_workbook(
                path,
                source_row(
                    **{
                        "Image URL": "https://unreviewed.example/venue.jpg",
                        "Dishes Image URL": "https://unreviewed.example/dish.jpg",
                    }
                ),
                venue_row(),
                dish_row(),
            )

            catalog = build_catalog(load_sheet_rows(path), path, 0)

        venue_image_index = catalog["venueColumns"].index("imageUrl")
        dish_image_index = catalog["dishColumns"].index("imageUrl")
        self.assertEqual(catalog["metadata"]["venueCount"], 1)
        self.assertEqual(catalog["metadata"]["dishCount"], 1)
        self.assertEqual(catalog["venues"][0][venue_image_index], "")
        self.assertEqual(catalog["dishes"][0][dish_image_index], "")

    def test_preflight_rejects_each_unsafe_input_class(self) -> None:
        cases = {
            "duplicate_source_key": (
                [source_row(), source_row(_row_number=3)],
                [venue_row()],
                [dish_row()],
            ),
            "ambiguous_source_row": (
                [
                    source_row(
                        **{
                            "Business ID": "",
                            "Stall ID": "",
                            "Licence No": "",
                            "Postal Code": "",
                            "Unit No.": "",
                        }
                    )
                ],
                [venue_row()],
                [dish_row()],
            ),
            "duplicate_venue_id": (
                [source_row()],
                [venue_row(), venue_row(_row_number=3)],
                [dish_row()],
            ),
            "duplicate_dish_id": (
                [source_row()],
                [venue_row()],
                [dish_row(), dish_row(_row_number=3)],
            ),
            "orphan_dish_reference": (
                [source_row()],
                [venue_row()],
                [dish_row(venue_id="missing")],
            ),
            "placeholder_media": (
                [source_row()],
                [venue_row(image_url="https://cdn.example/placeholder.jpg")],
                [dish_row()],
            ),
            "approval_rights_conflict": (
                [source_row()],
                [venue_row(menu_rights_status="unverified")],
                [dish_row()],
            ),
        }
        for expected_code, args in cases.items():
            with self.subTest(expected_code=expected_code):
                with self.assertRaisesRegex(CatalogValidationError, expected_code):
                    validate_export_inputs(*args)

    def test_generated_integrity_rejects_duplicates_and_orphans(self) -> None:
        buildings = [{"id": "building-1", "heroDishId": "missing"}]
        venues = [
            {"id": "venue-1", "buildingId": "building-1", "topDishId": "dish-1"},
            {"id": "venue-1", "buildingId": "building-1", "topDishId": "dish-1"},
        ]
        dishes = [{"id": "dish-1", "venueId": "missing", "buildingId": "building-1"}]

        with self.assertRaises(CatalogValidationError) as raised:
            validate_generated_catalog(buildings, venues, dishes)

        message = str(raised.exception)
        self.assertIn("duplicate_generated_venue_id", message)
        self.assertIn("orphan_generated_dish_venue", message)
        self.assertIn("orphan_building_hero_dish", message)


if __name__ == "__main__":
    unittest.main()
