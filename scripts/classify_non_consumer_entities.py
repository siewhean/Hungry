#!/usr/bin/env python3
"""Flag non-consumer SFA entities and optionally create a cleaned CSV copy.

Classification is dry-run by default.  Review candidates are never removed;
``--apply`` removes only high-confidence candidates and requires a distinct
``--cleaned-output`` path so the source dataset remains recoverable.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "singapore_food_businesses_canonical.csv"
RULESET_VERSION = "2026-07-10.1"

NAME_COLUMNS = (
    "Stall / Restaurant Name",
    "name",
    "business_name",
    "Business Name",
    "Licensee Name",
    "Licence Holder Name",
)
ID_COLUMNS = ("Business ID", "id", "Licence No", "License No", "licence_no", "license_no")
LICENCE_TYPE_COLUMNS = (
    "Licence Type",
    "License Type",
    "licence_type",
    "license_type",
    "Type of Licence",
    "Licence Category",
    "License Category",
)


def _pattern(expression: str) -> re.Pattern[str]:
    return re.compile(expression, re.IGNORECASE)


NON_CONSUMER_LICENCE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("food_manufacturing", _pattern(r"\b(food\s+)?(manufactur(?:er|ing)|processing\s+establishment|factory)\b")),
    ("warehouse_or_cold_store", _pattern(r"\b(cold\s*store|warehouse|storage\s+facility)\b")),
    ("slaughter_or_abattoir", _pattern(r"\b(slaughter\s*house|abattoir)\b")),
    ("import_export", _pattern(r"\b(import(?:er|ing)?|export(?:er|ing)?)\s+(licen[cs]e|establishment)\b")),
    ("food_transport", _pattern(r"\b(food\s+transport|transportation\s+of\s+food)\b")),
)

INSTITUTION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("school", _pattern(r"\b(primary|secondary|international|special\s+education)?\s*school\b")),
    ("college_or_polytechnic", _pattern(r"\b(college|polytechnic|junior\s+college)\b")),
    ("university", _pattern(r"\b(university|faculty|campus)\b")),
    ("preschool_or_childcare", _pattern(r"\b(pre[- ]?school|kindergarten|child\s*care|student\s*care)\b")),
    ("training_institute", _pattern(r"\b(training\s+(centre|center|institute)|institute\s+of\s+technical\s+education)\b")),
)

GOVERNMENT_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("ministry_or_statutory_board", _pattern(r"\b(ministry\s+of|statutory\s+board|government\s+office)\b")),
    ("uniformed_service", _pattern(r"\b(police\s+(station|headquarters)|fire\s+station|army\s+camp|military\s+camp|air\s+base|naval\s+base)\b")),
    ("civic_facility", _pattern(r"\b(court\s+building|embassy|consulate|municipal\s+office)\b")),
)

CORPORATE_SECTOR_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("technology_or_electronics", _pattern(r"\b(technolog(?:y|ies)|electronics|semiconductor|data\s+centre)\b")),
    ("engineering_or_manufacturing", _pattern(r"\b(engineering|manufacturing|fabrication|industrial\s+systems)\b")),
    ("logistics_or_transport", _pattern(r"\b(logistics|freight|shipping|distribution\s+centre|distribution\s+center)\b")),
    ("construction_or_marine", _pattern(r"\b(construction|shipyard|marine\s+services|aerospace)\b")),
    ("utilities_or_infrastructure", _pattern(r"\b(power\s+station|waterworks|waste\s+management|utilities)\b")),
)

PLACEHOLDER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("licence_placeholder", _pattern(r"^(main|central|master)\s+licen[cs]e$")),
    ("unnamed_corporate_canteen", _pattern(r"^(staff|employee|workers?)\s+(canteen|cafeteria)$")),
)

# Explicit consumer outlet words prevent terms such as "School of Coffee" or
# "Engineering Cafe" from being silently removed.  They remain reviewable if
# another strong signal exists.
CONSUMER_FOOD_PATTERN = _pattern(
    r"\b(restaurant|cafe|coffee|kopi|bakery|bistro|kitchen|eatery|food\s+court|hawker|food\s+stall|canteen\s+stall|bar\s*(?:&|and)\s*grill)\b"
)


@dataclass(frozen=True)
class Classification:
    decision: str
    confidence: float
    categories: tuple[str, ...]
    reasons: tuple[str, ...]


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _first_column(fieldnames: Iterable[str], aliases: Iterable[str], explicit: str | None = None) -> str | None:
    fields = list(fieldnames)
    by_lower = {field.strip().lower(): field for field in fields}
    if explicit:
        return by_lower.get(explicit.strip().lower())
    for alias in aliases:
        if alias.lower() in by_lower:
            return by_lower[alias.lower()]
    return None


def _matches(value: str, patterns: Iterable[tuple[str, re.Pattern[str]]], source: str) -> list[tuple[str, str]]:
    return [
        (category, f"{source}:{category}:{match.group(0)}")
        for category, pattern in patterns
        if (match := pattern.search(value))
    ]


def classify_entity(name: object, licence_type: object = "") -> Classification:
    """Classify one row with evidence suitable for an audit report."""

    normalized_name = normalize(name).lower()
    normalized_licence = normalize(licence_type).lower()
    licence_hits = _matches(normalized_licence, NON_CONSUMER_LICENCE_PATTERNS, "licence_type")
    institution_hits = _matches(normalized_name, INSTITUTION_PATTERNS, "name")
    government_hits = _matches(normalized_name, GOVERNMENT_PATTERNS, "name")
    corporate_hits = _matches(normalized_name, CORPORATE_SECTOR_PATTERNS, "name")
    placeholder_hits = _matches(normalized_name, PLACEHOLDER_PATTERNS, "name")
    has_food_signal = bool(CONSUMER_FOOD_PATTERN.search(normalized_name))

    hits = [*licence_hits, *institution_hits, *government_hits, *corporate_hits, *placeholder_hits]
    categories = tuple(dict.fromkeys(category for category, _reason in hits))
    reasons = [reason for _category, reason in hits]
    if has_food_signal:
        reasons.append("name:consumer_food_signal")

    if licence_hits:
        confidence = 0.99
    elif placeholder_hits:
        confidence = 0.97
    elif institution_hits or government_hits:
        confidence = 0.94
    elif corporate_hits:
        confidence = 0.88
    else:
        return Classification("keep", 0.0, (), ())

    # A food-outlet signal does not override a non-consumer licence type, but it
    # does force name-only matches through manual review.
    if has_food_signal and not licence_hits:
        return Classification("review", min(confidence, 0.69), categories, tuple(reasons))
    return Classification("remove", confidence, categories, tuple(reasons))


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_cleanup(
    input_path: Path,
    report_json: Path,
    report_csv: Path,
    *,
    apply: bool = False,
    cleaned_output: Path | None = None,
    name_column: str | None = None,
    licence_type_column: str | None = None,
) -> dict[str, object]:
    if apply and cleaned_output is None:
        raise ValueError("--apply requires --cleaned-output")
    if cleaned_output is not None and cleaned_output.resolve() == input_path.resolve():
        raise ValueError("cleaned output must differ from the source input")

    with input_path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fieldnames = list(reader.fieldnames or [])
        resolved_name_column = _first_column(fieldnames, NAME_COLUMNS, name_column)
        resolved_licence_column = _first_column(fieldnames, LICENCE_TYPE_COLUMNS, licence_type_column)
        resolved_id_column = _first_column(fieldnames, ID_COLUMNS)
        if not resolved_name_column:
            raise ValueError(f"could not resolve a name column from: {fieldnames}")
        rows = list(reader)

    candidates: list[dict[str, object]] = []
    kept_rows: list[Mapping[str, str]] = []
    decision_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()

    for row_number, row in enumerate(rows, start=2):
        classification = classify_entity(
            row.get(resolved_name_column, ""),
            row.get(resolved_licence_column, "") if resolved_licence_column else "",
        )
        decision_counts[classification.decision] += 1
        category_counts.update(classification.categories)
        if classification.decision != "keep":
            candidates.append(
                {
                    "rowNumber": row_number,
                    "entityId": normalize(row.get(resolved_id_column, "")) if resolved_id_column else "",
                    "name": normalize(row.get(resolved_name_column, "")),
                    "licenceType": normalize(row.get(resolved_licence_column, "")) if resolved_licence_column else "",
                    **asdict(classification),
                }
            )
        if classification.decision != "remove":
            kept_rows.append(row)

    generated_at = datetime.now(timezone.utc).isoformat()
    summary: dict[str, object] = {
        "generatedAt": generated_at,
        "rulesetVersion": RULESET_VERSION,
        "input": str(input_path),
        "inputSha256": file_sha256(input_path),
        "dryRun": not apply,
        "rowCount": len(rows),
        "decisionCounts": dict(sorted(decision_counts.items())),
        "categoryCounts": dict(sorted(category_counts.items())),
        "resolvedColumns": {
            "name": resolved_name_column,
            "licenceType": resolved_licence_column,
            "id": resolved_id_column,
        },
        "removalPolicy": "Only decision=remove rows are excluded; decision=review rows are retained.",
        "candidates": candidates,
    }

    report_json.parent.mkdir(parents=True, exist_ok=True)
    report_json.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    report_csv.parent.mkdir(parents=True, exist_ok=True)
    with report_csv.open("w", encoding="utf-8", newline="") as destination:
        columns = ("rowNumber", "entityId", "name", "licenceType", "decision", "confidence", "categories", "reasons")
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        for candidate in candidates:
            writer.writerow(
                {
                    **candidate,
                    "categories": "|".join(candidate["categories"]),
                    "reasons": "|".join(candidate["reasons"]),
                }
            )

    if apply and cleaned_output is not None:
        cleaned_output.parent.mkdir(parents=True, exist_ok=True)
        with cleaned_output.open("w", encoding="utf-8", newline="") as destination:
            writer = csv.DictWriter(destination, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(kept_rows)
        summary["cleanedOutput"] = str(cleaned_output)
        summary["removedRowCount"] = decision_counts["remove"]
        # Rewrite the JSON report so the artifact records the actual apply path.
        report_json.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--report-json", type=Path)
    parser.add_argument("--report-csv", type=Path)
    parser.add_argument("--name-column")
    parser.add_argument("--licence-type-column")
    parser.add_argument("--apply", action="store_true", help="Write a cleaned copy containing no high-confidence removals.")
    parser.add_argument("--cleaned-output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report_json = args.report_json or args.input.with_suffix(".non_consumer_report.json")
    report_csv = args.report_csv or args.input.with_suffix(".non_consumer_candidates.csv")
    try:
        summary = run_cleanup(
            args.input,
            report_json,
            report_csv,
            apply=args.apply,
            cleaned_output=args.cleaned_output,
            name_column=args.name_column,
            licence_type_column=args.licence_type_column,
        )
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
    print(json.dumps({key: value for key, value in summary.items() if key != "candidates"}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
