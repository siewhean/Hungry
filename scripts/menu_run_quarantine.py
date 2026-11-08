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
import itertools
import fnmatch
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from difflib import SequenceMatcher
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote_plus, urlsplit

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


# ---------------------------------------------------------------- brand identity from the FULL name

STOP_TOKENS = frozenset({"the", "and", "of", "at", "a", "an"})
TRAILING_OUTLET_WORDS = frozenset({"outlet", "outlets", "branch", "kiosk", "express", "store", "singapore", "sg"})
PLACE_WORDS = frozenset({"mall", "plaza", "square", "centre", "center", "hub", "point", "mrt", "station", "airport", "terminal", "tower",
                         "towers", "building", "complex", "junction", "hospital", "market", "hawker", "foodcourt", "interchange", "link"})
KEEP_PAREN_WORDS = frozenset({"halal", "vegetarian", "vegan", "muslim", "owned"})
GENERIC_LAST_WORDS = frozenset({"coffee", "cafe", "restaurant", "kitchen", "house", "bakery", "noodles", "tea", "food", "bar", "bistro",
                                "toast", "foods", "eatery", "stall", "shop"})
GENERIC_KEY_WORDS = frozenset({"coffee", "two", "fun", "song", "crave", "ahma", "ah", "tea", "cafe", "kopi", "kitchen", "house", "food", "one",
                               "new", "big", "little", "golden", "happy", "wok", "pizza", "each", "the", "han", "ya", "old"})
UNIT_NO_RE = re.compile(r"#\s*[a-z]{0,2}\d{1,3}[a-z]?\s*[-–]\s*[a-z0-9/]+")
LEGAL_RE = re.compile(r"\b(?:pte\.?\s*ltd\.?|pty\.?\s*ltd\.?|private\s+limited|llp|sdn\.?\s*bhd\.?|ltd\.?|inc\.?)(?=\W|$)")
JACCARD_MIN = 0.5
FUZZY_MIN = 0.9


def fold(value) -> str:
    """Lowercase, decode entities, strip accents, collapse whitespace."""
    s = unicodedata.normalize("NFKD", mm.clean_text(value))
    return "".join(c for c in s if not unicodedata.combining(c)).casefold()


def _phrase(s: str) -> str:
    return " ".join(re.findall(r"[^\W_]+", s.replace("&", " and ").replace("’", "").replace("'", "")))


def build_places(addresses) -> frozenset:
    """Place phrases (street names, building names, MRT names) taken from the master's own Full Address column."""
    out: set = set()
    for addr in addresses:
        for i, seg in enumerate(str(addr or "").split(",")):
            s = fold(seg)
            if not s or s.startswith("#") or re.match(r"^(?:singapore\b|\(?level\b)", s):
                continue
            s = UNIT_NO_RE.sub(" ", s)
            s = re.sub(r"#\S+", " ", s)
            s = re.sub(r"\bsingapore\s*\d{6}.*$", "", s)
            if i == 0:
                s = re.sub(r"^(?:blk\s+|block\s+)?\d+[a-z]?(?:/\d+[a-z]?)?\s+", "", s)
            ph = _phrase(s)
            if len(ph) >= 4:
                out.add(ph)
            for suffix in (" mrt station", " mrt"):
                if ph.endswith(suffix) and len(ph) - len(suffix) >= 4:
                    out.add(ph[: -len(suffix)])
    return frozenset(out)


def core_name(name, places: frozenset = frozenset()) -> str:
    """Brand core: no unit numbers, legal suffixes, outlet/branch qualifiers or place names; distinguishing words kept."""
    s = fold(name)
    s = UNIT_NO_RE.sub(" ", s)
    s = re.sub(r"\s[-–—]\s.*$", "", s)  # " - Plaza Singapura"
    s = re.sub(r"\s*@.*$", "", s)  # "@ Jewel"
    m = re.search(r"\bat\s+(.+)$", s)
    if m and s[: m.start()].strip():
        tail = _phrase(m.group(1))
        if tail in places or set(tail.split()) & PLACE_WORDS:
            s = s[: m.start()]
    for _ in range(3):  # legal suffix and trailing "(place)" in either order
        s = LEGAL_RE.sub(" ", s).strip()
        m = re.search(r"\s*\(([^()]*)\)\s*$", s)
        if m and s[: m.start()].strip() and not (set(_phrase(m.group(1)).split()) & KEEP_PAREN_WORDS):
            s = s[: m.start()]
    toks = _phrase(s).split()
    if len(toks) > 1 and toks[0] == "the":
        toks = toks[1:]
    while True:
        while len(toks) > 1 and toks[-1] in TRAILING_OUTLET_WORDS:
            toks.pop()
        for n in range(min(6, len(toks) - 2), 0, -1):  # trailing place phrase, always leaving >= 2 words
            if " ".join(toks[-n:]) in places:
                toks = toks[:-n]
                break
        else:
            break
    return " ".join(toks)


def sig_tokens(core: str) -> list:
    return [t for t in core.split() if t not in STOP_TOKENS]


def token_sort_ratio(a: str, b: str) -> float:
    """Token-sorted similarity. No subset shortcut: a name that merely contains the other is not 'equal'."""
    return SequenceMatcher(None, " ".join(sorted(a.split())), " ".join(sorted(b.split()))).ratio()


def _bound(x: int, y: int) -> float:
    return 2 * min(x, y) / (x + y)


def names_match(a: str, b: str) -> Optional[str]:
    """NAME_EQUAL, NAME_FUZZY (token-sorted or spacing-insensitive ratio >= 0.9, significant words differ by <= 1) or None."""
    if not a or not b:
        return None
    if a == b:
        return "NAME_EQUAL"
    ca, cb = a.replace(" ", ""), b.replace(" ", "")
    if abs(len(sig_tokens(a)) - len(sig_tokens(b))) > 1 or max(_bound(len(a), len(b)), _bound(len(ca), len(cb))) < FUZZY_MIN:
        return None
    if max(token_sort_ratio(a, b), SequenceMatcher(None, ca, cb).ratio()) >= FUZZY_MIN:
        return "NAME_FUZZY"
    return None


def url_root(u) -> str:
    """Host of a first-party page; the whole page for delivery platforms and shared widget/CDN hosts (those are per-outlet)."""
    u = str(u or "").strip()
    if not u:
        return ""
    host = host_of(u)
    if not host:
        return ""
    if any(m in host for m in DELIVERY_HOST_MARKERS) or any(host_matches(host, x) for x in BAD_HOST_SUFFIXES) or any(c in host for c in BAD_HOST_CONTAINS):
        return norm_url(u)
    return host


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


@dataclass
class LicInfo:
    licence: str
    master_name: str
    core: str
    roots: set = field(default_factory=set)
    dishes: set = field(default_factory=set)
    row_names: set = field(default_factory=set)
    rows: int = 0
    excluded: int = 0


def corroboration(a: LicInfo, b: LicInfo) -> list:
    """Evidence codes beyond the name: same host root, dish-set overlap. Returns [] when there is none."""
    codes = []
    if a.roots & b.roots:
        codes.append("CORROB_URL")
    if jaccard(a.dishes, b.dishes) >= JACCARD_MIN:
        codes.append("CORROB_DISHES")
    return codes


def first_word_info(name) -> tuple:
    """The OLD key logic: (key, joined_short_first_word)."""
    s = re.sub(r"\(.*?\)", " ", re.sub(r"[’'`]", "", mm.clean_text(name).casefold()))
    toks = re.findall(r"[^\W_]+", s)
    if toks and toks[0] == "the" and len(toks) > 1:
        toks = toks[1:]
    if not toks:
        return "", False
    if len(toks[0]) < 3 and len(toks) > 1:
        return toks[0] + toks[1], True
    return toks[0], False


def core_pattern(p: str) -> str:
    return " ".join(_phrase(fold(p)).split())


def match_pattern(pattern: str, licence: str, name: str, core: str = "") -> bool:
    """A pattern is a licence number, 'core:<normalised core name>' (exact core), or a case-insensitive wildcard on the master name."""
    p = str(pattern).strip()
    if not p:
        return False
    if p.lower().startswith("core:"):
        return bool(core) and core == core_pattern(p[5:])
    if p.lower().startswith("licence:"):
        p = p[8:].strip()
    return p.upper() == licence.upper() or fnmatch.fnmatchcase(fold(name), fold(p))


def _groups(data: dict, kind: str) -> tuple:
    groups = data.get(kind) or []
    if not isinstance(groups, list) or not all(isinstance(g, list) and all(isinstance(x, str) for x in g) for g in groups):
        raise QuarantineError(f"brand_overrides '{kind}' must be a list of lists of strings", 2)
    meta = data.get(kind + "_meta") or []
    if not isinstance(meta, list) or not all(isinstance(m, dict) for m in meta):
        raise QuarantineError(f"brand_overrides '{kind}_meta' must be a list of objects aligned with '{kind}'", 2)
    pairs = [(g, (meta[i] if i < len(meta) else {})) for i, g in enumerate(groups) if g]
    return [g for g, _ in pairs], [m for _, m in pairs]


def load_overrides(path: Optional[Path]) -> dict:
    """{'merge': [[pattern]], 'merge_meta': [{display_name, owner_decision, owner_checked, id}], 'split': [[pattern]], 'split_meta': [...],
    'hold_out': {licence: {...}}, 'row_conflicts': {licence: {...}}, 'metadata': {...}}. Plain 'merge'/'split' lists still work."""
    out: dict = {"merge": [], "merge_meta": [], "split": [], "split_meta": [], "hold_out": {}, "row_conflicts": {}, "metadata": {}}
    if not path:
        return out
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise QuarantineError(f"brand_overrides unreadable: {e}", 2)
    if not isinstance(data, dict):
        raise QuarantineError("brand_overrides must be a JSON object with 'merge' and/or 'split'", 2)
    for kind in ("merge", "split"):
        out[kind], out[kind + "_meta"] = _groups(data, kind)
    for kind in ("hold_out", "row_conflicts"):
        entries = data.get(kind) or []
        if not isinstance(entries, list) or not all(isinstance(e, dict) and isinstance(e.get("licence"), str) for e in entries):
            raise QuarantineError(f"brand_overrides '{kind}' must be a list of objects with a 'licence'", 2)
        out[kind] = {e["licence"].strip(): e for e in entries}
    out["metadata"] = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    return out


def row_names_brand(row_core: str, brand_core: str) -> bool:
    """Does a dish row's own stall name speak for this brand? Equal/fuzzy, or the brand words appear inside it (e.g. with a Chinese name)."""
    if not row_core or not brand_core:
        return True
    if names_match(row_core, brand_core):
        return True
    rt, bt = row_core.split(), brand_core.split()
    return any(rt[i:i + len(bt)] == bt for i in range(len(rt) - len(bt) + 1))


