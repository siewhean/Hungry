#!/usr/bin/env python3
"""Split a staged menu crawl run into KEEP_CONDITIONAL / DOWNGRADE / RE-SOURCE / QUARANTINE buckets.

Safe and non-destructive: reads the staged files, never modifies them, makes no network request and no
database write. Default is a DRY RUN (counts only, nothing written). `--write` writes bucketed JSONL files plus
report / manifest into an output directory that must be outside any git repo and must not overlap a source path.

  python3 scripts/menu_run_quarantine.py --input-dir data/menus/quarantine-2026-11-08 \
      --master data/Hungry_Database_Food_Only_2026-10-21.csv --out-dir /Users/Shared/hungry-quarantine-2026-11-08 [--write]

Every row gets ALL reason codes that apply; its bucket is the most severe one
(QUARANTINE > RE-SOURCE > DOWNGRADE > KEEP_CONDITIONAL). Rows from the legacy slice (DD-MM-YYYY dates) are not
bucketed except for Q_NO_LICENCE (identity cannot be established); they are only counted.
Text, image, price and timestamp hygiene is applied to KEEP_CONDITIONAL and DOWNGRADE rows in the OUTPUT only.
Shared helpers (text cleaning, atomic write, disk check, sha256) come from menu_workbook_merge.py.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
import menu_workbook_merge as mm  # noqa: E402

csv.field_size_limit(10**8)

# ---------------------------------------------------------------- reason codes and buckets

SEVERITY = {"KEEP_CONDITIONAL": 0, "DOWNGRADE": 1, "RE-SOURCE": 2, "QUARANTINE": 3}
BUCKET_FILES = {
    "KEEP_CONDITIONAL": "keep_conditional.jsonl",
    "DOWNGRADE": "downgraded_brand_catalogue.jsonl",
    "RE-SOURCE": "resource_queue.jsonl",
    "QUARANTINE": "quarantined.jsonl",
}
CODE_BUCKET = {
    "Q_CROSSWALK_LICENSE": "QUARANTINE",
    "Q_UNREPORTED_BATCH": "QUARANTINE",
    "Q_REVIEW_LICENCE": "QUARANTINE",
    "Q_NO_LICENCE": "QUARANTINE",
    "Q_URL_OWNED_BY_OTHER_LICENCE": "QUARANTINE",
    "Q_SHARED_DISH_SET_UNRELATED": "QUARANTINE",
    "Q_URL_NOT_OWN_MASTER_URL": "QUARANTINE",  # added: fall-through of the KEEP_CONDITIONAL rule (URL is not the licence's own)
    "R_WRONG_SOURCE_HOST": "RE-SOURCE",
    "R_NO_PRICE_BRAND": "RE-SOURCE",
    "D_BRAND_COPY": "DOWNGRADE",
}
OLD_SLICE_CODES = ("Q_NO_LICENCE",)  # the only rule applied to legacy rows

UNREPORTED_BATCH_PREFIX = "2026-11-08T19"
BRAND_COPY_BATCH_PREFIX = "2026-11-08T18"
FIRST_PARTY_SOURCES = {"brand_official_site", "official_site", "official_api"}
DELIVERY_SOURCES = {"foodpanda", "grab", "deliveroo"}
DELIVERY_HOST_MARKERS = ("foodpanda.", "grab.com", "deliveroo.", "ubereats.")
BAD_HOST_SUFFIXES = ("linktr.ee", "beacons.ai", "bio.link", "linkin.bio", "getz.co", "cdn.shopify.com", "shopifycdn.com")
BAD_HOST_CONTAINS = ("tabsquare",)
# Audit seeds. A seed fires when ALL of its present keys match. name_prefix is compared with norm_name().
SEED_WRONG_SOURCE = (
    {"label": "arabica_somerset313_page", "licences": {"CE10G68E000", "CE24M79A000", "SE20D69A000", "W78126N000"},
     "url_contains": "313-somerset"},
    {"label": "tai_cheong_bakery_getz", "name_prefix": "taicheongbakery", "host_suffix": "getz.co"},
    {"label": "yardbird_marinabaysands", "name_prefix": "yardbird", "host_suffix": "marinabaysands.com"},
    {"label": "white_restaurant_linktree", "licences": {"NW15633A000"}, "host_suffix": "linktr.ee"},
    {"label": "whisk_paddle_tabsquare", "licences": {"CE25L83C000"}, "host_contains": "tabsquare"},
    {"label": "bkk_bistro_bomul", "name_prefix": "bkkbistro", "host_suffix": "bomul.com.sg"},
    {"label": "hainan_story_shopify_cdn", "name_prefix": "thehainanstory", "host_suffix": "cdn.shopify.com"},
    {"label": "tiong_bahru_bakery_shopify_cdn", "name_prefix": "tiongbahrubakery", "host_suffix": "cdn.shopify.com"},
)
NULL_PRICE_SHARE = 0.9
MIN_NULL_PRICE_ROWS = 5  # a licence needs at least this many rows for R_NO_PRICE_BRAND
MIN_SHARED_SET = 5  # identical dish sets smaller than this are coincidence, not copying
IMAGE_STRIP_PARAMS = set(mm.RESIZE_PARAMS) | {"itok"}
THUMB_PATH_RE = re.compile(r"/styles/[^/]+/|(?:^|[/_,])[wh]_\d{2,4}(?:[,/_.]|$)|(?:^|[/_.-])(?:thumb|thumbs|thumbnail)(?:[/_.-]|$)", re.I)
LEGACY_DATE_RE = re.compile(r"^\d{2}-\d{2}-\d{4}$")
NAIVE_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$")
TZ_TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$")
DISCLAIMER_RE = re.compile(r"not independently verified", re.I)
MAX_ERROR_RATE = 0.001
TOP_N = 10
SAMPLES_PER_CODE = 3

# What the audit said to expect. Mismatches are printed loudly; they never change behaviour.
EXPECTED = (
    ("menus.rows", 135206, "all rows in the consolidated jsonl"),
    ("menus.legacy_rows", 103403, "DD-MM-YYYY rows (not bucketed)"),
    ("master.rows", 36752, "rows in the master CSV"),
    ("resolved.rows", 245, "rows in resolved_brand_menu_urls"),
    ("crosswalk.rows", 684, "rows in verified_crosswalk_menu_urls"),
    ("review.rows", 89, "rows in review_list"),
    ("discovered.rows", 0, "rows in discovered_website_menu_urls"),
    ("Q_CROSSWALK_LICENSE.rows", 616, "menu rows on crosswalk licences"),
    ("Q_CROSSWALK_LICENSE.licences", 11, "licences behind those rows"),
    ("Q_UNREPORTED_BATCH.rows", 13500, "rows stamped 2026-11-08T19"),
    ("Q_UNREPORTED_BATCH.licences", 8, "licences behind those rows"),
    ("Q_REVIEW_LICENCE.rows", 193, "rows whose licence is on the review list"),
    ("Q_NO_LICENCE.empty_rows", 2407, "rows with an empty licence"),
    ("Q_NO_LICENCE.not_in_master_rows", 280, "licence cells split on ';' as instructed (audit's 280 is the unsplit count)"),
    ("Q_NO_LICENCE.not_in_master_rows_unsplit", 280, "raw licence cell not found in master, no splitting"),
    ("D_BRAND_COPY.brand_site_18h_rows", 14348, "brand_official_site rows stamped 2026-11-08T18"),
)


class QuarantineError(mm.MergeError):
    pass


# ---------------------------------------------------------------- small helpers

def split_licences(cell) -> list:
    return [p.strip() for p in str(cell or "").split(";") if p.strip()]


def norm_url(u) -> str:
    u = str(u or "").strip()
    if not u:
        return ""
    sp = urlsplit(u)
    host = (sp.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if not host:
        return u.lower().rstrip("/")
    return f"{host}{sp.path.rstrip('/')}{'?' + sp.query if sp.query else ''}"


def host_of(u) -> str:
    try:
        host = (urlsplit(str(u or "").strip()).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def host_matches(host: str, domain: str) -> bool:
    d = domain.strip().lower()
    d = d[4:] if d.startswith("www.") else d
    return bool(d) and (host == d or host.endswith("." + d))


def brand_key(name) -> str:
    """Normalised brand token: first word of the venue name, ignoring a leading 'the', punctuation and any (suffix)."""
    s = mm.clean_text(name).casefold()
    s = re.sub(r"[’'`]", "", s)
    s = re.sub(r"\(.*?\)", " ", s)
    toks = re.findall(r"[^\W_]+", s)
    if toks and toks[0] == "the" and len(toks) > 1:
        toks = toks[1:]
    if not toks:
        return ""
    first = toks[0]
    if len(first) < 3 and len(toks) > 1:
        first += toks[1]
    return first


def price_of(row) -> Optional[Decimal]:
    v = row.get("price_sgd")
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return Decimal(str(v))
    if isinstance(v, str):
        return mm.parse_price(v).amount
    return None


def price_key(p: Optional[Decimal]) -> str:
    return "None" if p is None else mm.money_str(p)


def is_legacy(row) -> bool:
    return bool(LEGACY_DATE_RE.match(str(row.get("crawl_timestamp") or "")))


def entity_of(row) -> str:
    return str(row.get("stall_licence_no") or "").strip() or "(none)"


# ---------------------------------------------------------------- context built from the side files

@dataclass
class Ctx:
    master_names: dict = field(default_factory=dict)  # licence -> display name
    master_owners: dict = field(default_factory=dict)  # normalised menu URL -> set of licences
    crosswalk: set = field(default_factory=set)
    review: dict = field(default_factory=dict)  # licence -> reason text
    brand_domains: dict = field(default_factory=dict)  # norm_name prefix -> [domains]
    # derived from the rows (pass 1)
    unrelated_entities: set = field(default_factory=set)
    samebrand_entities: set = field(default_factory=set)
    nullprice_entities: set = field(default_factory=set)
    copy_keys: set = field(default_factory=set)
    same_brand_url_policy: str = "strict"

    def brand_of_licence(self, lic: str) -> str:
        return brand_key(self.master_names.get(lic, ""))

    def allowed_domains(self, names) -> list:
        out: list = []
        norms = [mm.norm_name(n) for n in names if n]
        for prefix, doms in self.brand_domains.items():
            if any(n.startswith(prefix) for n in norms):
                out.extend(doms)
        return out


def read_csv(path: Path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def load_master(path: Path, ctx: Ctx) -> int:
    rows = 0
    for r in read_csv(path):
        rows += 1
        name = (r.get("F&B Name") or r.get("Registered Business Name") or "").strip()
        url = norm_url(r.get("Menu URL"))
        for lic in split_licences(r.get("SFA Licence")):
            ctx.master_names.setdefault(lic, name)
            if url:
                ctx.master_owners.setdefault(url, set()).add(lic)
    return rows


def load_crosswalk(path: Path, ctx: Ctx) -> tuple:
    rows = 0
    for r in read_csv(path):
        rows += 1
        ctx.crosswalk.update(split_licences(r.get("stall_licence_no")))
    return rows, len(ctx.crosswalk)


def load_brand_domains(path: Optional[Path], ctx: Ctx) -> None:
    if not path:
        return
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise QuarantineError(f"brand_domains file unreadable: {e}", 2)
    if not isinstance(data, dict):
        raise QuarantineError("brand_domains must be a JSON object {brand name: [domains]}", 2)
    for brand, doms in data.items():
        doms = [doms] if isinstance(doms, str) else doms
        if not isinstance(doms, list) or not all(isinstance(d, str) for d in doms):
            raise QuarantineError(f"brand_domains entry for {brand!r} must be a domain or list of domains", 2)
        key = mm.norm_name(brand)
        if key:
            ctx.brand_domains.setdefault(key, []).extend(d.strip().lower() for d in doms if d.strip())


class ErrorLog:
    def __init__(self):
        self.entries: list = []
        self.lines = 0

    def add(self, file: str, line_no: int, error: str, raw: str) -> None:
        self.entries.append({"file": file, "line": line_no, "error": error, "snippet": raw[:120]})

    @property
    def rate(self) -> float:
        return len(self.entries) / self.lines if self.lines else 0.0


def load_review(path: Path, ctx: Ctx, errors: ErrorLog) -> int:
    rows = 0
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            errors.lines += 1
            try:
                rec = json.loads(line)
                if not isinstance(rec, dict):
                    raise ValueError("not a JSON object")
            except ValueError as e:
                errors.add(path.name, n, f"bad_json: {e}", line)
                continue
            rows += 1
            reason = str(rec.get("rejection_reason") or rec.get("reason") or "").strip()
            for lic in split_licences(rec.get("stall_licence_no")):
                ctx.review.setdefault(lic, reason)
    return rows


# ---------------------------------------------------------------- row facts and classification

@dataclass
class Item:
    line: int
    row: dict
    legacy: bool
    entity: str
    parts: list
    name: str
    brand: str
    price: Optional[Decimal]


def make_item(line: int, row: dict, ctx: Ctx) -> Item:
    parts = split_licences(row.get("stall_licence_no"))
    master_name = next((ctx.master_names[p] for p in parts if ctx.master_names.get(p)), "")
    name = master_name or str(row.get("stall_name") or "")
    return Item(line, row, is_legacy(row), entity_of(row), parts, name, brand_key(name), price_of(row))


def seed_hit(seed: dict, it: Item, host: str, url: str) -> bool:
    if "licences" in seed and not (set(it.parts) & seed["licences"]):
        return False
    if "name_prefix" in seed:
        names = {mm.norm_name(it.name), mm.norm_name(it.row.get("stall_name"))}
        if not any(n.startswith(seed["name_prefix"]) for n in names):
            return False
    if "host_suffix" in seed and not host_matches(host, seed["host_suffix"]):
        return False
    if "host_contains" in seed and seed["host_contains"] not in host:
        return False
    if "url_contains" in seed and seed["url_contains"] not in url.lower():
        return False
    return True


def wrong_source_host(it: Item, ctx: Ctx) -> Optional[str]:
    url = str(it.row.get("source_url") or "").strip()
    if not url:
        return None
    host = host_of(url)
    allowed = ctx.allowed_domains([it.name, it.row.get("stall_name")])
    if allowed:  # owner allow-list is authoritative for the brands it names
        return None if any(host_matches(host, d) for d in allowed) else "host_not_in_brand_domains"
    for seed in SEED_WRONG_SOURCE:
        if seed_hit(seed, it, host, url):
            return seed["label"]
    if any(host_matches(host, s) for s in BAD_HOST_SUFFIXES) or any(c in host for c in BAD_HOST_CONTAINS):
        return "aggregator_or_widget_host"
    if urlsplit(url).path.lower().endswith(".pdf"):
        return "pdf_source"
    source = str(it.row.get("source") or "").strip().lower()
    if source in FIRST_PARTY_SOURCES and any(m in host for m in DELIVERY_HOST_MARKERS):
        return "delivery_platform_posing_as_first_party"
    return None


def url_ownership(it: Item, ctx: Ctx) -> str:
    """own | shared_same_brand | shared_unrelated | other | same_brand_other (sidecar policy only) | unowned | none (blank)."""
    u = norm_url(it.row.get("source_url"))
    if not u:
        return "none"
    owners = ctx.master_owners.get(u)
    if not owners:
        return "unowned"
    mine = set(it.parts)
    if not owners - mine:
        return "own"
    brands = {ctx.brand_of_licence(o) for o in owners}
    if owners & mine:
        return "shared_same_brand" if len(brands) == 1 else "shared_unrelated"
    if ctx.same_brand_url_policy == "sidecar" and it.brand and brands == {it.brand}:
        return "same_brand_other"  # chain page listed on sibling outlets; not Q, never kept without another reason
    return "other"


def classify(it: Item, ctx: Ctx) -> tuple:
    """Return (sorted reason codes, facts dict). Legacy rows only get OLD_SLICE_CODES."""
    codes: set = set()
    facts: dict = {}
    if not it.parts or any(p not in ctx.master_names for p in it.parts):
        codes.add("Q_NO_LICENCE")
    if it.legacy:
        return sorted(codes & set(OLD_SLICE_CODES)), facts
    row = it.row
    ts = str(row.get("crawl_timestamp") or "")
    source = str(row.get("source") or "").strip().lower()
    if set(it.parts) & ctx.crosswalk:
        codes.add("Q_CROSSWALK_LICENSE")
    if ts.startswith(UNREPORTED_BATCH_PREFIX):
        codes.add("Q_UNREPORTED_BATCH")
    if set(it.parts) & set(ctx.review):
        codes.add("Q_REVIEW_LICENCE")
        facts["review_reason"] = next(ctx.review[p] for p in it.parts if p in ctx.review)
    own = url_ownership(it, ctx)
    if own in ("other", "shared_unrelated"):
        codes.add("Q_URL_OWNED_BY_OTHER_LICENCE")
    facts["url_ownership"] = own
    if it.entity in ctx.unrelated_entities:
        codes.add("Q_SHARED_DISH_SET_UNRELATED")
    if wrong_source_host(it, ctx):
        codes.add("R_WRONG_SOURCE_HOST")
    brand_level = source in FIRST_PARTY_SOURCES or len(it.parts) > 1
    if it.price is None and brand_level and it.entity in ctx.nullprice_entities:
        codes.add("R_NO_PRICE_BRAND")
    if source == "brand_official_site" and ts.startswith(BRAND_COPY_BATCH_PREFIX):
        codes.add("D_BRAND_COPY")
    if it.entity in ctx.samebrand_entities:
        codes.add("D_BRAND_COPY")
    if it.price is not None and it.brand and (it.brand, mm.norm_name(row.get("item_name")), price_key(it.price)) in ctx.copy_keys:
        codes.add("D_BRAND_COPY")
    if not codes and own not in ("own", "shared_same_brand"):
        codes.add("Q_URL_NOT_OWN_MASTER_URL")
    return sorted(codes), facts


def bucket_for(codes) -> str:
    if not codes:
        return "KEEP_CONDITIONAL"
    return max((CODE_BUCKET[c] for c in codes), key=lambda b: SEVERITY[b])


# ---------------------------------------------------------------- pass-1 aggregates

class Aggregates:
    def __init__(self):
        self.rows = Counter()
        self.nulls = Counter()
        self.pairs: dict = defaultdict(set)
        self.entity_brand: dict = {}
        self.copies: dict = defaultdict(set)  # (brand, name, price) -> entities

    def add(self, it: Item) -> None:
        self.rows[it.entity] += 1
        self.entity_brand.setdefault(it.entity, it.brand)
        nn = mm.norm_name(it.row.get("item_name"))
        pk = price_key(it.price)
        if it.price is None:
            self.nulls[it.entity] += 1
        else:
            if it.brand and nn:
                self.copies[(it.brand, nn, pk)].add(it.entity)
        if nn:
            self.pairs[it.entity].add(f"{nn}\t{pk}")

    def finish(self, ctx: Ctx) -> None:
        ctx.nullprice_entities = {e for e, n in self.rows.items() if n >= MIN_NULL_PRICE_ROWS and self.nulls[e] / n >= NULL_PRICE_SHARE}
        ctx.copy_keys = {k for k, ents in self.copies.items() if len(ents) >= 2}
        groups: dict = defaultdict(list)
        for ent, pairs in self.pairs.items():
            if len(pairs) >= MIN_SHARED_SET:
                digest = hashlib.sha1("\n".join(sorted(pairs)).encode("utf-8")).hexdigest()
                groups[digest].append(ent)
        for ents in groups.values():
            if len(ents) < 2:
                continue
            if len({self.entity_brand[e] for e in ents}) > 1:
                ctx.unrelated_entities.update(ents)
            else:
                ctx.samebrand_entities.update(ents)


# ---------------------------------------------------------------- per-row hygiene (OUTPUT only)

def source_type_of(row: dict) -> str:
    host = host_of(row.get("source_url"))
    source = str(row.get("source") or "").strip().lower()
    if any(m in host for m in DELIVERY_HOST_MARKERS):
        return "delivery_platform"
    if source == "brand_official_site":
        return "official_site"
    if source in DELIVERY_SOURCES:
        return "delivery_platform"
    return "unknown"


def strip_image_params(url: str) -> tuple:
    """Drop pure resize query params only; never rewrite the path. Returns (url, removed_param_names)."""
    if "?" not in url:
        return url, []
    base, _, rest = url.partition("?")
    query, hash_sep, frag = rest.partition("#")
    kept, removed = [], []
    for seg in query.split("&"):
        key = seg.split("=", 1)[0].lower()
        if key in IMAGE_STRIP_PARAMS:
            removed.append(key)
        elif seg:
            kept.append(seg)
    if not removed:
        return url, []
    out = base + ("?" + "&".join(kept) if kept else "")
    return out + (hash_sep + frag if hash_sep else ""), removed


def normalise_timestamp(value) -> tuple:
    """Return (new_value, fix_or_None, tz_missing). Never invents a time or an offset."""
    s = str(value).strip() if isinstance(value, str) else ""
    if not s:
        return value, None, False
    if LEGACY_DATE_RE.match(s):
        try:
            d = datetime.strptime(s, "%d-%m-%Y").date()
        except ValueError:
            return value, "crawl_timestamp:unrecognised_format", False
        return d.isoformat(), "crawl_timestamp:legacy_date_to_iso_date", True
    if TZ_TS_RE.match(s):
        return value, None, False
    m = NAIVE_TS_RE.match(s)
    if m:
        new = f"{m.group(1)}T{m.group(2)}"
        return new, ("crawl_timestamp:space_to_T" if new != s else None), True
    return value, "crawl_timestamp:unrecognised_format", False


def tidy(field_name: str, value, row: dict, fixes: list) -> None:
    if not isinstance(value, str):
        return
    cleaned = mm.clean_text(value)
    if cleaned != value:
        fixes.append(f"{field_name}:html_entities_decoded" if html.unescape(value) != value else f"{field_name}:whitespace_trimmed")
        row[field_name] = cleaned


def base_fields(row: dict, fixes: list) -> None:
    """Applied to every output row."""
    if row.get("verified") is not False:
        fixes.append("verified:reset_to_false")
    row["verified"] = False
    row["price_basis"] = "unknown"
    row["source_type"] = source_type_of(row)


def hygiene(row: dict, bucket: str, fixes: list) -> None:
    """Applied to KEEP_CONDITIONAL and DOWNGRADE rows."""
    tidy("item_name", row.get("item_name"), row, fixes)
    tidy("description", row.get("description"), row, fixes)
    img = row.get("image_url")
    if isinstance(img, str) and img.strip():
        new, removed = strip_image_params(img.strip())
        if removed:
            fixes.append("image_url:resize_params_stripped(" + ",".join(removed) + ")")
            row["image_url"] = new
        if THUMB_PATH_RE.search(urlsplit(new).path):
            row["image_thumbnail"] = True
    p = price_of(row)
    if p is not None and (p < mm.PRICE_MIN or p > mm.PRICE_MAX):
        row["price_review"] = True
    ts, fix, tz_missing = normalise_timestamp(row.get("crawl_timestamp"))
    if fix:
        fixes.append(fix)
        if ts != row.get("crawl_timestamp"):
            row["crawl_timestamp_raw"] = row.get("crawl_timestamp")
            row["crawl_timestamp"] = ts
    if tz_missing:
        row["timestamp_tz_missing"] = True
    if bucket == "DOWNGRADE":
        row["catalogue_scope"] = "brand"


# ---------------------------------------------------------------- safe writing

def existing_ancestor(p: Path) -> Path:
    p = p.resolve()
    while not p.exists():
        p = p.parent
    return p


def check_output_dir(out_dir: Path, sources: list, protected_dirs: tuple = ()) -> Path:
    out = Path(out_dir).resolve()
    for anc in [out, *out.parents]:
        if (anc / ".git").exists():
            raise QuarantineError(f"Refusing output dir inside a git repo: {out} (found {anc / '.git'})", 2)
    for s in sources:
        sp = Path(s).resolve()
        if out == sp or out in sp.parents or out == sp.parent:
            raise QuarantineError(f"Refusing output dir {out}: it equals or contains the source {sp} (or its folder)", 2)
    for d in protected_dirs:
        dp = Path(d).resolve()
        if out == dp or dp in out.parents:
            raise QuarantineError(f"Refusing output dir {out}: it is inside the input folder {dp}", 2)
    if out.exists() and not out.is_dir():
        raise QuarantineError(f"Output path is not a directory: {out}", 2)
    return out


class StagedOutputs:
    """Open temp files in the output dir; commit with os.replace only when everything succeeded."""

    def __init__(self, out_dir: Path, run_id: str):
        self.out, self.rid = out_dir, run_id
        self.handles: dict = {}
        self.tmp: dict = {}

    def open(self, name: str):
        fd, tmp = tempfile.mkstemp(dir=self.out, prefix=f".{name}.", suffix=".tmp")
        os.chmod(tmp, 0o644)
        self.tmp[name] = Path(tmp)
        self.handles[name] = os.fdopen(fd, "w", encoding="utf-8", newline="\n")
        return self.handles[name]

    def put_text(self, name: str, text: str) -> None:
        self.open(name).write(text)

    def put_copy(self, name: str, src: Path) -> None:
        h = self.open(name)
        with open(src, encoding="utf-8", newline="") as f:
            shutil.copyfileobj(f, h)

    def abort(self) -> None:
        for h in self.handles.values():
            try:
                h.close()
            except OSError:
                pass
        for t in self.tmp.values():
            t.unlink(missing_ok=True)

    def commit(self) -> None:
        for h in self.handles.values():
            h.flush()
            os.fsync(h.fileno())
            h.close()
        placed, backups = [], {}
        try:
            for name, tmp in self.tmp.items():
                final = self.out / name
                if final.exists():
                    bak = self.out / f".{name}.bak-{self.rid}"
                    os.replace(final, bak)
                    backups[name] = bak
                os.replace(tmp, final)
                placed.append(name)
        except BaseException:
            for name in placed:
                (self.out / name).unlink(missing_ok=True)
            for name, bak in backups.items():
                if bak.exists():
                    os.replace(bak, self.out / name)
            self.abort()
            raise
        for bak in backups.values():
            bak.unlink(missing_ok=True)


def script_provenance() -> dict:
    here = Path(__file__).resolve()
    info = {"script": here.name, "script_sha256": mm.sha256_of(here), "git_head": "unknown", "git_blob": "unknown", "git_dirty": None}
    try:
        def git(*a):
            return subprocess.run(["git", "-C", str(here.parent), *a], capture_output=True, text=True, timeout=20, check=True).stdout.strip()
        info["git_head"] = git("rev-parse", "HEAD")
        info["git_blob"] = git("rev-parse", f"HEAD:scripts/{here.name}")
        info["git_dirty"] = bool(git("status", "--porcelain", "--", str(here)))
    except (OSError, subprocess.SubprocessError):
        pass
    return info


# ---------------------------------------------------------------- the run

def top_licences(counter: Counter) -> list:
    return [[k, v] for k, v in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_N]]


class BrandCatalogue:
    """One row per brand + normalised dish name + price, built from DOWNGRADE rows only (after hygiene).

    Rows are never attached to outlets: outlet_licences only records where the dish was observed. Wrong-host,
    quarantined and re-source rows never reach it because only the DOWNGRADE bucket feeds it."""

    def __init__(self):
        self.rows: dict = {}

    def add(self, it: Item, out: dict) -> None:
        nn = mm.norm_name(out.get("item_name"))
        if not nn:
            return
        brand = it.brand or "(unknown)"
        key = (brand, nn, price_key(it.price))
        rec = self.rows.get(key)
        if rec is None:
            rec = self.rows[key] = {
                "brand": brand, "brand_display_name": it.name, "item_name": out.get("item_name"), "category": out.get("category"),
                "price_sgd": out.get("price_sgd"), "description": out.get("description"), "image_url": out.get("image_url"),
                "source_url": out.get("source_url"), "source": out.get("source"), "source_type": out.get("source_type"),
                "catalogue_scope": "brand", "verified": False, "price_basis": "unknown", "crawl_timestamp": out.get("crawl_timestamp"),
                "outlet_licences": set(),
            }
            for flag in ("price_review", "image_thumbnail", "timestamp_tz_missing"):
                if out.get(flag):
                    rec[flag] = True
        else:
            ts, new = str(rec.get("crawl_timestamp") or ""), str(out.get("crawl_timestamp") or "")
            if new > ts:
                rec["crawl_timestamp"] = out.get("crawl_timestamp")
        rec["outlet_licences"].update(it.parts)

    def records(self) -> list:
        out = []
        for key in sorted(self.rows):
            rec = dict(self.rows[key])
            rec["outlet_licences"] = sorted(rec["outlet_licences"])
            rec["outlet_count"] = len(rec["outlet_licences"])
            out.append(rec)
        return out

    def outlet_map(self, ctx: Ctx, records: list) -> list:
        brand_rows, observed = Counter(), Counter()
        for r in records:
            brand_rows[r["brand"]] += 1
            for lic in r["outlet_licences"]:
                observed[(lic, r["brand"])] += 1
        return [{"licence": lic, "outlet_name": ctx.master_names.get(lic, ""), "brand_key": brand,
                 "catalogue_row_count": brand_rows[brand], "observed_rows": n} for (lic, brand), n in sorted(observed.items(), key=lambda kv: (kv[0][1], kv[0][0]))]

    def stats(self, records: list) -> dict:
        per_brand: dict = defaultdict(lambda: {"rows": 0, "outlets": set(), "null": 0, "prices": defaultdict(set)})
        for r in records:
            b = per_brand[r["brand"]]
            b["rows"] += 1
            b["outlets"].update(r["outlet_licences"])
            if r["price_sgd"] is None:
                b["null"] += 1
            else:
                b["prices"][mm.norm_name(r["item_name"])].add(price_key(price_of(r)))
        top = sorted(((len(b["outlets"]), b["rows"], k) for k, b in per_brand.items()), key=lambda t: (-t[0], t[2]))[:TOP_N]
        return {
            "rows": len(records), "brands": len(per_brand),
            "outlet_licences": len({lic for b in per_brand.values() for lic in b["outlets"]}),
            "top_brands_by_outlet_count": [{"brand": k, "outlet_count": n, "rows": rows} for n, rows, k in top],
            "brands_with_price_conflicts": sum(1 for b in per_brand.values() if any(len(v) > 1 for v in b["prices"].values())),
            "brands_mostly_priceless": sum(1 for b in per_brand.values() if b["null"] * 2 > b["rows"]),
        }


def outlet_map_csv(rows: list) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["licence", "outlet_name", "brand_key", "catalogue_row_count", "observed_rows"], lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def run(args, free_fn: Callable) -> tuple:
    """Return (exit_code, report dict, files-to-write dict or None, errors list)."""
    d = Path(args.input_dir)
    date = args.date
    paths = {
        "menus": d / f"menus_consolidated_{date}.jsonl",
        "resolved": d / f"resolved_brand_menu_urls_{date}.csv",
        "crosswalk": d / f"verified_crosswalk_menu_urls_{date}.csv",
        "review": d / f"review_list_{date}.jsonl",
        "discovered": d / f"discovered_website_menu_urls_{date}.csv",
        "master": Path(args.master),
    }
    for key in ("menus", "crosswalk", "review", "master"):
        if not paths[key].is_file():
            raise QuarantineError(f"Required input missing: {paths[key]}", 2)
    optional = [k for k in ("resolved", "discovered") if not paths[k].is_file()]
    present = {k: p for k, p in paths.items() if p.is_file()}
    sources = list(present.values()) + ([Path(args.brand_domains)] if args.brand_domains else [])
    out_dir = check_output_dir(Path(args.out_dir), sources, (d,))
    mm.check_disk([(existing_ancestor(out_dir), sum(p.stat().st_size for p in sources))], free_fn)

    hashes_before = {k: mm.sha256_of(p) for k, p in present.items()}
    if args.brand_domains:
        hashes_before["brand_domains"] = mm.sha256_of(Path(args.brand_domains))

    ctx, errors = Ctx(same_brand_url_policy=args.same_brand_url_policy), ErrorLog()
    master_rows = load_master(paths["master"], ctx)
    cw_rows, cw_licences = load_crosswalk(paths["crosswalk"], ctx)
    review_rows = load_review(paths["review"], ctx, errors)
    load_brand_domains(Path(args.brand_domains) if args.brand_domains else None, ctx)
    counts = {
        "resolved.rows": sum(1 for _ in read_csv(paths["resolved"])) if "resolved" in present else None,
        "discovered.rows": sum(1 for _ in read_csv(paths["discovered"])) if "discovered" in present else None,
    }

    # ---- pass 1: stream the big file once; keep only rows that can be bucketed
    items: list = []
    agg = Aggregates()
    stats = Counter()
    key_shapes = Counter()
    old_flagged_licences: set = set()
    audit_extra = Counter()
    with open(paths["menus"], encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            errors.lines += 1
            try:
                row = json.loads(line)
                if not isinstance(row, dict):
                    raise ValueError("not a JSON object")
            except ValueError as e:
                errors.add(paths["menus"].name, n, f"bad_json: {e}", line)
                continue
            stats["rows"] += 1
            key_shapes[len(row)] += 1
            it = make_item(n, row, ctx)
            raw_cell = str(row.get("stall_licence_no") or "").strip()
            if raw_cell and raw_cell not in ctx.master_names:
                stats["raw_cell_not_in_master_rows"] += 1
            if it.legacy:
                stats["legacy_rows"] += 1
                url_blank = not str(row.get("source_url") or "").strip()
                disclaimer = bool(DISCLAIMER_RE.search(str(row.get("description") or "")))
                if url_blank or disclaimer:
                    stats["legacy_verified_false_needed"] += 1
                    stats["legacy_blank_source_url"] += int(url_blank)
                    stats["legacy_disclaimer"] += int(disclaimer)
                    if row.get("verified") is True:
                        stats["legacy_flagged_but_verified_true"] += 1
                if not it.parts:
                    stats["empty_licence_rows"] += 1
                if "Q_NO_LICENCE" in classify(it, ctx)[0]:
                    items.append(it)
                continue
            stats["new_rows"] += 1
            if str(row.get("source") or "").strip().lower() == "brand_official_site" and str(row.get("crawl_timestamp") or "").startswith(BRAND_COPY_BATCH_PREFIX):
                audit_extra["brand_site_18h_rows"] += 1
            agg.add(it)
            items.append(it)
    agg.finish(ctx)

    # ---- pass 2: classify and (optionally) stream into staged files
    write = bool(args.write) and errors.rate <= args.max_error_rate
    staged = None
    over_threshold = errors.rate > args.max_error_rate
    code_rows, code_parts, code_cells = Counter(), defaultdict(set), defaultdict(set)
    bucket_rows, bucket_written, bucket_dups = Counter(), Counter(), Counter()
    bucket_parts: dict = defaultdict(set)
    bucket_entities: dict = defaultdict(Counter)
    samples: dict = defaultdict(list)
    fix_counts, flag_counts = Counter(), Counter()
    notes_counts = Counter()
    seen: dict = defaultdict(set)
    catalogue = BrandCatalogue()
    unrelated_note = Counter()
    run_id = uuid.uuid4().hex
    try:
        if write:
            out_dir.mkdir(parents=True, exist_ok=True)
            staged = StagedOutputs(out_dir, run_id)
            for b in BUCKET_FILES.values():
                staged.open(b)
        for it in items:
            codes, facts = classify(it, ctx)
            if it.legacy and not codes:
                continue
            bucket = bucket_for(codes)
            bucket_rows[bucket] += 1
            bucket_entities[bucket][it.entity] += 1
            bucket_parts[bucket].update(it.parts)
            for c in codes:
                code_rows[c] += 1
                code_parts[c].update(it.parts)
                code_cells[c].add(it.entity)
                if "Q_NO_LICENCE" == c:
                    if not it.parts:
                        notes_counts["Q_NO_LICENCE.empty_rows"] += 1
                    else:
                        notes_counts["Q_NO_LICENCE.not_in_master_rows"] += 1
                if len(samples[c]) < SAMPLES_PER_CODE:
                    samples[c].append({"stall_name": it.row.get("stall_name"), "licence": it.row.get("stall_licence_no")})
            if bucket == "QUARANTINE" and "D_BRAND_COPY" in codes and set(codes) - {"D_BRAND_COPY"} == {"Q_URL_OWNED_BY_OTHER_LICENCE"}:
                unrelated_note["d_brand_copy_rows_quarantined_only_by_url_ownership"] += 1
            if facts.get("url_ownership") == "shared_same_brand":
                notes_counts["url_shared_same_brand_exempted_rows"] += 1
            out = dict(it.row)
            fixes: list = []
            base_fields(out, fixes)
            if bucket in ("KEEP_CONDITIONAL", "DOWNGRADE"):
                hygiene(out, bucket, fixes)
                if bucket == "DOWNGRADE":
                    catalogue.add(it, out)
                nn = mm.norm_name(out.get("item_name"))
                if nn:
                    dk = (it.entity, nn, price_key(it.price))
                    if dk in seen[bucket]:
                        bucket_dups[bucket] += 1
                        continue
                    seen[bucket].add(dk)
                for flag in ("price_review", "image_thumbnail", "timestamp_tz_missing"):
                    flag_counts[flag] += int(bool(out.get(flag)))
            for fx in fixes:
                fix_counts[fx.split("(")[0]] += 1
            out["bucket"], out["reason_codes"], out["fixes"] = bucket, codes, fixes
            if facts.get("review_reason"):
                out["review_reason"] = facts["review_reason"]
            out["slice"] = "legacy" if it.legacy else "new"
            bucket_written[bucket] += 1
            if staged:
                staged.handles[BUCKET_FILES[bucket]].write(json.dumps(out, ensure_ascii=False, sort_keys=True) + "\n")

        # ---- report
        actual = {
            "menus.rows": stats["rows"], "menus.legacy_rows": stats["legacy_rows"], "master.rows": master_rows,
            "crosswalk.rows": cw_rows, "review.rows": review_rows, **{k: v for k, v in counts.items() if v is not None},
            "Q_CROSSWALK_LICENSE.rows": code_rows["Q_CROSSWALK_LICENSE"], "Q_CROSSWALK_LICENSE.licences": len(code_parts["Q_CROSSWALK_LICENSE"]),
            "Q_UNREPORTED_BATCH.rows": code_rows["Q_UNREPORTED_BATCH"], "Q_UNREPORTED_BATCH.licences": len(code_parts["Q_UNREPORTED_BATCH"]),
            "Q_REVIEW_LICENCE.rows": code_rows["Q_REVIEW_LICENCE"],
            "Q_NO_LICENCE.empty_rows": notes_counts["Q_NO_LICENCE.empty_rows"],
            "Q_NO_LICENCE.not_in_master_rows": notes_counts["Q_NO_LICENCE.not_in_master_rows"],
            "Q_NO_LICENCE.not_in_master_rows_unsplit": stats["raw_cell_not_in_master_rows"],
            "D_BRAND_COPY.brand_site_18h_rows": audit_extra["brand_site_18h_rows"],
        }
        cat_records = catalogue.records()
        cat_map = catalogue.outlet_map(ctx, cat_records)
        cat_stats = {**catalogue.stats(cat_records), "outlet_map_rows": len(cat_map)}
        comparison = [{"key": k, "expected": exp, "actual": actual.get(k), "match": actual.get(k) == exp, "what": what}
                      for k, exp, what in EXPECTED if k in actual]
        notes = [
            "Legacy (DD-MM-YYYY) rows are not bucketed; only Q_NO_LICENCE is applied to them. They are counted below.",
            "Q_NO_LICENCE not-in-master is counted after splitting multi-licence cells on ';' as instructed. "
            f"Counting the raw cell without splitting gives {stats['raw_cell_not_in_master_rows']}.",
            "Each outlet licence maps to its brand catalogue by brand key only (see brand_outlet_map.csv). Catalogue rows are brand-level, "
            "are not copied onto outlets and must not be shown as outlet menus. Only DOWNGRADE rows feed the catalogue: wrong-host, "
            "quarantined and re-source rows never do.",
            "Q_URL_NOT_OWN_MASTER_URL is an added code: KEEP_CONDITIONAL requires source_url to be the licence's own master Menu URL.",
            f"R_NO_PRICE_BRAND needs >= {MIN_NULL_PRICE_ROWS} rows on the licence; Q_SHARED_DISH_SET_UNRELATED needs >= {MIN_SHARED_SET} dishes in the set.",
        ]
        if over_threshold:
            notes.append(f"ERROR RATE {errors.rate:.4%} exceeds {args.max_error_rate:.4%}: nothing was written except errors.")
        report = {
            "schema": 1,
            "same_brand_url_policy": ctx.same_brand_url_policy,
            "inputs": {k: {"bytes": present[k].stat().st_size} for k in sorted(present)},
            "optional_inputs_missing": optional,
            "totals": {"rows_read": stats["rows"], "legacy_rows": stats["legacy_rows"], "new_rows": stats["new_rows"],
                       "rows_with_17_keys": key_shapes[17], "rows_other_key_count": stats["rows"] - key_shapes[17],
                       "bad_lines": len(errors.entries), "error_rate": round(errors.rate, 8),
                       "legacy_rows_untouched": stats["legacy_rows"] - sum(1 for i in items if i.legacy)},
            "legacy_slice": {k: stats[k] for k in ("legacy_verified_false_needed", "legacy_blank_source_url", "legacy_disclaimer",
                                                   "legacy_flagged_but_verified_true", "empty_licence_rows")},
            "buckets": {b: {"classified": bucket_rows[b], "duplicates_removed": bucket_dups[b], "written": bucket_written[b],
                            "licences": len(bucket_parts[b])} for b in SEVERITY},
            "reason_codes": {c: {"rows": code_rows[c], "licences": len(code_parts[c]), "licence_cells": len(code_cells[c])} for c in sorted(CODE_BUCKET)},
            "top_licences": {b: top_licences(bucket_entities[b]) for b in SEVERITY},
            "samples": {c: samples[c] for c in sorted(samples)},
            "crosswalk_file": {"rows": cw_rows, "licences": cw_licences, "quarantined_as_file": "quarantined_crosswalk_menu_urls.csv"},
            "fix_counts": dict(sorted(fix_counts.items())),
            "flag_counts": dict(sorted(flag_counts.items())),
            "interplay": {**dict(unrelated_note), "url_shared_same_brand_exempted_rows": notes_counts["url_shared_same_brand_exempted_rows"],
                          "d_brand_copy_rows_total": code_rows["D_BRAND_COPY"]},
            "expected_vs_actual": comparison,
            "mismatches": [c for c in comparison if not c["match"]],
            "notes": notes,
            "brand_catalogue": cat_stats,
        }

        files = None
        if write:
            hashes_after = {k: mm.sha256_of(p) for k, p in present.items()}
            if args.brand_domains:
                hashes_after["brand_domains"] = mm.sha256_of(Path(args.brand_domains))
            if hashes_after != hashes_before:
                raise QuarantineError("A source file changed while the run was in progress; outputs discarded", 6)
            manifest = {"schema": 1, "inputs": {k: {"path": str(p), "sha256": hashes_before[k], "bytes": p.stat().st_size} for k, p in sorted(present.items())},
                        "inputs_unchanged_after_run": True, "script": script_provenance()}
            if args.brand_domains:
                manifest["inputs"]["brand_domains"] = {"path": str(args.brand_domains), "sha256": hashes_before["brand_domains"]}
            staged.put_text("report.json", json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
            staged.put_text("report.md", report_markdown(report))
            staged.put_text("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
            staged.put_text("errors.jsonl", "".join(json.dumps(e, ensure_ascii=False, sort_keys=True) + "\n" for e in errors.entries))
            staged.put_text("brand_catalogue.jsonl", "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in cat_records))
            staged.put_text("brand_outlet_map.csv", outlet_map_csv(cat_map))
            staged.put_copy("quarantined_crosswalk_menu_urls.csv", paths["crosswalk"])
            files = {"run_id": run_id}
            staged.commit()
            run_meta = {"run_id": run_id, "finished_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        "mode": "write", "exit_code": 0}
            mm.atomic_write_text(out_dir / "run.json", json.dumps(run_meta, indent=2, sort_keys=True) + "\n")
    except BaseException:
        if staged:
            staged.abort()
        raise
    if over_threshold and args.write:
        out_dir.mkdir(parents=True, exist_ok=True)
        mm.atomic_write_text(out_dir / "errors.jsonl", "".join(json.dumps(e, ensure_ascii=False, sort_keys=True) + "\n" for e in errors.entries))
    return (5 if over_threshold else 0), report, files, errors.entries


def report_markdown(r: dict) -> str:
    L = ["# Menu run quarantine report", ""]
    t = r["totals"]
    L += [f"Rows read: {t['rows_read']} (legacy {t['legacy_rows']}, new {t['new_rows']}); bad lines {t['bad_lines']} (rate {t['error_rate']:.6f}).", ""]
    L += ["## Buckets", "", "| bucket | classified | duplicates removed | written | licences |", "|---|---:|---:|---:|---:|"]
    for b in SEVERITY:
        x = r["buckets"][b]
        L.append(f"| {b} | {x['classified']} | {x['duplicates_removed']} | {x['written']} | {x['licences']} |")
    L += ["", "## Reason codes (a row can carry several)", "", "| code | rows | licences | licence cells |", "|---|---:|---:|---:|"]
    for c, x in r["reason_codes"].items():
        L.append(f"| {c} | {x['rows']} | {x['licences']} | {x['licence_cells']} |")
    L += ["", "## Expected (audit) vs actual", "", "| key | expected | actual | |", "|---|---:|---:|---|"]
    for c in r["expected_vs_actual"]:
        L.append(f"| {c['key']} | {c['expected']} | {c['actual']} | {'ok' if c['match'] else '**MISMATCH**'} |")
    if r["mismatches"]:
        L += ["", "**MISMATCHES: " + ", ".join(m["key"] for m in r["mismatches"]) + "**"]
    bc = r["brand_catalogue"]
    L += ["", "## Brand catalogue (DOWNGRADE rows only; brand level, not outlet menus)", "",
          f"- rows: {bc['rows']}; brands: {bc['brands']}; outlet licences observed: {bc['outlet_licences']}; brand_outlet_map.csv rows: {bc['outlet_map_rows']}",
          f"- brands with the same dish at different prices: {bc['brands_with_price_conflicts']}; brands whose catalogue is mostly priceless: {bc['brands_mostly_priceless']}",
          "- top brands by outlet_count: " + (", ".join(f"{b['brand']} ({b['outlet_count']} outlets, {b['rows']} rows)" for b in bc["top_brands_by_outlet_count"]) or "none"),
          "- Each outlet licence maps to its brand catalogue by brand key only (brand_outlet_map.csv); catalogue rows are not copied onto outlets."]
    L += ["", "## Legacy slice (not bucketed)", ""] + [f"- {k}: {v}" for k, v in r["legacy_slice"].items()]
    L += ["", "## Interplay and fixes", ""] + [f"- {k}: {v}" for k, v in r["interplay"].items()]
    L += [f"- fixes: {json.dumps(r['fix_counts'], sort_keys=True)}", f"- flags: {json.dumps(r['flag_counts'], sort_keys=True)}"]
    L += ["", "## Top 10 licences per bucket", ""]
    for b, rows in r["top_licences"].items():
        L.append(f"- {b}: " + (", ".join(f"{k} ({v})" for k, v in rows) or "none"))
    L += ["", "## Samples (stall name, licence)", ""]
    for c, rows in r["samples"].items():
        L.append(f"- {c}: " + "; ".join(f"{s['stall_name']!r} / {s['licence']!r}" for s in rows))
    L += ["", "## Notes", ""] + [f"- {n}" for n in r["notes"]]
    return "\n".join(L) + "\n"


def main(argv=None, *, free_fn: Callable = mm.disk_free) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--input-dir", required=True)
    ap.add_argument("--master", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--date", default="2026-11-08")
    ap.add_argument("--brand-domains", default=None, help="optional JSON {brand name: [allowed domains]}")
    ap.add_argument("--write", action="store_true", help="write outputs (default is a dry run that writes nothing)")
    ap.add_argument("--max-error-rate", type=float, default=MAX_ERROR_RATE)
    ap.add_argument("--same-brand-url-policy", choices=("strict", "sidecar"), default="strict",
                    help="strict (default): a URL listed only on other licences is Q_URL_OWNED_BY_OTHER_LICENCE even for sibling outlets; "
                         "sidecar: when every owner is the same brand as the row, do not quarantine for it (brand rows can then land in DOWNGRADE)")
    args = ap.parse_args(argv)
    try:
        code, report, _files, errs = run(args, free_fn)
    except mm.MergeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return getattr(e, "exit_code", 2)
    print(("WRITE" if args.write else "DRY RUN (nothing written)") + f" -> {args.out_dir}")
    print(report_markdown(report))
    for m in report["mismatches"]:
        print(f"!!! MISMATCH {m['key']}: expected {m['expected']}, actual {m['actual']} ({m['what']})")
    if code:
        print(f"ERROR: {len(errs)} bad line(s), error rate above {args.max_error_rate:.4%}", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())
