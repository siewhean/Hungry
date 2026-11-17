#!/usr/bin/env python3
"""Regenerate the legacy menu XLSX with publication-held rows excluded."""

import csv
import os
from pathlib import Path
import re
import sys
from tempfile import NamedTemporaryFile
from typing import NamedTuple
from zipfile import ZipFile

import xlsxwriter


CSV_PATH = Path("data/Hungry Full Menu & Price - 21 Oct 2026.csv")
NEW_XLSX_PATH = Path("data/Hungry Full Menu & Price - 21 Oct 2026.regenerated.xlsx")
HOLD_PHRASE = "do not publish as a confirmed outlet menu"
QUARANTINE_MARKER = re.compile(r"\[\s*quarantined\s*:")
BLOCKED_LICENCES = frozenset({"NE08128A000", "NTF0132003"})


class ExportCounts(NamedTuple):
    input_rows: int
    excluded_rows: int
    exported_rows: int


def export_legacy_menu(csv_path: Path, xlsx_path: Path) -> ExportCounts:
    """Validate and write to a temporary file before replacing the destination."""
    if csv_path.resolve() == xlsx_path.resolve():
        raise ValueError("The export destination must differ from the source CSV")

    with csv_path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.reader(source, strict=True)
        header = next(reader, [])
        columns = [column.strip().casefold() for column in header]
        required = ("sfa licence", "description / notes")
        if (
            any(column not in columns for column in required)
            or any(not column for column in columns)
            or len(columns) != len(set(columns))
        ):
            raise ValueError(
                "The CSV must contain unique, nonblank headers including "
                "'SFA Licence' and 'Description / Notes'"
            )
        licence_index, notes_index = (columns.index(column) for column in required)

        with NamedTemporaryFile(
            dir=xlsx_path.parent, prefix=f".{xlsx_path.name}.", suffix=".xlsx", delete=False
        ) as staged:
            staged_path = Path(staged.name)

        input_rows = excluded_rows = exported_rows = 0
        try:
            with xlsxwriter.Workbook(
                staged_path,
                {
                    "constant_memory": True,
                    "strings_to_urls": False,
                    "strings_to_formulas": False,
                },
            ) as workbook:
                sheet = workbook.add_worksheet("Hungry Full Menu & Price")
                if sheet.write_row(0, 0, header) != 0:
                    raise ValueError("The CSV header exceeds Excel cell or column limits")
                for row in reader:
                    input_rows += 1
                    if len(row) != len(header) or not any(value.strip() for value in row):
                        raise ValueError(f"Malformed CSV record {input_rows} (line {reader.line_num})")
                    licence = row[licence_index].strip().upper()
                    notes = " ".join(row[notes_index].casefold().split())
                    if (
                        licence in BLOCKED_LICENCES
                        or HOLD_PHRASE in notes
                        or QUARANTINE_MARKER.search(notes)
                    ):
                        excluded_rows += 1
                        continue
                    if sheet.write_row(exported_rows + 1, 0, row) != 0:
                        raise ValueError(f"CSV record {input_rows} exceeds Excel cell or sheet limits")
                    exported_rows += 1

            with ZipFile(staged_path) as archive:
                corrupt_member = archive.testzip()
            if corrupt_member is not None:
                raise ValueError(f"Invalid XLSX ZIP entry: {corrupt_member}")
            os.replace(staged_path, xlsx_path)
        finally:
            staged_path.unlink(missing_ok=True)

    return ExportCounts(input_rows, excluded_rows, exported_rows)


def main():
    try:
        counts = export_legacy_menu(CSV_PATH, NEW_XLSX_PATH)
    except (OSError, ValueError, csv.Error) as exc:
        print(f"[Legacy export] Failed: {exc}", file=sys.stderr)
        return 1
    print(f"[Legacy export] Wrote {NEW_XLSX_PATH}")
    print(
        f"[Legacy export] Raw CSV: {counts.input_rows:,} | "
        f"Excluded: {counts.excluded_rows:,} | XLSX exported: {counts.exported_rows:,}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