class BrandIdentity:
    """Brand key per licence. 'full-name': equal/fuzzy core name AND a corroborating signal (or an owner override).
    'first-word': the legacy first-word key, kept for comparison."""

    def __init__(self, mode: str = "full-name", places: frozenset = frozenset(), overrides: Optional[dict] = None):
        self.mode, self.places, self.overrides = mode, places, overrides or {"merge": [], "split": []}
        self.keys: dict = {}
        self.infos: dict = {}
        self.display: dict = {}
        self.evidence: dict = {}
        self.confidence: dict = {}
        self.competing: dict = {}
        self.owner: dict = {}  # licence -> {owner_decision, owner_checked, group_id}
        self.group_meta: dict = {}  # brand key -> same, for keys created by an owner merge
        self.group_members: list = []  # per merge group: member licences
        self._core_cache: dict = {}

    def core_of_name(self, name) -> str:
        c = self._core_cache.get(name)
        if c is None:
            c = self._core_cache[name] = core_name(name, self.places)
        return c

    def key_of(self, licence: str, default: str = "") -> str:
        return self.keys.get(licence, default)

    def same_brand_name(self, name_a: str, name_b: str) -> bool:
        """Name-level test used where the URL itself is the corroboration (URL listed on sibling outlets)."""
        if self.mode == "first-word":
            return first_word_info(name_a)[0] == first_word_info(name_b)[0] != ""
        return names_match(self.core_of_name(name_a), self.core_of_name(name_b)) is not None

    def _blocked(self, a: LicInfo, b: LicInfo) -> bool:
        for group in self.overrides["split"]:
            ia = {i for i, pat in enumerate(group) if match_pattern(pat, a.licence, a.master_name, a.core)}
            ib = {i for i, pat in enumerate(group) if match_pattern(pat, b.licence, b.master_name, b.core)}
            if ia and ib and not (ia & ib):
                return True
        return False

    def build(self, infos: dict) -> None:
        self.infos = infos
        lics = sorted(infos)
        if self.mode == "first-word":
            for lic in lics:
                k = first_word_info(infos[lic].master_name)[0] or "(unknown)"
                self.keys[lic], self.evidence[lic], self.confidence[lic], self.display[k] = k, ["FIRST_WORD"], "high", k
            return
        parent = {l: l for l in lics}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        ev: dict = defaultdict(set)
        unc: dict = defaultdict(set)
        linked: dict = defaultdict(set)
        by_core: dict = defaultdict(list)
        for lic in lics:
            by_core[infos[lic].core].append(lic)
        cand = []
        for core, ls in by_core.items():
            if core:
                cand += [(a, b, "NAME_EQUAL") for a, b in itertools.combinations(ls, 2)]
        cores = sorted(c for c in by_core if c)
        for i, c1 in enumerate(cores):
            for c2 in cores[i + 1:]:
                if names_match(c1, c2) == "NAME_FUZZY":
                    cand += [(a, b, "NAME_FUZZY") for a in by_core[c1] for b in by_core[c2]]
        hold = {l for l in self.overrides.get("hold_out", {}) if l in infos}
        for a, b, name_code in cand:
            if a in hold or b in hold:
                continue
            ia, ib = infos[a], infos[b]
            if self._blocked(ia, ib):
                ev[a].add("OVERRIDE_SPLIT")
                ev[b].add("OVERRIDE_SPLIT")
                continue
            corr = corroboration(ia, ib)
            if corr:
                parent[find(a)] = find(b)
                for x, y in ((a, b), (b, a)):
                    ev[x].update([name_code, *corr])
                    linked[x].add(y)
            else:
                unc[a].add(b)
                unc[b].add(a)
                ev[a].add(name_code + "_UNCORROBORATED")
                ev[b].add(name_code + "_UNCORROBORATED")
        for group in self.overrides["merge"]:
            members = [l for l in lics if l not in hold and any(match_pattern(pat, l, infos[l].master_name, infos[l].core) for pat in group)]
            self.group_members.append(members)
            for l in members:
                ev[l].add("OVERRIDE_MERGE")
                parent[find(l)] = find(members[0])
                if len(members) > 1:
                    linked[l].update(m for m in members if m != l)
        clusters: dict = defaultdict(list)
        for lic in lics:
            clusters[find(lic)].append(lic)
        canon: dict = {}
        for root, members in clusters.items():
            cnt = Counter(infos[m].core for m in members if infos[m].core)
            canon[root] = sorted(cnt, key=lambda c: (-cnt[c], len(c), c))[0] if cnt else ""
        by_canon: dict = defaultdict(list)
        for root in clusters:
            by_canon[canon[root]].append(root)
        for root, members in clusters.items():
            c = canon[root]
            key = c if len(by_canon[c]) == 1 and c else f"{c or '(unknown)'}~{min(members)}"
            names = Counter(infos[m].master_name for m in members if infos[m].master_name)
            self.display[key] = sorted(names, key=lambda n: (-names[n], len(n), n))[0] if names else key
            for m in members:
                self.keys[m] = key
        for gi, members in enumerate(self.group_members):
            if not members:
                continue
            meta = self.overrides["merge_meta"][gi] if gi < len(self.overrides["merge_meta"]) else {}
            key = self.keys[members[0]]
            info = {"owner_decision": meta.get("owner_decision", "merge"), "owner_checked": bool(meta.get("owner_checked", False)), "group_id": meta.get("id", f"merge{gi + 1}")}
            if meta.get("display_name"):
                self.display[key] = meta["display_name"]
            self.group_meta[key] = info
            for m in members:
                self.owner[m] = info
        for gi, group in enumerate(self.overrides["split"]):
            meta = self.overrides["split_meta"][gi] if gi < len(self.overrides["split_meta"]) else {}
            for lic in lics:
                if any(match_pattern(pat, lic, infos[lic].master_name, infos[lic].core) for pat in group):
                    ev[lic].add("OVERRIDE_SPLIT")
                    self.owner.setdefault(lic, {"owner_decision": "split", "owner_checked": bool(meta.get("owner_checked", False)), "group_id": meta.get("id", f"split{gi + 1}")})
        for lic in hold:
            ev[lic].add("OWNER_HOLD_OUT")
            h = self.overrides["hold_out"][lic]
            self.owner[lic] = {"owner_decision": h.get("owner_decision", "pending"), "owner_checked": bool(h.get("owner_checked", False)), "group_id": "hold_out"}
        for lic in lics:  # an owner merge (or a later link) can resolve what looked uncorroborated
            unc[lic] = {u for u in unc[lic] if find(u) != find(lic)}
            if not unc[lic]:
                ev[lic] = {c for c in ev[lic] if not c.endswith("_UNCORROBORATED")}
        # shares-a-word cases and confidence
        first_tok: dict = defaultdict(set)
        last_tok: dict = defaultdict(set)
        for lic in lics:
            toks = sig_tokens(infos[lic].core)
            if toks and len(toks[0]) >= 3:
                first_tok[toks[0]].add(infos[lic].core)
            if len(toks) > 1 and len(toks[-1]) >= 5 and toks[-1] not in GENERIC_LAST_WORDS:
                last_tok[toks[-1]].add(infos[lic].core)
        for lic in lics:
            info, codes, comp = infos[lic], set(ev[lic]), []
            cluster_cores = {infos[m].core for m in clusters[find(lic)]}
            toks = sig_tokens(info.core)
            for where, table, tok in (("FIRST", first_tok, toks[0] if toks else ""), ("LAST", last_tok, toks[-1] if toks else "")):
                others = sorted(c for c in table.get(tok, ()) if c not in cluster_cores and names_match(c, info.core) is None) if tok else []
                if others:
                    codes.add(f"SHARES_{where}_WORD:{tok}")
                    comp += others
            for u in sorted(unc[lic]):
                comp.append(f"{infos[u].master_name} [{u}]")
            if info.row_names and not any(row_names_brand(self.core_of_name(n), info.core) for n in info.row_names):
                codes.add("ROW_NAME_CONFLICT")
                comp += sorted(info.row_names)
            if len(clusters[find(lic)]) == 1 and not unc[lic]:
                codes.add("SINGLE_OUTLET")
            owner = self.owner.get(lic, {})
            if owner.get("owner_decision") == "merge" and not owner.get("owner_checked"):
                codes.add("OWNER_MERGE_UNCHECKED")
            if any(c.endswith("_UNCORROBORATED") for c in codes) or "OVERRIDE_SPLIT" in codes and linked[lic] or "OWNER_HOLD_OUT" in codes:
                conf = "low"
            elif "OWNER_MERGE_UNCHECKED" in codes:
                conf = "medium"
            elif "NAME_FUZZY" in codes or "ROW_NAME_CONFLICT" in codes or any(c.startswith("SHARES_") for c in codes) \
                    or (linked[lic] and "CORROB_URL" not in codes and "OVERRIDE_MERGE" not in codes):
                conf = "medium"
            else:
                conf = "high"
            self.evidence[lic], self.confidence[lic] = sorted(codes), conf
            self.competing[lic] = comp


# ---------------------------------------------------------------- old-key name review (reads an existing sidecar run)

REVIEW_COLUMNS = ["old_brand_key", "licence", "outlet_full_master_name", "normalised_core_name", "same_brand_as_key_anchor", "reason",
                  "first_word_key_flag", "distinct_core_names_under_key", "suggested_new_brand_key", "needs_owner_review"]


