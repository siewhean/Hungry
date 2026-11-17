"""Minimal read-only streaming .xlsx reader (stdlib only).

Used so the importer needs no third-party Python packages and never loads the
whole 90 MB workbook into memory. The workbook is opened read-only.
"""
from __future__ import annotations

import re
import zipfile
from typing import Iterator
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_COL_RE = re.compile(r"([A-Z]+)")


def _col_index(ref: str) -> int:
    letters = _COL_RE.match(ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def sheet_paths(zf: zipfile.ZipFile) -> dict[str, str]:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    target = {r.get("Id"): r.get("Target") for r in rels}
    out: dict[str, str] = {}
    for s in wb.iter(f"{NS}sheet"):
        t = target[s.get(f"{REL_NS}id")].lstrip("/")
        out[s.get("name")] = t if t.startswith("xl/") else f"xl/{t}"
    return out


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    out: list[str] = []
    with zf.open("xl/sharedStrings.xml") as fh:
        for _, el in ET.iterparse(fh):
            if el.tag == f"{NS}si":
                out.append("".join(t.text or "" for t in el.iter(f"{NS}t")))
                el.clear()
    return out


def iter_rows(path: str, sheet_name: str) -> Iterator[list[str | None]]:
    """Yield each row as a list of cell strings (None for blanks)."""
    with zipfile.ZipFile(path) as zf:
        shared = _shared_strings(zf)
        with zf.open(sheet_paths(zf)[sheet_name]) as fh:
            for _, el in ET.iterparse(fh):
                if el.tag != f"{NS}row":
                    continue
                cells: dict[int, str | None] = {}
                for c in el.findall(f"{NS}c"):
                    t = c.get("t")
                    if t == "inlineStr":
                        val = "".join(x.text or "" for x in c.iter(f"{NS}t"))
                    else:
                        v = c.find(f"{NS}v")
                        val = v.text if v is not None else None
                        if t == "s" and val is not None:
                            val = shared[int(val)]
                    cells[_col_index(c.get("r"))] = val
                width = (max(cells) + 1) if cells else 0
                yield [cells.get(i) for i in range(width)]
                el.clear()
