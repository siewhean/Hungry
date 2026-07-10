#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from classify_non_consumer_entities import classify_entity, run_cleanup  # noqa: E402


class ClassifyNonConsumerEntitiesTest(unittest.TestCase):
    def test_school_and_corporate_technology_entities_are_remove_candidates(self):
        school = classify_entity("PAYA LEBAR METHODIST GIRLS' SCHOOL (SECONDARY)")
        corporate = classify_entity("JVCKENWOOD TECHNOLOGIES SINGAPORE PTE LTD")
        self.assertEqual("remove", school.decision)
        self.assertEqual("remove", corporate.decision)
        self.assertIn("school", school.categories)
        self.assertIn("technology_or_electronics", corporate.categories)

    def test_non_consumer_sfa_licence_type_is_authoritative(self):
        result = classify_entity("Example Foods Pte Ltd", "Food Processing Establishment")
        self.assertEqual("remove", result.decision)
        self.assertEqual(0.99, result.confidence)
        self.assertIn("food_manufacturing", result.categories)

    def test_consumer_food_signal_downgrades_name_only_false_positive(self):
        result = classify_entity("School of Coffee Cafe")
        self.assertEqual("review", result.decision)
        self.assertLess(result.confidence, 0.7)

    def test_food_business_without_non_consumer_evidence_is_kept(self):
        result = classify_entity("Giant Seafood Restaurant Pte Ltd", "Food Shop")
        self.assertEqual("keep", result.decision)

    def test_dry_run_reports_and_apply_keeps_review_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.csv"
            with source.open("w", encoding="utf-8", newline="") as output:
                writer = csv.DictWriter(output, fieldnames=["Business ID", "Stall / Restaurant Name", "Licence Type"])
                writer.writeheader()
                writer.writerows(
                    [
                        {"Business ID": "1", "Stall / Restaurant Name": "Example Secondary School", "Licence Type": "Food Shop"},
                        {"Business ID": "2", "Stall / Restaurant Name": "School of Coffee Cafe", "Licence Type": "Food Shop"},
                        {"Business ID": "3", "Stall / Restaurant Name": "Real Noodle House", "Licence Type": "Food Shop"},
                    ]
                )

            json_report = root / "report.json"
            csv_report = root / "report.csv"
            dry_summary = run_cleanup(source, json_report, csv_report)
            self.assertTrue(dry_summary["dryRun"])
            self.assertEqual(3, dry_summary["rowCount"])
            self.assertEqual(1, dry_summary["decisionCounts"]["remove"])
            self.assertEqual(1, dry_summary["decisionCounts"]["review"])
            self.assertTrue(json_report.exists())
            self.assertTrue(csv_report.exists())
            self.assertEqual(2, len(json.loads(json_report.read_text())["candidates"]))

            cleaned = root / "cleaned.csv"
            run_cleanup(source, json_report, csv_report, apply=True, cleaned_output=cleaned)
            with cleaned.open(encoding="utf-8", newline="") as cleaned_source:
                cleaned_rows = list(csv.DictReader(cleaned_source))
            self.assertEqual(["2", "3"], [row["Business ID"] for row in cleaned_rows])

    def test_apply_refuses_to_overwrite_source(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.csv"
            source.write_text("name\nRestaurant\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must differ"):
                run_cleanup(source, source.with_suffix(".json"), source.with_suffix(".report.csv"), apply=True, cleaned_output=source)


if __name__ == "__main__":
    unittest.main()