def old_key_review_rows(outlet_map: list, catalogue: list, master_names: dict, master_urls: dict, places: frozenset) -> list:
    """One row per (old brand key, licence). 'yes' needs a name match AND a corroborating signal; names alone never give 'yes'."""
    infos: dict = {}
    for lic in {r["licence"] for r in outlet_map}:
        name = master_names.get(lic, "")
        infos[lic] = LicInfo(lic, name, core_name(name, places), roots={url_root(master_urls.get(lic, ""))} - {""})
    for rec in catalogue:
        dish = mm.norm_name(rec.get("item_name"))
        root = url_root(rec.get("source_url"))
        for lic in rec.get("outlet_licences", []):
            if lic in infos:
                infos[lic].dishes.add(dish)
                if root:
                    infos[lic].roots.add(root)
    groups: dict = defaultdict(list)
    for r in outlet_map:
        groups[r["brand_key"]].append(r["licence"])
    rows = []
    for key in sorted(groups):
        lics = sorted(set(groups[key]))
        cnt = Counter(infos[l].core for l in lics)
        anchor = sorted(cnt, key=lambda c: (-cnt[c], len(c), c))[0]
        distinct = len(cnt)
        joined = any(first_word_info(infos[l].master_name)[1] for l in lics)
        flag = distinct > 1 or key in GENERIC_KEY_WORDS or joined
        anchor_lics = [l for l in lics if names_match(infos[l].core, anchor)]
        for lic in lics:
            info = infos[lic]
            nm = names_match(info.core, anchor)
            reason, verdict = "", "no"
            if nm:
                partners = [p for p in anchor_lics if p != lic]
                good = [(p, corroboration(info, infos[p])) for p in partners]
                good = [(p, c) for p, c in good if c]
                if good:
                    codes = sorted({c for _, c in good for c in c})
                    bits = [("core names equal" if nm == "NAME_EQUAL" else f"core names fuzzy-equal ({token_sort_ratio(info.core, anchor):.2f})")]
                    if "CORROB_URL" in codes:
                        bits.append("same source host")
                    if "CORROB_DISHES" in codes:
                        bits.append("dish overlap %.2f" % max(jaccard(info.dishes, infos[p].dishes) for p, _ in good))
                    verdict, reason = "yes", " + ".join(bits)
                elif not partners:
                    verdict, reason = ("yes", "anchor: only outlet with this core name") if len(lics) >= 1 and nm == "NAME_EQUAL" else ("uncertain", "fuzzy-equal to the anchor but no other outlet to corroborate")
                else:
                    verdict, reason = "uncertain", f"core name {'equal' if nm == 'NAME_EQUAL' else 'fuzzy-equal'} to anchor but no corroborating signal (host/dish overlap)"
            else:
                a_info = [infos[p] for p in anchor_lics]
                corr = sorted({c for a in a_info for c in corroboration(info, a)})
                t1, t2 = (sig_tokens(info.core) or [""])[0], (sig_tokens(anchor) or [""])[0]
                if len(corr) == 2:
                    verdict, reason = "uncertain", f"different core names ({info.core!r} vs {anchor!r}) but same source host and dish overlap: possible variant"
                elif t1 and t1 == t2:
                    reason = f"shares only first word '{t1}': {info.core!r} vs {anchor!r}"
                else:
                    reason = f"different chain: {info.core!r} vs {anchor!r}"
            if verdict == "yes":
                suggested = anchor
            elif verdict == "no":
                suggested = info.core or "(unknown)"
            else:
                suggested = f"{info.core or '(unknown)'}~{lic}"
            rows.append({"old_brand_key": key, "licence": lic, "outlet_full_master_name": info.master_name, "normalised_core_name": info.core,
                         "same_brand_as_key_anchor": verdict, "reason": reason, "first_word_key_flag": "TRUE" if flag else "FALSE",
                         "distinct_core_names_under_key": distinct, "suggested_new_brand_key": suggested,
                         "needs_owner_review": "TRUE" if (verdict == "uncertain" or (flag and distinct > 1)) else "FALSE"})
    return rows


def read_jsonl_file(path: Path) -> list:
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def write_new_csv(path: Path, columns: list, rows: list) -> None:
    """Create a NEW file atomically; refuse to overwrite anything."""
    path = Path(path)
    if path.exists():
        raise QuarantineError(f"Refusing to overwrite existing file: {path}", 2)
    for anc in [path.parent.resolve(), *path.parent.resolve().parents]:
        if (anc / ".git").exists():
            raise QuarantineError(f"Refusing to write inside a git repo: {path}", 2)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(buf.getvalue())
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)
        os.link(tmp, path)  # fails if the target appeared meanwhile: never replaces an existing file
    finally:
        Path(tmp).unlink(missing_ok=True)


def run_old_key_review(sidecar_dir: Path, master_path: Path, out_file: Path) -> dict:
    ctx = Ctx()
    load_master(master_path, ctx)
    sd = Path(sidecar_dir)
    omap = list(read_csv(sd / "brand_outlet_map.csv"))
    cat = read_jsonl_file(sd / "brand_catalogue.jsonl")
    rows = old_key_review_rows(omap, cat, ctx.master_names, ctx.master_urls, build_places(ctx.master_addresses))
    write_new_csv(out_file, REVIEW_COLUMNS, rows)
    keys = defaultdict(list)
    for r in rows:
        keys[r["old_brand_key"]].append(r)
    flagged = {k: v for k, v in keys.items() if v[0]["first_word_key_flag"] == "TRUE"}
    return {"rows": len(rows), "old_keys": len(keys), "flagged_keys": len(flagged),
            "keys_with_multiple_cores": sum(1 for v in keys.values() if v[0]["distinct_core_names_under_key"] > 1),
            "verdicts": dict(Counter(r["same_brand_as_key_anchor"] for r in rows)),
            "needs_owner_review": sum(1 for r in rows if r["needs_owner_review"] == "TRUE"),
            "flagged_names": {k: sorted({r["outlet_full_master_name"] for r in v}) for k, v in sorted(flagged.items())}}


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
    master_urls: dict = field(default_factory=dict)  # licence -> raw Menu URL
    master_addresses: list = field(default_factory=list)
    master_rows_lite: list = field(default_factory=list)  # (first licence, Full Address)
    hold_out: set = field(default_factory=set)  # licences the owner holds out of any brand merge
    identity: Optional[object] = None

    def same_brand_owner(self, it, owner: str) -> bool:
        """Is a master licence that lists this URL the same brand as the row? The shared URL is the corroboration."""
        ident = self.identity
        if ident is None:
            return False
        key = ident.key_of(owner)
        return bool(key) and key == it.brand or ident.same_brand_name(it.name, self.master_names.get(owner, ""))

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
        ctx.master_addresses.append(r.get("Full Address") or "")
        ctx.master_rows_lite.append((next(iter(split_licences(r.get("SFA Licence"))), ""), r.get("Full Address") or ""))
        for lic in split_licences(r.get("SFA Licence")):
            ctx.master_names.setdefault(lic, name)
            ctx.master_urls.setdefault(lic, (r.get("Menu URL") or "").strip())
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
    old_brand: str = ""


def make_item(line: int, row: dict, ctx: Ctx) -> Item:
    parts = split_licences(row.get("stall_licence_no"))
    master_name = next((ctx.master_names[p] for p in parts if ctx.master_names.get(p)), "")
    name = master_name or str(row.get("stall_name") or "")
    return Item(line, row, is_legacy(row), entity_of(row), parts, name, brand_key(name), price_of(row), brand_key(name))


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
    others = owners - mine
    if not others:
        return "own"
    same = all(ctx.same_brand_owner(it, o) for o in others)
    if owners & mine:
        return "shared_same_brand" if same else "shared_unrelated"
    if ctx.same_brand_url_policy == "sidecar" and same:
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
            held = [e for e in ents if e in ctx.hold_out]  # owner holds these out of the brand: they cannot make the others "unrelated"
            rest = [e for e in ents if e not in ctx.hold_out]
            if len({self.entity_brand[e] for e in rest}) > 1:
                ctx.unrelated_entities.update(ents)
            elif held and rest:
                ctx.unrelated_entities.update(held)
                ctx.samebrand_entities.update(rest)
            elif len(rest) >= 2:
                ctx.samebrand_entities.update(rest)


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

    def __init__(self, identity: Optional[BrandIdentity] = None):
        self.rows: dict = {}
        self.identity = identity

    def add(self, it: Item, out: dict) -> None:
        nn = mm.norm_name(out.get("item_name"))
        if not nn:
            return
        brand = it.brand or "(unknown)"
        key = (brand, nn, price_key(it.price))
        rec = self.rows.get(key)
        if rec is None:
            rec = self.rows[key] = {
                "brand": brand, "brand_display_name": (self.identity.display.get(brand) if self.identity else None) or it.name, "item_name": out.get("item_name"), "category": out.get("category"),
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



# ---------------------------------------------------------------- shared brand menu, outlet exceptions, resolution

MIN_FULL_MENU_DISHES = 10  # an outlet-level page with at least this many dishes counts as a "full menu"
MIN_FULL_MENU_COVERAGE = 0.5  # ... and it must contain at least this share of the brand's dishes
BRAND_WARNING = "WARNING: lines labelled brand_shared are brand-level catalogue entries and are NOT verified for this outlet."


def csv_text(columns: list, rows: list) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n", extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def build_baseline(records: list) -> dict:
    """{brand: {dish_key: {item_name, observed:[{price, outlet_count}], baseline_price, tie, conflict}}}.
    Baseline = the modal non-null price by number of outlets; every observed price is kept."""
    raw: dict = defaultdict(dict)
    for r in records:
        dk = mm.norm_name(r.get("item_name"))
        if not dk:
            continue
        d = raw[r["brand"]].setdefault(dk, {"item_name": r.get("item_name"), "prices": defaultdict(set)})
        p = price_of(r)
        if p is not None:
            d["prices"][price_key(p)].update(r.get("outlet_licences", []))
    out: dict = {}
    for brand, dishes in raw.items():
        out[brand] = {}
        for dk, d in dishes.items():
            observed = sorted(({"price": float(pk), "outlet_count": len(o)} for pk, o in d["prices"].items()), key=lambda x: x["price"])
            modal, tie = None, False
            if observed:
                top = max(o["outlet_count"] for o in observed)
                best = [o for o in observed if o["outlet_count"] == top]
                modal, tie = best[0]["price"], len(best) > 1
            out[brand][dk] = {"item_name": d["item_name"], "observed": observed, "baseline_price": modal, "tie": tie, "conflict": len(observed) > 1}
    return out


def conflict_rows(baseline: dict, display: dict) -> list:
    rows = []
    for brand in sorted(baseline):
        for dk in sorted(baseline[brand]):
            d = baseline[brand][dk]
            if d["conflict"]:
                prices = [o["price"] for o in d["observed"]]
                rows.append({"brand": brand, "brand_display_name": display.get(brand, brand), "dish": d["item_name"],
                             "prices_to_outlet_count": " | ".join(f"{o['price']:.2f}->{o['outlet_count']}" for o in d["observed"]),
                             "distinct_prices": len(prices), "min_price": f"{min(prices):.2f}", "max_price": f"{max(prices):.2f}",
                             "spread": f"{max(prices) - min(prices):.2f}", "outlets_total": sum(o["outlet_count"] for o in d["observed"]),
                             "status": "needs outlet-level confirmation"})
    return rows


CONFLICT_COLUMNS = ["brand", "brand_display_name", "dish", "prices_to_outlet_count", "distinct_prices", "min_price", "max_price", "spread",
                    "outlets_total", "status"]


def build_exceptions(baseline: dict, evidence: list, ctx: Ctx, identity: BrandIdentity) -> list:
    """Outlet-level exceptions to the shared brand menu. `evidence` holds (Item, output row) pairs from KEEP_CONDITIONAL / DOWNGRADE rows
    whose source URL is the licence's own (no other licence lists it). Quarantined and re-source rows are never evidence."""
    per: dict = defaultdict(lambda: {"dishes": {}, "brand": ""})
    for it, out in evidence:
        dk = mm.norm_name(out.get("item_name"))
        if not dk:
            continue
        for lic in it.parts:
            e = per[lic]
            e["brand"] = it.brand
            e["dishes"].setdefault(dk, (it, out))
    exc = []

    def base(lic, brand, typ, dish, dk, it, out, conf, auto):
        d = baseline.get(brand, {}).get(dk)
        return {"licence": lic, "outlet_name": ctx.master_names.get(lic, ""), "brand": brand,
                "brand_display_name": identity.display.get(brand, brand), "type": typ, "dish": dish,
                "outlet_price": (float(price_key(price_of(out))) if out is not None and price_of(out) is not None else None),
                "baseline_price": d["baseline_price"] if d else None,
                "observed_brand_prices": d["observed"] if d else [], "confidence": conf, "auto_apply": auto,
                "source_url": (out or {}).get("source_url"), "crawl_timestamp": (out or {}).get("crawl_timestamp"),
                "price_basis": "unknown", "verified": False}

    for lic in sorted(per):
        e = per[lic]
        brand = e["brand"]
        shared = baseline.get(brand)
        if not shared:
            continue  # no brand menu to compare with
        for dk in sorted(e["dishes"]):
            it, out = e["dishes"][dk]
            d = shared.get(dk)
            if d is None:
                exc.append(base(lic, brand, "OUTLET_ONLY_ITEM", out.get("item_name"), dk, it, out, "medium", False))
                continue
            price = price_of(out)
            if price is not None and d["baseline_price"] is not None and float(price_key(price)) != d["baseline_price"]:
                exc.append(base(lic, brand, "PRICE_DIFF", out.get("item_name"), dk, it, out, "medium", False))
        present = set(e["dishes"]) & set(shared)
        if len(e["dishes"]) >= MIN_FULL_MENU_DISHES and len(present) / len(shared) >= MIN_FULL_MENU_COVERAGE:
            sample = next(iter(e["dishes"].values()))[1]
            for dk in sorted(set(shared) - present):
                rec = base(lic, brand, "NOT_OFFERED_CANDIDATE", shared[dk]["item_name"], dk, None, sample, "low", False)
                rec["outlet_price"] = None
                exc.append(rec)
    return sorted(exc, key=lambda r: (r["licence"], r["type"], mm.norm_name(r["dish"])))



# ---------------------------------------------------------------- Google names (local data only), outlet locations, display names

GOOGLE_COLUMNS = ["SFA Licence", "Google Name", "Google Place ID", "Source"]
APPLIED_SUFFIX = "_overrides_applied"


def google_name_from_url(url) -> str:
    """The place name inside a saved Google Maps URL (.../maps/place/<Name>/@...). Nothing is fetched."""
    m = re.search(r"/maps/place/([^/@?]+)", str(url or ""))
    if not m or m.group(1).startswith(("data=", "@")):
        return ""
    return mm.clean_text(unquote_plus(m.group(1)))


def extract_google_names(workbook: Path, out_csv: Path, sheet: str = "Food Directory") -> int:
    """One-off helper: read licence + Google Place ID + Google Maps URL from a local directory workbook and write a small CSV."""
    try:
        import openpyxl  # optional dependency, only for this helper
    except ImportError as e:  # pragma: no cover
        raise QuarantineError(f"openpyxl is needed to read the workbook: {e}", 2)
    wb = openpyxl.load_workbook(workbook, read_only=True, data_only=True)
    rows = wb[sheet].iter_rows(values_only=True)
    hdr = next(rows)
    ix = {h: i for i, h in enumerate(hdr)}
    for need in ("SFA Licence", "Google Maps URL"):
        if need not in ix:
            raise QuarantineError(f"column {need!r} not found on sheet {sheet!r}", 2)
    out = []
    for r in rows:
        lic = str(r[ix["SFA Licence"]] or "").strip()
        name = google_name_from_url(r[ix["Google Maps URL"]])
        if lic and name:
            out.append({"SFA Licence": lic, "Google Name": name, "Google Place ID": r[ix["Google Place ID"]] or "" if "Google Place ID" in ix else "",
                        "Source": f"{Path(workbook).name} / {sheet} / Google Maps URL path"})
    write_new_csv(out_csv, GOOGLE_COLUMNS, sorted(out, key=lambda x: x["SFA Licence"]))
    return len(out)


def read_google_names(path: Optional[Path]) -> dict:
    if not path:
        return {}
    return {r["SFA Licence"].strip(): r["Google Name"].strip() for r in read_csv(Path(path)) if r.get("SFA Licence") and r.get("Google Name")}


_LATIN = re.compile(r"[A-Za-z]")


def location_from_google(google_name: str, brand_display: str) -> str:
    """The part of a Google name that follows the brand: '(Place)', ' - Place', '@ Place', ' at Place' or trailing words. '' if none."""
    g = mm.clean_text(google_name)
    for pat in (r"\s*\(([^()]+)\)\s*$", r"\s[-–—]\s+(.+)$", r"\s*@\s*(.+)$", r"\bat\s+(.+)$"):
        m = re.search(pat, g)
        if m and g[: m.start()].strip() and _LATIN.search(m.group(1)):
            return m.group(1).strip(" -–—,:")
    gf, bf = fold(g), fold(brand_display)
    if bf and gf.startswith(bf) and len(g) > len(brand_display):
        rest = g[len(brand_display):].strip(" -–—,:@()")
        if _LATIN.search(rest):
            return rest
    return ""


def master_location(address: str) -> str:
    """Building name, else street name, from the master's own Full Address. Not Google."""
    segs = [x.strip() for x in str(address or "").split(",")]
    for i, seg in enumerate(segs):
        s = fold(seg)
        if i == 0 or not s or s.startswith("#") or re.match(r"^(?:singapore\b|\(?level\b)", s):
            continue
        return mm.clean_text(seg).title()
    street = re.sub(r"#\S+", " ", segs[0] if segs else "")
    street = re.sub(r"^\s*(?:blk\s+|block\s+)?\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?\s+", "", street)
    street = re.sub(r"\bSingapore\s*\d{6}.*$", "", street, flags=re.I)
    return mm.clean_text(street).title()


DISPLAY_COLUMNS = ["licence", "master_name", "brand_key", "brand_display_name", "google_name", "outlet_location", "display_name", "location_source",
                   "google_name_available", "menu_url_conflict", "note", "owner_decision", "owner_checked"]


def display_name_rows(identity: BrandIdentity, ctx: Ctx, google: dict, overrides: dict) -> list:
    """Display field only: brand display name + outlet location for chain outlets. The master name is never altered."""
    counts = Counter(identity.keys.values())
    addr = {}
    for r in ctx.master_rows_lite:
        addr.setdefault(r[0], r[1])
    rows = []
    for lic in sorted(identity.infos):
        key = identity.keys[lic]
        bdn = identity.display.get(key, key)
        g = google.get(lic, "")
        loc, src = (location_from_google(g, bdn) if g else ""), "google_name"
        if not loc:
            loc, src = master_location(addr.get(lic, "")), "master_address"
        chain = counts[key] >= 2
        owner = identity.owner.get(lic, {})
        conflict = lic in overrides.get("row_conflicts", {})
        note = []
        if conflict:
            note.append("master Menu URL points to a different restaurant")
        if not g:
            note.append("no Google name offline; location from master address, not Google")
        elif src == "master_address":
            note.append("Google name has no location part; location from master address, not Google")
        rows.append({"licence": lic, "master_name": identity.infos[lic].master_name, "brand_key": key, "brand_display_name": bdn, "google_name": g,
                     "outlet_location": loc, "display_name": f"{bdn} ({loc})" if chain and loc else bdn, "location_source": src if loc else "none",
                     "google_name_available": "true" if g else "false", "menu_url_conflict": "true" if conflict else "false",
                     "note": "; ".join(note), "owner_decision": owner.get("owner_decision", ""), "owner_checked": ("true" if owner.get("owner_checked") else "false") if owner else ""})
    return rows


KEY_MAP_APPLIED_COLUMNS = ["licence", "master_name", "normalised_core", "brand_key", "brand_display_name", "evidence_codes", "confidence",
                           "owner_decision", "owner_checked", "menu_url_conflict", "dish_rows", "excluded_rows"]
OUTLET_MAP_APPLIED_COLUMNS = ["licence", "outlet_name", "brand_key", "catalogue_row_count", "observed_rows", "menu_url_conflict", "owner_decision", "owner_checked"]


def applied_key_rows(identity: BrandIdentity, overrides: dict) -> list:
    out = []
    for r in brand_key_map_rows(identity):
        lic = r["licence"]
        owner = identity.owner.get(lic, {})
        out.append({**r, "owner_decision": owner.get("owner_decision", ""), "owner_checked": ("true" if owner.get("owner_checked") else "false") if owner else "",
                    "menu_url_conflict": "true" if lic in overrides.get("row_conflicts", {}) else "false",
                    "dish_rows": identity.infos[lic].rows, "excluded_rows": identity.infos[lic].excluded})
    return out


def applied_outlet_map(identity: BrandIdentity, ctx: Ctx, records: list, overrides: dict) -> list:
    """Every licence of every brand that has catalogue rows, including merged licences that have no dish rows of their own."""
    brand_rows, observed = Counter(), Counter()
    for r in records:
        brand_rows[r["brand"]] += 1
        for lic in r["outlet_licences"]:
            observed[(lic, r["brand"])] += 1
    members = {(lic, k) for lic, k in identity.keys.items() if brand_rows[k]} | set(observed)
    rows = []
    for lic, k in sorted(members, key=lambda t: (t[1], t[0])):
        owner = identity.owner.get(lic, {})
        rows.append({"licence": lic, "outlet_name": ctx.master_names.get(lic, ""), "brand_key": k, "catalogue_row_count": brand_rows[k],
                     "observed_rows": observed[(lic, k)], "menu_url_conflict": "true" if lic in overrides.get("row_conflicts", {}) else "false",
                     "owner_decision": owner.get("owner_decision", ""), "owner_checked": ("true" if owner.get("owner_checked") else "false") if owner else ""})
    return rows


def review_markdown(identity: BrandIdentity, display_rows: list, key_rows: list, records: list, conflicts: list, excluded: Counter, overrides: dict,
                    before: dict, paths: dict, dish_names: dict, google_total: tuple, routing: Optional[dict] = None, legacy: Optional[dict] = None,
                    master_urls: Optional[dict] = None) -> str:
    routing, legacy, master_urls = routing or {}, legacy or {}, master_urls or {}
    disp = {r["licence"]: r for r in display_rows}
    kr = {r["licence"]: r for r in key_rows}
    lic_dishes: dict = {l: set(i.dishes) for l, i in identity.infos.items() if i.rows}  # every dish the licence has in the run, wherever its rows were routed
    brand_prices: dict = defaultdict(lambda: defaultdict(dict))  # brand -> dish -> licence -> price (catalogue only)
    for r in records:
        dk = mm.norm_name(r["item_name"])
        for lic in r["outlet_licences"]:
            brand_prices[r["brand"]][dk][lic] = r["price_sgd"]
    L = ["# Brand review 2026-11-08", "",
         "Generated by `scripts/menu_run_quarantine.py --overrides-only`. Read-only evidence for the owner; nothing here is verified (`verified=false`). "
         "Owner decisions are recorded in `brand_overrides_2026-11-08.json`: merges are `owner_decision=merge`, `owner_checked=false` (relayed, not yet checked by the owner).", ""]
    summary = []
    sections = []
    for gi, members in enumerate(identity.group_members):
        if not members:
            continue
        meta = overrides["merge_meta"][gi] if gi < len(overrides["merge_meta"]) else {}
        key = identity.keys[members[0]]
        name = identity.display.get(key, key)
        with_rows = [m for m in members if m in lic_dishes]
        sets = [lic_dishes[m] for m in with_rows]
        common_all = set.intersection(*sets) if sets else set()
        need = (len(sets) + 1) // 2
        cnt = Counter(d for st in sets for d in st)
        common_most = sorted(d for d, c in cnt.items() if c >= max(need, 1)) if sets else []
        conf_rows = [c for c in conflicts if c["brand"] == key]
        b = before.get(gi, {})
        summary.append(f"| {name} | {len(members)} | {len(with_rows)} | {sum(kr[m]['dish_rows'] for m in members)} | "
                       f"{sum(1 for r in records if r['brand'] == key)} | {b.get('catalogue_rows', 0)} | {b.get('keys', '')} | {sum(excluded[m] for m in members)} | {len(conf_rows)} |")
        sec = [f"## {name}", "",
               f"Brand key `{key}`; owner decision `{meta.get('owner_decision', 'merge')}`, owner_checked `{str(bool(meta.get('owner_checked', False))).lower()}`. "
               f"Patterns: {', '.join('`' + x + '`' for x in overrides['merge'][gi])}.", "",
               "| licence | master name | Google name | location | display name | dish rows | dishes in common (with any other outlet / with all other outlets) | price conflicts |",
               "|---|---|---|---|---|---:|---|---|"]
        for m in sorted(members):
            d = disp[m]
            others = [lic_dishes[o] for o in with_rows if o != m]
            if m not in with_rows:
                shared = "n/a (no dish rows)"
            elif not others:
                shared = "n/a (only outlet with dishes)"
            else:
                shared = f"{len(lic_dishes[m] & set.union(*others))} / {len(lic_dishes[m] & set.intersection(*others))}"
            pc = "; ".join(f"{dish_names.get(dk, dk)}: {brand_prices[key][dk][m]:.2f}" for dk in sorted(brand_prices[key])
                           if m in brand_prices[key][dk] and brand_prices[key][dk][m] is not None
                           and any(mm.norm_name(c["dish"]) == dk for c in conf_rows))
            flag = " **(menu URL conflict)**" if d["menu_url_conflict"] == "true" else ""
            sec.append(f"| {m} | {d['master_name']}{flag} | {d['google_name'] or '-'} | {d['outlet_location'] or '-'} ({d['location_source']}) | {d['display_name']} | "
                       f"{kr[m]['dish_rows']}{' (+' + str(excluded[m]) + ' excluded)' if excluded[m] else ''} | {shared} | {pc or '-'} |")
        sec += ["", f"{len(with_rows)} of {len(members)} licences have dish rows. Dishes common to all of them: {len(common_all)}; common to most (at least half): {len(common_most)}. "
                    f"First 10 common to {'all' if common_all else 'most'}: " + (", ".join(dish_names.get(d, d) for d in (sorted(common_all) or common_most)[:10]) or "none") + ".", ""]
        routed = [(m, routing[m]) for m in with_rows if m in routing]
        if routed:
            sec += ["Where each outlet's dish rows went in this run (a row can carry several reason codes; the most severe decides the bucket):", ""]
            for m, rt in routed:
                sec.append(f"- {m}: " + ", ".join(f"{b} {n}" for b, n in sorted(rt['buckets'].items())) + " | codes: " + ", ".join(f"{c} {n}" for c, n in sorted(rt['codes'].items())))
            sec.append("")
        if conf_rows:
            sec += ["Price conflicts (needs outlet-level confirmation; none is resolved silently):", ""] + [f"- {c['dish']}: {c['prices_to_outlet_count']}" for c in conf_rows] + [""]
        else:
            sec += ["Price conflicts: none in the existing data.", ""]
        sections.append((name, sec, members, with_rows, meta))
    L += ["## Summary", "",
          "| brand | licences merged by identity | licences with dish rows | dish rows | catalogue rows after | catalogue rows before | keys before | rows excluded (name conflict) | price conflicts |",
          "|---|---:|---:|---:|---:|---:|---:|---:|---:|", *summary, ""]
    L += [f"Google names found offline for {google_total[0]} of {google_total[1]} outlets listed below; the rest use the master address as the location "
          "(`location_source=master_address`, not Google).", ""]
    ex_lics = overrides.get("row_conflicts", {})
    if ex_lics:
        L += ["## Owner question: four Ah Ma Chi Mian licences whose Menu URL belongs to another restaurant", "",
              "These licences are named Ah Ma Chi Mian in the master, but the master Menu URL and the dish rows point to a different restaurant. "
              "They stay in the Ah Ma Chi Mian brand by name (owner decision) but their dish rows are excluded from the catalogue, exceptions and conflicts.", "",
              "| licence | master name | address | rows' own restaurant | rows excluded |", "|---|---|---|---|---:|"]
        for lic, rec in sorted(ex_lics.items()):
            L.append(f"| {lic} | {disp[lic]['master_name'] if lic in disp else ''} | {rec.get('address', '')} | {rec.get('row_stall_name', '')} | {excluded[lic]} |")
        L += ["", "Question for the owner: should the master Menu URL of these four licences be cleared (or replaced with the real Ah Ma Chi Mian page)? "
                  "Until then `--resolve-outlet` shows only brand_shared lines for them, with a warning.", ""]
    for name, sec, members, with_rows, meta in sections:
        L += sec
    holds = overrides.get("hold_out", {})
    if holds:
        L += ["## Held out of the merge (owner_decision=pending)", ""]
        for lic, h in sorted(holds.items()):
            L.append(f"- {lic} {disp[lic]['master_name'] if lic in disp else ''} (Google: {disp[lic]['google_name'] if lic in disp and disp[lic]['google_name'] else '-'}): {h.get('reason', '')} "
                     f"Question: {h.get('owner_question', 'Is this the same brand?')}")
        L.append("")
    splits = [g for g in overrides["split"] if g]
    if splits:
        L += ["## Kept separate: STALL 3 / STALL 7 / STALL 9", "",
              "Owner decision: generic food-court stall names, not a brand. They are never merged.", "",
              "| licence | master name | brand key | owner decision |", "|---|---|---|---|"]
        for lic in sorted(l for g in splits for l in g):
            if lic in kr:
                L.append(f"| {lic} | {kr[lic]['master_name']} | {kr[lic]['brand_key']} | {kr[lic]['owner_decision']} |")
        L.append("")
    L += ["## Doubtful points per brand", ""]
    for name, sec, members, with_rows, meta in sections:
        pts = [f"- **{name}**: merged by owner decision with `owner_checked=false` (\"most likely the same brand\")."]
        nog = [m for m in members if not disp[m]["google_name_available"] == "true"]
        pts.append(f"- **{name}**: {len(members) - len(nog)} of {len(members)} outlets have a Google name offline; {len(nog)} fall back to the master address for the location.")
        pts.append(f"- **{name}**: {len(members) - len(with_rows)} of {len(members)} licences have no dish rows; they inherit the brand catalogue only.")
        bcore = identity.infos[members[0]].core
        toks = [t for t in bcore.split() if len(t) >= 3 and t not in STOP_TOKENS]
        mentions = lambda u: (not toks) or any(t in str(u).lower().replace("-", " ") for t in toks)  # noqa: E731
        bad_url = [m for m in members if master_urls.get(m) and not mentions(master_urls[m])]
        if bad_url:
            pts.append(f"- **{name}**: the master Menu URL does not mention the brand for " + ", ".join(bad_url) + ".")
        old_bad = [(m, legacy[m]) for m in members if m in legacy and any(not mentions(u) for u in legacy[m]["urls"])]
        for m, lg in old_bad:
            pts.append(f"- **{name}**: {m} has {lg['rows']} old-slice row(s) (not processed here) named {sorted(lg['names'])[:2]} whose source URL does not mention the brand: {sorted(lg['urls'])[:1]}.")
        odd = [m for m in members if disp[m]["google_name"] and not row_names_brand(core_name(disp[m]["google_name"]), identity.infos[m].core)]
        if odd:
            pts.append(f"- **{name}**: Google name does not carry the brand for " + ", ".join(f"{m} ({disp[m]['google_name']})" for m in odd) + ".")
        L += pts
    L += ["", "## Machine-readable outputs", ""] + [f"- `{v}`" for v in paths.values()] + [""]
    return "\n".join(L)


def write_new_text(path: Path, text: str, allow_in_repo: bool = False) -> None:
    """Create a NEW file; never replaces an existing one."""
    path = Path(path)
    if path.exists():
        raise QuarantineError(f"Refusing to overwrite existing file: {path}", 2)
    if not path.parent.is_dir():
        raise QuarantineError(f"Folder does not exist: {path.parent}", 2)
    if not allow_in_repo:
        for anc in [path.parent.resolve(), *path.parent.resolve().parents]:
            if (anc / ".git").exists():
                raise QuarantineError(f"Refusing to write inside a git repo: {path}", 2)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)
        os.link(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def commit_new_files(out_dir: Path, files: dict) -> None:
    """Write several NEW files; if one cannot be created, remove the ones this call created. Existing files are never touched."""
    for name in files:
        if (out_dir / name).exists():
            raise QuarantineError(f"Refusing to overwrite existing file: {out_dir / name}", 2)
    created: list = []
    try:
        for name, text in files.items():
            write_new_text(out_dir / name, text)
            created.append(out_dir / name)
    except BaseException:
        for p in created:
            p.unlink(missing_ok=True)
        raise


def load_resolution_inputs(out_dir: Path, applied: bool = False) -> dict:
    d = Path(out_dir)
    sfx = APPLIED_SUFFIX if applied else ""
    names = (f"brand_key_map{sfx}.csv", f"brand_catalogue{sfx}.jsonl", f"outlet_exceptions{sfx}.jsonl")
    for name in names:
        if not (d / name).is_file():
            raise QuarantineError(f"{name} not found in {d}; run with --write{' --overrides-only' if applied else ''} first", 2)
    disp = d / f"outlet_display_names{APPLIED_SUFFIX}.csv"
    return {"keys": {r["licence"]: r for r in read_csv(d / names[0])}, "catalogue": read_jsonl_file(d / names[1]),
            "exceptions": read_jsonl_file(d / names[2]),
            "display": {r["licence"]: r for r in read_csv(disp)} if applied and disp.is_file() else {}}


def resolve_outlet(out_dir: Path, licence: str, applied: bool = False) -> dict:
    """Effective outlet menu = brand baseline, overridden by this licence's exceptions, plus its outlet-only items.
    Read-only; nothing is attached to the outlet as a verified row."""
    data = load_resolution_inputs(out_dir, applied)
    km = data["keys"].get(licence)
    if km is None:
        raise QuarantineError(f"{licence} is not in brand_key_map.csv", 2)
    brand = km["brand_key"]
    baseline = build_baseline(data["catalogue"]).get(brand, {})
    mine = [e for e in data["exceptions"] if e["licence"] == licence]
    by_type: dict = defaultdict(dict)
    for e in mine:
        by_type[e["type"]][mm.norm_name(e["dish"])] = e
    lines = []
    for dk in sorted(baseline, key=lambda k: baseline[k]["item_name"].casefold()):
        d = baseline[dk]
        line = {"item_name": d["item_name"], "source": "brand_shared", "verified": False, "price_basis": "unknown", "flags": []}
        diff = by_type["PRICE_DIFF"].get(dk)
        if diff:
            line.update(source="outlet_exception", price_sgd=diff["outlet_price"], price_status="outlet_exception", exception_type="PRICE_DIFF",
                        baseline_price=d["baseline_price"], evidence_source_url=diff["source_url"], evidence_crawl_timestamp=diff["crawl_timestamp"])
        elif d["conflict"]:
            line.update(price_sgd=None, price_status="conflict", prices=[o["price"] for o in d["observed"]],
                        price_to_outlet_count={f"{o['price']:.2f}": o["outlet_count"] for o in d["observed"]})
        else:
            line.update(price_sgd=d["baseline_price"], price_status="baseline" if d["baseline_price"] is not None else "no_price")
        if dk in by_type["NOT_OFFERED_CANDIDATE"]:
            line["flags"].append("not_offered_candidate: low confidence, NOT applied; the dish stays listed")
        lines.append(line)
    for dk in sorted(by_type["OUTLET_ONLY_ITEM"]):
        e = by_type["OUTLET_ONLY_ITEM"][dk]
        lines.append({"item_name": e["dish"], "source": "outlet_exception", "price_sgd": e["outlet_price"], "price_status": "outlet_only",
                      "exception_type": "OUTLET_ONLY_ITEM", "verified": False, "price_basis": "unknown", "flags": [],
                      "evidence_source_url": e["source_url"], "evidence_crawl_timestamp": e["crawl_timestamp"]})
    conflict = km.get("menu_url_conflict") == "true"
    if conflict:  # never show the other restaurant's dishes: only brand_shared lines, and say why
        lines = [l for l in lines if l["source"] == "brand_shared"]
    disp = data["display"].get(licence)
    header = [BRAND_WARNING, "Lines labelled outlet_exception come from outlet-level evidence but are also unverified (verified=false).",
              f"Outlet {licence} ({km['master_name']}) -> brand key {brand!r} ({km['brand_display_name']}), confidence {km['confidence']}",
              f"{len(lines)} line(s): {sum(1 for l in lines if l['source'] == 'brand_shared')} brand_shared, "
              f"{sum(1 for l in lines if l['source'] == 'outlet_exception')} outlet_exception"]
    if disp:
        header.insert(2, f"Outlet display name: {disp['display_name']} (location source: {disp['location_source']}; Google name: {disp['google_name'] or 'not available offline'})")
    if conflict:
        header.insert(1, "WARNING: the master Menu URL of this licence points to a different restaurant; that restaurant's dishes are excluded "
                         "and only brand_shared lines are shown. Owner question pending.")
    if km.get("owner_decision") == "merge" and km.get("owner_checked") != "true":
        header.append("Brand merge decided by the owner but not yet checked (owner_checked=false).")
    if km.get("owner_decision") == "pending":
        header.append("This licence is held out of the brand merge (owner_decision=pending).")
    return {"licence": licence, "outlet_name": km["master_name"], "brand_key": brand, "header": header, "lines": lines}


def format_resolution(res: dict) -> str:
    out = list(res["header"]) + [""]
    for l in res["lines"]:
        price = "conflict " + "/".join(f"{p:.2f}" for p in l["prices"]) if l["price_status"] == "conflict" else (f"{l['price_sgd']:.2f}" if l["price_sgd"] is not None else "-")
        extra = f" [{'; '.join(l['flags'])}]" if l["flags"] else ""
        out.append(f"{l['source']:<17} {l['price_status']:<18} {price:<22} {l['item_name']}  (verified=false, price_basis={l['price_basis']}){extra}")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- brand identity outputs

KEY_MAP_COLUMNS = ["licence", "master_name", "normalised_core", "brand_key", "brand_display_name", "evidence_codes", "confidence"]
REVIEW_CASE_COLUMNS = ["case_type", "old_key", "new_keys", "licence", "master_name", "normalised_core", "confidence", "evidence_codes",
                       "competing_names", "n_licences", "note"]
OWNER_REVIEW_OLD_KEYS = ("fun", "two", "coffee", "song", "crave", "ahma")


def brand_key_map_rows(identity: BrandIdentity) -> list:
    return [{"licence": l, "master_name": identity.infos[l].master_name, "normalised_core": identity.infos[l].core,
             "brand_key": identity.keys[l], "brand_display_name": identity.display.get(identity.keys[l], identity.keys[l]),
             "evidence_codes": "|".join(identity.evidence[l]), "confidence": identity.confidence[l]} for l in sorted(identity.infos)]


def old_vs_new_keys(identity: BrandIdentity, licences) -> dict:
    """What the first-word key merged before and what the full-name keys split it into."""
    by_old: dict = defaultdict(list)
    for l in sorted(licences):
        if l in identity.infos:
            by_old[first_word_info(identity.infos[l].master_name)[0] or "(unknown)"].append(l)
    return by_old


def brand_review_rows(identity: BrandIdentity) -> tuple:
    """(rows, template_cases). A row for every low/medium licence and every old key that changed or was named by the owner."""
    rows, cases = [], []
    for l in sorted(identity.infos):
        if identity.confidence[l] in ("low", "medium"):
            i = identity.infos[l]
            rows.append({"case_type": "LICENCE_" + identity.confidence[l].upper(), "old_key": first_word_info(i.master_name)[0], "new_keys": identity.keys[l],
                         "licence": l, "master_name": i.master_name, "normalised_core": i.core, "confidence": identity.confidence[l],
                         "evidence_codes": "|".join(identity.evidence[l]), "competing_names": " ; ".join(dict.fromkeys(identity.competing.get(l, []))),
                         "n_licences": "", "note": ""})
    for old, lics in sorted(old_vs_new_keys(identity, identity.infos).items()):
        new = sorted({identity.keys[l] for l in lics})
        if len(new) > 1 or old in OWNER_REVIEW_OLD_KEYS:
            names = sorted({identity.infos[l].master_name for l in lics})
            kind = "OLD_KEY_SPLIT" if len(new) > 1 else "OLD_KEY_REKEYED"
            rows.append({"case_type": kind, "old_key": old, "new_keys": " | ".join(new), "licence": "", "master_name": " ; ".join(names),
                         "normalised_core": " | ".join(sorted({identity.infos[l].core for l in lics})), "confidence": "", "evidence_codes": "",
                         "competing_names": "", "n_licences": len(lics),
                         "note": ("first-word key merged these; full-name keys split them" if len(new) > 1 else "first-word key replaced by the full-name key")})
            if len(new) > 1:
                cases.append({"case_id": f"split:{old}", "old_key": old, "licences": lics, "names": names, "new_keys": new, "decision": ""})
    for r in rows:
        if r["case_type"].startswith("LICENCE_") and r["licence"]:
            cases.append({"case_id": f"licence:{r['licence']}", "licence": r["licence"], "names": [r["master_name"], *filter(None, r["competing_names"].split(" ; "))],
                          "confidence": r["confidence"], "decision": ""})
    return rows, cases


def overrides_template(cases: list) -> dict:
    return {"_instructions": ("Copy to brand_overrides.json and pass it with --brand-overrides. 'merge': list of lists; every licence matching any pattern in a list "
                              "is forced into one brand. 'split': list of lists; licences matching different patterns in the same list are kept apart. "
                              "A pattern is a licence number or a case-insensitive wildcard on the master name. Leave 'decision' empty on cases you have not reviewed."),
            "merge": [], "split": [], "review_cases": cases}


def ambiguity_score(r: dict) -> tuple:
    return (0 if r["confidence"] == "low" else 1, -len([x for x in r["competing_names"].split(" ; ") if x]), r["licence"])



def sha_of_files(folder: Path) -> dict:
    return {p.name: mm.sha256_of(p) for p in sorted(Path(folder).iterdir()) if p.is_file()}


def emit_overrides_applied(args, out_dir: Path, ctx: Ctx, identity: BrandIdentity, overrides: dict, cat_records: list, conflicts: list, exceptions: list,
                           excluded_rows: list, excluded_count: Counter, dish_names: dict, hashes_before: dict, extra_inputs: dict, report: dict,
                           present: dict, routing: dict, legacy_info: dict) -> None:
    """Write only the *_overrides_applied files (all new) into an existing run folder. Nothing existing is touched."""
    sfx = APPLIED_SUFFIX
    google = read_google_names(Path(args.google_names) if args.google_names else None)
    existing_before = sha_of_files(out_dir)
    key_rows = applied_key_rows(identity, overrides)
    disp_rows = display_name_rows(identity, ctx, google, overrides)
    omap = applied_outlet_map(identity, ctx, cat_records, overrides)
    records = []
    for r in cat_records:
        meta = identity.group_meta.get(r["brand"])
        records.append({**r, **({"owner_decision": meta["owner_decision"], "owner_checked": meta["owner_checked"], "merge_group": meta["group_id"]} if meta else {})})
    # before: what the existing run folder said about the same licences
    old_keys = {r["licence"]: r["brand_key"] for r in read_csv(out_dir / "brand_key_map.csv")} if (out_dir / "brand_key_map.csv").is_file() else {}
    old_cat = read_jsonl_file(out_dir / "brand_catalogue.jsonl") if (out_dir / "brand_catalogue.jsonl").is_file() else []
    before, groups = {}, []
    for gi, members in enumerate(identity.group_members):
        if not members:
            continue
        meta = overrides["merge_meta"][gi] if gi < len(overrides["merge_meta"]) else {}
        bkeys = {old_keys[m] for m in members if m in old_keys}
        brows = [r for r in old_cat if r["brand"] in bkeys]
        before[gi] = {"keys": len(bkeys), "catalogue_rows": len(brows), "licences_in_run": sum(1 for m in members if m in old_keys),
                      "catalogue_outlets": len({l for r in brows for l in r["outlet_licences"]})}
        key = identity.keys[members[0]]
        after_rows = [r for r in cat_records if r["brand"] == key]
        groups.append({"id": meta.get("id", f"merge{gi + 1}"), "display_name": identity.display.get(key), "brand_key": key, "master_licences_merged": len(members),
                       "licences_with_dish_rows": sum(1 for m in members if identity.infos[m].rows), "dish_rows": sum(identity.infos[m].rows for m in members),
                       "catalogue_rows_after": len(after_rows), "catalogue_outlets_after": len({l for r in after_rows for l in r["outlet_licences"]}),
                       "excluded_rows": sum(excluded_count[m] for m in members), "owner_decision": meta.get("owner_decision", "merge"),
                       "owner_checked": bool(meta.get("owner_checked", False)), "before": before[gi],
                       "price_conflicts": sum(1 for c in conflicts if c["brand"] == key)})
    member_lics = sorted({m for ms in identity.group_members for m in ms})
    google_found = sum(1 for m in member_lics if google.get(m))
    paths = {k: str(out_dir / v) for k, v in {
        "key_map": f"brand_key_map{sfx}.csv", "outlet_map": f"brand_outlet_map{sfx}.csv", "catalogue": f"brand_catalogue{sfx}.jsonl",
        "exceptions": f"outlet_exceptions{sfx}.jsonl", "conflicts": f"brand_price_conflicts{sfx}.csv", "display_names": f"outlet_display_names{sfx}.csv",
        "excluded_rows": f"brand_excluded_rows{sfx}.jsonl", "manifest": f"manifest{sfx}.json"}.items()}
    paths["overrides"] = str(args.brand_overrides)
    if args.google_names:
        paths["google_names"] = str(args.google_names)
    md = review_markdown(identity, disp_rows, key_rows, records, conflicts, excluded_count, overrides, before, paths, dish_names, (google_found, len(member_lics)), routing, legacy_info, ctx.master_urls) \
        if args.review_md else None
    excl_text = "".join(json.dumps({**r, "bucket": "EXCLUDED_NAME_CONFLICT", "verified": False}, ensure_ascii=False, sort_keys=True) + "\n" for r in excluded_rows)
    hashes_after = {k: mm.sha256_of(p) for k, p in {**present, **extra_inputs}.items()}
    if hashes_after != hashes_before:
        raise QuarantineError("A source file changed while the run was in progress; nothing was written", 6)
    manifest = {"schema": 1, "mode": "overrides-only", "same_brand_url_policy": ctx.same_brand_url_policy,
                "inputs": {k: {"path": str(p), "sha256": hashes_before[k], "bytes": p.stat().st_size} for k, p in sorted({**present, **extra_inputs}.items())},
                "inputs_unchanged_after_run": True, "script": script_provenance(), "overrides_metadata": overrides.get("metadata", {}),
                "merge_groups": groups, "hold_out": {l: {"owner_decision": h.get("owner_decision", "pending"), "master_name": identity.infos[l].master_name if l in identity.infos else ""}
                                                     for l, h in sorted(overrides["hold_out"].items())},
                "excluded_rows_by_licence": dict(sorted(excluded_count.items())),
                "row_routing": {l: {"buckets": dict(routing[l]["buckets"]), "reason_codes": dict(routing[l]["codes"])}
                                for l in member_lics if l in routing},
                "google_names": {"outlets_listed": len(member_lics), "with_google_name": google_found, "fallback_master_address": len(member_lics) - google_found,
                                 "all_display_rows_with_google_name": sum(1 for r in disp_rows if r["google_name_available"] == "true"), "display_rows": len(disp_rows)},
                "counts": {"key_map_rows": len(key_rows), "outlet_map_rows": len(omap), "catalogue_rows": len(records), "exceptions": len(exceptions),
                           "price_conflicts": len(conflicts), "excluded_rows": len(excluded_rows)}}
    files = {f"brand_key_map{sfx}.csv": csv_text(KEY_MAP_APPLIED_COLUMNS, key_rows), f"brand_outlet_map{sfx}.csv": csv_text(OUTLET_MAP_APPLIED_COLUMNS, omap),
             f"brand_catalogue{sfx}.jsonl": "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in records),
             f"outlet_exceptions{sfx}.jsonl": "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in exceptions),
             f"brand_price_conflicts{sfx}.csv": csv_text(CONFLICT_COLUMNS, conflicts), f"outlet_display_names{sfx}.csv": csv_text(DISPLAY_COLUMNS, disp_rows),
             f"brand_excluded_rows{sfx}.jsonl": excl_text, f"manifest{sfx}.json": json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"}
    if args.review_md and Path(args.review_md).exists():
        raise QuarantineError(f"Refusing to overwrite existing file: {args.review_md}", 2)
    commit_new_files(out_dir, files)
    if md is not None:
        try:
            write_new_text(Path(args.review_md), md, allow_in_repo=True)
        except BaseException:
            for name in files:
                (out_dir / name).unlink(missing_ok=True)
            raise
    if sha_of_files(out_dir).items() < existing_before.items() or any(sha_of_files(out_dir).get(k) != v for k, v in existing_before.items()):
        raise QuarantineError("An existing file in the run folder changed", 6)
    report["overrides_applied"] = {"groups": groups, "files": sorted(files)}


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
    extra_inputs = {k: Path(v) for k, v in (("brand_domains", args.brand_domains), ("brand_overrides", args.brand_overrides),
                                            ("google_names", args.google_names)) if v}
    if args.overrides_only:
        if not args.brand_overrides:
            raise QuarantineError("--overrides-only needs --brand-overrides", 2)
        if not (Path(args.out_dir) / "report.json").is_file():
            raise QuarantineError(f"--overrides-only writes into an existing run folder; {args.out_dir} has no report.json", 2)
    sources = list(present.values()) + list(extra_inputs.values())
    guarded = list(present.values()) + ([] if args.overrides_only else list(extra_inputs.values()))  # --overrides-only inputs live in the run folder
    out_dir = check_output_dir(Path(args.out_dir), guarded, (d,))
    mm.check_disk([(existing_ancestor(out_dir), sum(p.stat().st_size for p in sources))], free_fn)

    hashes_before = {k: mm.sha256_of(p) for k, p in {**present, **extra_inputs}.items()}

    ctx, errors = Ctx(same_brand_url_policy=args.same_brand_url_policy), ErrorLog()
    master_rows = load_master(paths["master"], ctx)
    cw_rows, cw_licences = load_crosswalk(paths["crosswalk"], ctx)
    review_rows = load_review(paths["review"], ctx, errors)
    load_brand_domains(Path(args.brand_domains) if args.brand_domains else None, ctx)
    overrides = load_overrides(Path(args.brand_overrides) if args.brand_overrides else None)
    identity = BrandIdentity(args.brand_identity, build_places(ctx.master_addresses) if args.brand_identity == "full-name" else frozenset(), overrides)
    ctx.identity = identity
    ctx.hold_out = set(overrides["hold_out"])
    lic_infos: dict = {}
    excluded_rows: list = []
    excluded_count: Counter = Counter()
    legacy_info: dict = {}
    dish_names: dict = {}
    excl = overrides["row_conflicts"]

    def info_for(lic, row):
        li = lic_infos.get(lic)
        if li is None:
            mname = ctx.master_names.get(lic, "")
            shown = mname or str(row.get("stall_name") or "")  # licence missing from master: fall back to the row's own name
            li = lic_infos[lic] = LicInfo(lic, shown, identity.core_of_name(shown), roots={url_root(ctx.master_urls.get(lic, ""))} - {""})
        return li
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
                for lic in it.parts:
                    lg = legacy_info.setdefault(lic, {"rows": 0, "names": set(), "urls": set()})
                    lg["rows"] += 1
                    if len(lg["names"]) < 3 and row.get("stall_name"):
                        lg["names"].add(str(row["stall_name"]))
                    if len(lg["urls"]) < 3 and row.get("source_url"):
                        lg["urls"].add(str(row["source_url"]))
                if not it.parts:
                    stats["empty_licence_rows"] += 1
                if "Q_NO_LICENCE" in classify(it, ctx)[0]:
                    items.append(it)
                continue
            stats["new_rows"] += 1
            if str(row.get("source") or "").strip().lower() == "brand_official_site" and str(row.get("crawl_timestamp") or "").startswith(BRAND_COPY_BATCH_PREFIX):
                audit_extra["brand_site_18h_rows"] += 1
            nn_dish = mm.norm_name(row.get("item_name"))
            if it.parts and all(p in excl for p in it.parts):  # owner: this licence's rows belong to another restaurant
                excluded_rows.append({**row, "exclusion_reason": "rows_excluded_name_conflict", "exclusion_note": excl[it.parts[0]].get("reason", ""),
                                      "row_stall_name_core": identity.core_of_name(str(row.get("stall_name") or ""))})
                for lic in it.parts:
                    excluded_count[lic] += 1
                    info_for(lic, row).excluded += 1
                continue
            items.append(it)
            if nn_dish:
                dish_names.setdefault(nn_dish, row.get("item_name"))
            root = url_root(row.get("source_url"))
            for lic in it.parts:
                li = info_for(lic, row)
                li.rows += 1
                if nn_dish:
                    li.dishes.add(nn_dish)
                if root:
                    li.roots.add(root)
                if row.get("stall_name"):
                    li.row_names.add(str(row.get("stall_name")))
    if overrides["merge"] or overrides["split"] or overrides["hold_out"]:  # licences the owner named, even with no dish rows
        patterns = [x for g in overrides["merge"] + overrides["split"] for x in g]
        need_core = any(x.lower().startswith("core:") for x in patterns)
        for lic, name in ctx.master_names.items():
            if lic in lic_infos:
                continue
            core = identity.core_of_name(name) if (name and need_core) else ""
            if lic in overrides["hold_out"] or any(match_pattern(x, lic, name, core) for x in patterns):
                lic_infos[lic] = LicInfo(lic, name, core or identity.core_of_name(name), roots={url_root(ctx.master_urls.get(lic, ""))} - {""})
    identity.build(lic_infos)
    for it in items:
        if not it.legacy:
            it.brand = next((identity.keys[p] for p in it.parts if p in identity.keys), it.brand)
            agg.add(it)
    agg.finish(ctx)

    # ---- pass 2: classify and (optionally) stream into staged files
    write = bool(args.write) and not args.overrides_only and errors.rate <= args.max_error_rate
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
    catalogue = BrandCatalogue(identity)
    routing: dict = defaultdict(lambda: {"buckets": Counter(), "codes": Counter()})
    evidence: list = []
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
            for lic in it.parts:
                routing[lic]["buckets"][bucket] += 1
                routing[lic]["codes"].update(codes)
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
                if facts.get("url_ownership") == "own":  # source page belongs to this licence alone: outlet-level evidence
                    evidence.append((it, out))
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
        baseline = build_baseline(cat_records)
        conflicts = conflict_rows(baseline, identity.display)
        exceptions = build_exceptions(baseline, evidence, ctx, identity)
        key_rows = brand_key_map_rows(identity)
        review_rows_, template_cases = brand_review_rows(identity)
        cat_lics = {l for r in cat_records for l in r["outlet_licences"]}
        old_all, old_cat = old_vs_new_keys(identity, identity.infos), old_vs_new_keys(identity, cat_lics)
        splits = [{"old_key": old, "new_keys": sorted({identity.keys[l] for l in ls}),
                   "examples": [{"licence": l, "master_name": identity.infos[l].master_name, "new_key": identity.keys[l]} for l in ls[:5]]}
                  for old, ls in sorted(old_all.items()) if len({identity.keys[l] for l in ls}) > 1]
        ambiguous = sorted((r for r in review_rows_ if r["case_type"].startswith("LICENCE_")), key=ambiguity_score)[:10]
        brand_identity_stats = {
            "mode": identity.mode, "licences": len(identity.infos),
            "old_keys_all": len(old_all), "new_keys_all": len(set(identity.keys.values())),
            "old_keys_catalogue": len(old_cat), "new_keys_catalogue": len({identity.keys[l] for l in cat_lics if l in identity.keys}),
            "confidence": dict(Counter(identity.confidence.values())), "split_old_keys": splits,
            "review_rows": len(review_rows_), "most_ambiguous": [
                f"{r['master_name']} [{r['licence']}]" + (" <> " + r["competing_names"].replace(" ; ", " / ") if r["competing_names"] else "") for r in ambiguous],
            "overrides_merge_groups": len(overrides["merge"]), "overrides_split_groups": len(overrides["split"]),
        }
        exc_counts = Counter(e["type"] for e in exceptions)
        exception_stats = {"total": len(exceptions), "by_type": {t: exc_counts[t] for t in ("PRICE_DIFF", "OUTLET_ONLY_ITEM", "NOT_OFFERED_CANDIDATE")},
                           "licences": len({e["licence"] for e in exceptions}), "evidence_rows": len(evidence),
                           "evidence_licences": len({l for it_, _ in evidence for l in it_.parts})}
        conflict_stats = {"rows": len(conflicts), "brands": len({c["brand"] for c in conflicts}),
                          "top5": [{"brand": c["brand"], "dish": c["dish"], "prices": c["prices_to_outlet_count"], "spread": c["spread"]}
                                   for c in sorted(conflicts, key=lambda c: (-float(c["spread"]), c["brand"], c["dish"]))[:5]]}
        comparison = [{"key": k, "expected": exp, "actual": actual.get(k), "match": actual.get(k) == exp, "what": what}
                      for k, exp, what in EXPECTED if k in actual]
        notes = [
            "Legacy (DD-MM-YYYY) rows are not bucketed; only Q_NO_LICENCE is applied to them. They are counted below.",
            "Q_NO_LICENCE not-in-master is counted after splitting multi-licence cells on ';' as instructed. "
            f"Counting the raw cell without splitting gives {stats['raw_cell_not_in_master_rows']}.",
            "Each outlet licence maps to its brand catalogue by brand key only (see brand_outlet_map.csv). Catalogue rows are brand-level, "
            "are not copied onto outlets and must not be shown as outlet menus. Only DOWNGRADE rows feed the catalogue: wrong-host, "
            "quarantined and re-source rows never do.",
            "Brand identity (full-name mode): two licences share a brand key only when their normalised core names are equal or fuzzy-equal "
            "(token-sorted ratio >= 0.9, significant-word count differs by <= 1) AND a corroborating signal exists (same source host, dish-set Jaccard >= 0.5, "
            "or an owner override). Names that merely share a first or last word are different brands. 'Token-set ratio' is implemented without the "
            "subset shortcut so that a name containing another is not treated as equal.",
            "Q_URL_NOT_OWN_MASTER_URL is an added code: KEEP_CONDITIONAL requires source_url to be the licence's own master Menu URL.",
            f"R_NO_PRICE_BRAND needs >= {MIN_NULL_PRICE_ROWS} rows on the licence; Q_SHARED_DISH_SET_UNRELATED needs >= {MIN_SHARED_SET} dishes in the set.",
        ]
        if over_threshold:
            notes.append(f"ERROR RATE {errors.rate:.4%} exceeds {args.max_error_rate:.4%}: nothing was written except errors.")
        report = {
            "schema": 1,
            "same_brand_url_policy": ctx.same_brand_url_policy,
            "brand_identity_mode": identity.mode,
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
            "brand_identity": brand_identity_stats,
            "outlet_exceptions": exception_stats,
            "brand_price_conflicts": conflict_stats,
        }

        files = None
        if args.overrides_only:
            if args.write and not over_threshold:
                emit_overrides_applied(args, out_dir, ctx, identity, overrides, cat_records, conflicts, exceptions, excluded_rows, excluded_count,
                                       dish_names, hashes_before, extra_inputs, report, present, routing, legacy_info)
            return (5 if over_threshold else 0), report, None, errors.entries
        if write:
            hashes_after = {k: mm.sha256_of(p) for k, p in {**present, **extra_inputs}.items()}
            if hashes_after != hashes_before:
                raise QuarantineError("A source file changed while the run was in progress; outputs discarded", 6)
            manifest = {"schema": 1, "inputs": {k: {"path": str(p), "sha256": hashes_before[k], "bytes": p.stat().st_size} for k, p in sorted(present.items())},
                        "inputs_unchanged_after_run": True, "script": script_provenance()}
            for k, pth in extra_inputs.items():
                manifest["inputs"][k] = {"path": str(pth), "sha256": hashes_before[k], "bytes": pth.stat().st_size}
            staged.put_text("report.json", json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
            staged.put_text("report.md", report_markdown(report))
            staged.put_text("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
            staged.put_text("errors.jsonl", "".join(json.dumps(e, ensure_ascii=False, sort_keys=True) + "\n" for e in errors.entries))
            staged.put_text("brand_key_map.csv", csv_text(KEY_MAP_COLUMNS, key_rows))
            staged.put_text("brand_review.csv", csv_text(REVIEW_CASE_COLUMNS, review_rows_))
            staged.put_text("brand_overrides.template.json", json.dumps(overrides_template(template_cases), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
            staged.put_text("outlet_exceptions.jsonl", "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in exceptions))
            staged.put_text("brand_price_conflicts.csv", csv_text(CONFLICT_COLUMNS, conflicts))
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
    if over_threshold and args.write and not args.overrides_only:
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
    bi, ox, bp = r["brand_identity"], r["outlet_exceptions"], r["brand_price_conflicts"]
    L += ["", f"## Brand identity ({bi['mode']})", "",
          f"- licences: {bi['licences']}; brand keys before (first word) -> after (full name): {bi['old_keys_all']} -> {bi['new_keys_all']} "
          f"(catalogue: {bi['old_keys_catalogue']} -> {bi['new_keys_catalogue']}); confidence {json.dumps(bi['confidence'], sort_keys=True)}",
          f"- old keys that split: " + (", ".join(f"{x['old_key']} -> {len(x['new_keys'])} keys" for x in bi["split_old_keys"][:15]) + (f" (+{len(bi['split_old_keys']) - 15} more; see brand_review.csv)" if len(bi["split_old_keys"]) > 15 else "") or "none"),
          "- most ambiguous: " + (" ; ".join(bi["most_ambiguous"]) or "none"),
          "", "## Shared brand menu and outlet exceptions", "",
          f"- exceptions: {json.dumps(ox['by_type'], sort_keys=True)} (outlet-level evidence rows: {ox['evidence_rows']} on {ox['evidence_licences']} licences)",
          f"- brand_price_conflicts.csv: {bp['rows']} dishes on {bp['brands']} brands; these need outlet-level confirmation, none is resolved silently",
          "- NOT_OFFERED_CANDIDATE is flagged only (confidence low) and is never applied; resolve an outlet with --resolve-outlet LICENCE --out-dir DIR"]
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
    ap.add_argument("--input-dir")
    ap.add_argument("--master")
    ap.add_argument("--out-dir")
    ap.add_argument("--brand-name-review", action="store_true",
                    help="read an existing sidecar run (--sidecar-dir) and the master, and create ONE new csv (--review-out) on the old first-word keys")
    ap.add_argument("--sidecar-dir")
    ap.add_argument("--review-out")
    ap.add_argument("--date", default="2026-11-08")
    ap.add_argument("--brand-domains", default=None, help="optional JSON {brand name: [allowed domains]}")
    ap.add_argument("--write", action="store_true", help="write outputs (default is a dry run that writes nothing)")
    ap.add_argument("--max-error-rate", type=float, default=MAX_ERROR_RATE)
    ap.add_argument("--brand-identity", choices=("full-name", "first-word"), default="full-name")
    ap.add_argument("--brand-overrides", default=None, help="optional JSON {\"merge\": [[patterns]], \"split\": [[patterns]]}")
    ap.add_argument("--overrides-only", action="store_true",
                    help="re-run identity/catalogue/exceptions/conflicts with --brand-overrides and write ONLY new *_overrides_applied files into the existing --out-dir")
    ap.add_argument("--google-names", default=None, help="csv (SFA Licence, Google Name, ...) made with --extract-google-names; local data only")
    ap.add_argument("--review-md", default=None, help="with --overrides-only: also create this readable markdown review (refuses to overwrite)")
    ap.add_argument("--extract-google-names", metavar="WORKBOOK", help="read Google names from a local directory workbook into --google-names-out (new file)")
    ap.add_argument("--google-names-out")
    ap.add_argument("--overrides-applied", action="store_true", help="with --resolve-outlet: use the *_overrides_applied files")
    ap.add_argument("--resolve-outlet", metavar="LICENCE", help="print the effective outlet menu from an existing run in --out-dir (read-only)")
    ap.add_argument("--json", action="store_true", help="with --resolve-outlet: print JSON")
    ap.add_argument("--same-brand-url-policy", choices=("strict", "sidecar"), default="strict",
                    help="strict (default): a URL listed only on other licences is Q_URL_OWNED_BY_OTHER_LICENCE even for sibling outlets; "
                         "sidecar: when every owner is the same brand as the row, do not quarantine for it (brand rows can then land in DOWNGRADE)")
    args = ap.parse_args(argv)
    if args.brand_name_review:
        if not (args.sidecar_dir and args.master and args.review_out):
            ap.error("--brand-name-review needs --sidecar-dir, --master and --review-out")
        try:
            summary = run_old_key_review(Path(args.sidecar_dir), Path(args.master), Path(args.review_out))
        except mm.MergeError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return getattr(e, "exit_code", 2)
        print(json.dumps(summary, indent=2, sort_keys=True, ensure_ascii=False))
        return 0
    if args.extract_google_names:
        if not args.google_names_out:
            ap.error("--extract-google-names needs --google-names-out")
        try:
            n = extract_google_names(Path(args.extract_google_names), Path(args.google_names_out))
        except mm.MergeError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return getattr(e, "exit_code", 2)
        print(f"{n} Google names written to {args.google_names_out}")
        return 0
    if args.resolve_outlet:
        if not args.out_dir:
            ap.error("--resolve-outlet needs --out-dir (a finished --write run)")
        try:
            res = resolve_outlet(Path(args.out_dir), args.resolve_outlet, args.overrides_applied)
        except mm.MergeError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return getattr(e, "exit_code", 2)
        print(json.dumps(res, indent=2, ensure_ascii=False, sort_keys=True) if args.json else format_resolution(res), end="" if not args.json else "\n")
        return 0
    if not (args.input_dir and args.master and args.out_dir):
        ap.error("--input-dir, --master and --out-dir are required")
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
