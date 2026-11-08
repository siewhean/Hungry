#!/usr/bin/env python3
"""Validate extracted menu rows and append them safely to the Full Menu & Price CSV (Doc 2).

No network access. Default is a dry run that prints a diff summary and changes nothing.

  python3 scripts/menu_workbook_merge.py --input rows.jsonl --target "data/Hungry Full Menu & Price - 21 Oct 2026.csv" \
      --master data/Hungry_Database_Food_Only_2026-10-21.csv [--review-queue queue.jsonl]
  ... add --apply [--xlsx "<same name>.xlsx"] to write.

The target CSV header is the source of truth for column order. Unknown columns make the run fail.
Rows that fail any rule go to the review queue (JSONL) and never reach the workbook.
Fields the Doc 2 columns cannot hold (capture time, source type, price basis, menu schedule,
discounted price, verified flag) go to a provenance sidecar JSONL keyed by item_key.
See .claude/skills/hungry-menu-crawl/ for the operating procedure and field matrix.
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
import sys
import tempfile
import unicodedata
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from pathlib import Path
from typing import Callable, Iterable, Optional
from urllib.parse import parse_qsl, urlsplit, urlunsplit

csv.field_size_limit(10**8)

SGT = timezone(timedelta(hours=8))
PRICE_MIN, PRICE_MAX = Decimal("0.50"), Decimal("100")
IMAGE_REUSE_LIMIT = 5
NAME_MATCH_OK, NAME_MATCH_HARD_FAIL = 0.6, 0.35
COORD_MAX_METRES = 300
DISK_FACTOR = 3
MAX_CELL = 32000  # Excel cell limit is 32767 characters

UNVERIFIED_NOTE = "Menu item and price not independently verified; do not publish as a confirmed outlet menu."
DELIVERY_NOTE = "Delivery-platform price; in-store price may differ."
INTOLERANCES_DEFAULT = "Not assessed — ingredient list unavailable"

REQUIRED_COLUMNS = (
    "F&B Venue Name", "SFA Licence", "Address", "Postal Code", "Menu Item / Dish Name",
    "Price (SGD)", "Menu Source URL", "Last Verified Date",
)
OPTIONAL_COLUMNS = ("Category / Section", "Description / Notes", "Dish Image URL")
BLANK_DIETARY = ("Vegan", "Pork-free", "Gluten-free", "Dairy-free", "Nut-free")  # blank = not asserted
UNKNOWN_DIETARY = ("Halal", "Vegetarian", "Beef", "Milk", "Eggs", "Fish", "Crustaceans", "Soy", "Peanuts", "Tree nuts", "Wheat")
DIETARY_COLUMNS = BLANK_DIETARY + UNKNOWN_DIETARY
KNOWN_COLUMNS = REQUIRED_COLUMNS + OPTIONAL_COLUMNS + DIETARY_COLUMNS + ("Intolerances",)
DIET_DEFAULTS = {**{c: "" for c in BLANK_DIETARY}, **{c: "Unknown" for c in UNKNOWN_DIETARY}, "Intolerances": INTOLERANCES_DEFAULT}

SOURCE_TYPES = ("saved_page", "official_site", "official_api", "open_data")
PRICE_BASES = ("delivery", "dine_in", "unknown")
DELIVERY_PLATFORMS = ("foodpanda", "grab", "deliveroo")
ACCEPTED_ITEM_TYPES = ("dish", "drink", "side", "dessert", "set_meal")
FEATURED_CATEGORIES = {"popular", "featured", "recommended", "most liked", "best sellers", "bestsellers", "popular items", "top picks"}
RESIZE_PARAMS = {"width", "height", "w", "h", "quality", "q", "fit", "resize", "crop", "dpr", "size", "maxwidth", "maxheight"}
LICENCE_RE = re.compile(r"^[A-Z0-9]{8,14}$")
UNIT_RE = re.compile(r"#\s*([A-Z]{0,2}\d{1,3})\s*[-–]\s*([A-Z0-9]{1,6}(?:\s*/\s*[A-Z0-9]{1,6})?)")


class MergeError(Exception):
    """Fatal, caller-visible error. exit_code tells main() what to return."""

    def __init__(self, msg: str, exit_code: int = 2):
        super().__init__(msg)
        self.exit_code = exit_code


# ---------------------------------------------------------------- text and price helpers

def clean_text(value) -> str:
    """Decode HTML entities (also double-encoded), NFC-normalise, drop control/zero-width chars, collapse spaces."""
    s = "" if value is None else str(value)
    for _ in range(3):
        decoded = html.unescape(s)
        if decoded == s:
            break
        s = decoded
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[​‌‍﻿­]", "", s).replace(" ", " ")
    s = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_name(value) -> str:
    """Dedupe/match form: lowercase, letters and digits only (CJK kept)."""
    return re.sub(r"[\W_]+", "", clean_text(value).casefold())


@dataclass
class PriceInfo:
    amount: Optional[Decimal] = None
    options: list = field(default_factory=list)
    is_from: bool = False
    is_add_on: bool = False
    service_charge_excluded: bool = False
    error: Optional[str] = None


_NUM = r"\d+(?:,\d{3})*(?:\.\d+)?"
_PLAIN_LIST = re.compile(rf"^{_NUM}(?:\s*[/,\-–]\s*{_NUM})*$")


def _to_money(token: str) -> Optional[Decimal]:
    try:
        d = Decimal(token.replace(",", ""))
    except InvalidOperation:
        return None
    q = d.quantize(Decimal("0.01"))
    return q if q == d else None  # more than 2 significant decimals is not a price


def parse_price(raw) -> PriceInfo:
    """Parse '$2.30++', 'from S$ 10.80', '28 / 35', '+$1.00', 7.5 into a PriceInfo. Never returns 0 or a guess."""
    info = PriceInfo()
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        info.error = "missing"
        return info
    if isinstance(raw, bool):
        info.error = "unparseable"
        return info
    if isinstance(raw, (int, float, Decimal)):
        tokens = [str(raw)]
    else:
        s = str(raw).strip()
        info.is_add_on = s.startswith("+")
        info.service_charge_excluded = "++" in s
        info.is_from = bool(re.match(r"^\s*(?:from|starting|fr\.?)\b", s, re.I))
        if re.search(r"(?:S\$|SGD|\$)", s, re.I):
            tokens = re.findall(rf"(?:S\$|SGD|\$)\s*({_NUM})", s, re.I)
        else:
            body = re.sub(r"^\s*(?:from|starting)\s*", "", s, flags=re.I)
            if not _PLAIN_LIST.match(body.strip()):
                info.error = "ambiguous_text"
                return info
            tokens = re.findall(_NUM, body)
        if not tokens:
            info.error = "unparseable"
            return info
    values = []
    for t in tokens:
        m = _to_money(t)
        if m is None:
            info.error = "too_many_decimals"
            return info
        values.append(m)
    if any(v <= 0 for v in values):
        info.error = "non_positive"
        return info
    info.options = sorted(set(values))
    info.amount = info.options[0]
    return info


def money_str(d: Decimal) -> str:
    return f"{d:.2f}"


# ---------------------------------------------------------------- image, unit, name, distance helpers

def normalise_image_url(url):
    """Return (url_or_None, quality). quality is full | thumbnail_only | none."""
    u = clean_text(url)
    if not re.match(r"^https?://", u, re.I):
        return None, "none"
    parts = urlsplit(u)
    pairs = parse_qsl(parts.query, keep_blank_values=True)
    kept = [(k, v) for k, v in pairs if k.lower() not in RESIZE_PARAMS]
    query = parts.query if len(kept) == len(pairs) else "&".join(f"{k}={v}" if v != "" else k for k, v in kept)
    path = re.sub(r"/styles/[^/]+/(?:public|private)/", "/", parts.path)  # Drupal derivative
    changed = path != parts.path or query != parts.query
    thumb_hint = bool(re.search(r"(?:^|[/_.-])(thumb|thumbs|thumbnail)(?:[/_.-]|$)", path, re.I))
    quality = "thumbnail_only" if thumb_hint else "full"
    if changed and not thumb_hint:
        quality = "full"
    return urlunsplit((parts.scheme, parts.netloc, path, query, "")), quality


def parse_units(text) -> set:
    found = set()
    for m in UNIT_RE.finditer(clean_text(text).upper()):
        floor = m.group(1).lstrip("0") or "0"
        for part in re.split(r"\s*/\s*", m.group(2)):
            found.add((floor, part.lstrip("0") or "0"))
    return found


def name_similarity(a, b) -> float:
    na, nb = norm_name(a), norm_name(b)
    if not na or not nb:
        return 0.0
    if min(len(na), len(nb)) >= 4 and (na in nb or nb in na):
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def _digit_tokens(name) -> set:
    return set(re.findall(r"\d+", clean_text(name)))


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(a))


def parse_iso(ts):
    if not ts or not isinstance(ts, str):
        return None
    try:
        dt = datetime.fromisoformat(ts.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else None  # timezone is mandatory


def zfill_postal(v) -> str:
    s = re.sub(r"\D", "", str(v or ""))
    return s.zfill(6) if s and len(s) <= 6 else s


# ---------------------------------------------------------------- target and master loading

@dataclass
class Authority:
    name: str
    address: str
    postal: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    alt_name: str = ""  # master F&B Name when Doc 2 carries a registered/legal name


@dataclass
class Target:
    path: Path
    header: list
    newline: str
    size: int
    rows: int = 0
    authority: dict = field(default_factory=dict)       # licence -> Authority (from existing Doc 2 rows)
    keys: set = field(default_factory=set)               # (licence, norm_name, price)
    prices_by_dish: dict = field(default_factory=lambda: defaultdict(set))  # (licence, norm_name) -> {prices}
    url_licences: dict = field(default_factory=lambda: defaultdict(set))    # source url -> {licences}
    image_counts: Counter = field(default_factory=Counter)


def check_header(header: list) -> None:
    unknown = [c for c in header if c not in KNOWN_COLUMNS]
    if unknown:
        raise MergeError(f"Target has columns this helper does not know: {unknown}. Update KNOWN_COLUMNS and the field-fill matrix before merging.")
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        raise MergeError(f"Target is missing required columns: {missing}")
    dupes = [c for c, n in Counter(header).items() if n > 1]
    if dupes:
        raise MergeError(f"Target header has duplicate columns: {dupes}")


def _split_licences(cell: str) -> list:
    return [p.strip().upper() for p in re.split(r"[;,]", cell or "") if p.strip()]


def load_target(path: Path) -> Target:
    path = Path(path)
    if not path.is_file():
        raise MergeError(f"Target CSV not found: {path}")
    with open(path, "rb") as fb:
        head = fb.readline()
    newline = "\r\n" if head.endswith(b"\r\n") else "\n"
    t = Target(path=path, header=[], newline=newline, size=path.stat().st_size)
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        try:
            t.header = next(reader)
        except StopIteration:
            raise MergeError("Target CSV is empty (no header)")
        check_header(t.header)
        ix = {c: i for i, c in enumerate(t.header)}
        n = len(t.header)
        for lineno, row in enumerate(reader, start=2):
            if len(row) != n:
                raise MergeError(f"Target row at record {lineno} has {len(row)} fields, expected {n}; fix the file before merging")
            t.rows += 1
            lics = _split_licences(row[ix["SFA Licence"]])
            name = row[ix["F&B Venue Name"]]
            for lic in lics:
                t.authority.setdefault(lic, Authority(name, row[ix["Address"]], zfill_postal(row[ix["Postal Code"]])))
                url = row[ix["Menu Source URL"]].strip()
                if url:
                    t.url_licences[url].add(lic)
                nn = norm_name(row[ix["Menu Item / Dish Name"]])
                p = parse_price(row[ix["Price (SGD)"]]).amount
                if nn:
                    t.keys.add((lic, nn, money_str(p) if p else ""))
                    t.prices_by_dish[(lic, nn)].add(money_str(p) if p else "")
            if "Dish Image URL" in ix and row[ix["Dish Image URL"]]:
                t.image_counts[row[ix["Dish Image URL"]]] += 1
    return t


def load_master(path: Path, licences: set) -> dict:
    out = {}
    if not path:
        return out
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        need = ("SFA Licence", "F&B Name", "Full Address", "Postal Code")
        miss = [c for c in need if c not in (reader.fieldnames or [])]
        if miss:
            raise MergeError(f"Master CSV is missing columns {miss}")
        for r in reader:
            for lic in _split_licences(r["SFA Licence"]):
                if lic in licences and lic not in out:
                    def num(k):
                        try:
                            return float(r.get(k) or "")
                        except ValueError:
                            return None
                    out[lic] = Authority(r["F&B Name"], r["Full Address"], zfill_postal(r["Postal Code"]), num("Latitude"), num("Longitude"))
    return out


# ---------------------------------------------------------------- row validation

@dataclass
class Accepted:
    raw: dict
    licence: str
    name: str
    category: str
    price: Decimal
    price_info: PriceInfo
    discounted: Optional[Decimal]
    description: str
    image_url: Optional[str]
    image_quality: str
    source_url: str
    source_type: str
    source: str
    captured_at: datetime
    verified: bool
    price_basis: str
    diet: dict
    auth: Authority
    identity: dict
    key: tuple
    sold_out: bool = False
    also_in_menus: list = field(default_factory=list)


def _first(raw: dict, *names, default=None):
    for n in names:
        if raw.get(n) not in (None, ""):
            return raw[n]
    return default


def resolve_dietary(claims, warnings: list) -> tuple:
    """Return (columns dict, reasons). A claim without evidence text is dropped, never trusted."""
    out, reasons = dict(DIET_DEFAULTS), []
    for col, claim in (claims or {}).items():
        if col not in DIETARY_COLUMNS:
            reasons.append("dietary_unknown_column")
            continue
        value = claim.get("value") if isinstance(claim, dict) else None
        evidence = clean_text(claim.get("evidence")) if isinstance(claim, dict) else ""
        if value not in ("Yes", "No"):
            reasons.append("dietary_value_invalid")
        elif len(evidence) < 3:
            warnings.append("dietary_claim_dropped_no_evidence")
        else:
            out[col] = value
    if out["Vegan"] == "Yes":
        if out["Vegetarian"] == "No":
            reasons.append("dietary_conflict")
        out["Vegetarian"] = "Yes"
    if out["Halal"] == "Yes":
        if out["Pork-free"] == "No":
            reasons.append("dietary_conflict")
        out["Pork-free"] = "Yes"
    if out["Vegetarian"] == "Yes" and any(out[c] == "Yes" for c in ("Beef", "Fish", "Crustaceans")):
        reasons.append("dietary_conflict")
    if out["Vegan"] == "Yes" and any(out[c] == "Yes" for c in ("Milk", "Eggs")):
        reasons.append("dietary_conflict")
    return out, sorted(set(reasons))


def check_identity(raw: dict, auth: Authority) -> tuple:
    """Return (reasons, info). Needs no mismatch and two independent confirmations, or an owner sign-off."""
    reasons, info = [], {}
    page_pc = zfill_postal(_first(raw, "page_postal_code"))
    page_units = parse_units(_first(raw, "page_unit", default="")) | parse_units(_first(raw, "page_address", default=""))
    page_name = clean_text(_first(raw, "page_name", default=""))
    plat, plng = _first(raw, "page_lat"), _first(raw, "page_lng")
    confirms = 0
    if not (page_pc or page_units or page_name or plat is not None):
        if not raw.get("identity_confirmed_by"):
            reasons.append("identity_no_page_evidence")
        return reasons, info
    if page_pc:
        if page_pc != auth.postal:
            reasons.append("postal_mismatch")
        else:
            confirms += 1
        info["postal_match"] = page_pc == auth.postal
    auth_units = parse_units(auth.address)
    units_matched = False
    if page_units and auth_units:
        units_matched = bool(page_units & auth_units)
        info["unit_match"] = units_matched
        if units_matched:
            confirms += 1
        else:
            reasons.append("unit_mismatch")
    if page_name:
        names = [n for n in (auth.name, auth.alt_name) if n]
        sim = max(name_similarity(page_name, n) for n in names) if names else 0.0
        info["name_similarity"] = round(sim, 2)
        a = _digit_tokens(page_name)
        numbered = [_digit_tokens(n) for n in names if _digit_tokens(n)]
        if a and numbered and all(not (a & b) for b in numbered):
            reasons.append("name_number_mismatch")  # e.g. Newton 51 page against a Newton 32 stall
        elif sim >= NAME_MATCH_OK:
            confirms += 1
        elif sim < NAME_MATCH_HARD_FAIL and not units_matched:
            reasons.append("name_mismatch")
    if plat is not None and plng is not None and auth.lat is not None and auth.lng is not None:
        try:
            d = haversine_m(float(plat), float(plng), auth.lat, auth.lng)
            info["distance_m"] = round(d)
            if d > COORD_MAX_METRES:
                reasons.append("coords_mismatch")
            else:
                confirms += 1
        except (TypeError, ValueError):
            reasons.append("coords_invalid")
    if not reasons and confirms < 2 and not raw.get("identity_confirmed_by"):
        reasons.append("identity_weak")
    info["confirmations"] = confirms
    return reasons, info


def validate_row(raw: dict, ctx: "Context") -> tuple:
    """Return (Accepted | None, reasons list, detail dict, warnings list)."""
    reasons, detail, warnings = [], {}, []
    lic = clean_text(_first(raw, "licence", "sfa_licence", "stall_licence_no", default="")).upper()
    if not LICENCE_RE.match(lic):
        reasons.append("licence_missing_or_invalid")  # also catches vendor codes such as 'y6cf'
    url = clean_text(_first(raw, "source_url", default=""))
    if not re.match(r"^https?://", url, re.I):
        reasons.append("source_url_missing_or_invalid")
    st = _first(raw, "source_type", default=ctx.default_source_type)
    if st not in SOURCE_TYPES:
        reasons.append("source_type_invalid")
    source = clean_text(_first(raw, "source", default="")).lower()
    basis = _first(raw, "price_basis", default="delivery" if source in DELIVERY_PLATFORMS else "unknown")
    if basis not in PRICE_BASES:
        reasons.append("price_basis_invalid")

    cap = parse_iso(_first(raw, "captured_at", default=ctx.default_captured_at))
    if cap is None:
        reasons.append("captured_at_invalid")
    elif cap > ctx.now + timedelta(minutes=5):
        reasons.append("captured_at_in_future")
    elif ctx.max_age_days and ctx.now - cap > timedelta(days=ctx.max_age_days):
        reasons.append("stale_capture")

    verified = raw.get("verified", False)
    if not isinstance(verified, bool):
        reasons.append("verified_not_boolean")
        verified = False
    if verified and not (raw.get("verified_by") and raw.get("verified_at")):
        reasons.append("verified_without_reviewer")

    item_type = _first(raw, "item_type", default="dish")
    if item_type not in ACCEPTED_ITEM_TYPES:
        reasons.append(f"item_type_{item_type}")

    name = clean_text(_first(raw, "item_name", "name", default="")).rstrip(" ,;:|")
    if not name:
        reasons.append("item_name_missing")
    elif re.search(r"[<>]", name) or re.search(r"[<>]", clean_text(raw.get("description"))):
        reasons.append("markup_in_text")
    elif name[0] in "=@" or clean_text(raw.get("description")).startswith(("=", "@")):
        reasons.append("formula_injection")
    elif len(name) > 200:
        reasons.append("item_name_too_long")

    pinfo = parse_price(_first(raw, "price_raw", "price_sgd"))
    if pinfo.error == "missing":
        disc = parse_price(raw.get("discounted_price_sgd"))
        reasons.append("missing_base_has_promo" if disc.amount else "price_missing")
    elif pinfo.error:
        reasons.append(f"price_unparseable_{pinfo.error}")
    else:
        if pinfo.is_add_on:
            reasons.append("add_on_price")
        for extra in raw.get("variation_prices_sgd") or []:
            v = parse_price(extra)
            if v.amount is not None:
                pinfo.options = sorted(set(pinfo.options) | {v.amount})
        pinfo.amount = pinfo.options[0]
        if raw.get("price_from") and len(pinfo.options) > 1:
            pinfo.is_from = True
        if pinfo.amount < PRICE_MIN or pinfo.options[-1] > PRICE_MAX:
            reasons.append("price_out_of_range")
    disc_amount = None
    if raw.get("discounted_price_sgd") not in (None, "") and pinfo.amount is not None:
        d = parse_price(raw["discounted_price_sgd"])
        if d.amount is not None and d.amount < pinfo.amount:
            disc_amount = d.amount

    auth = None
    if LICENCE_RE.match(lic):
        auth = ctx.target.authority.get(lic) or ctx.master.get(lic)
        if auth is None:
            reasons.append("licence_unknown")
        elif lic in ctx.master and auth is not ctx.master[lic]:
            m = ctx.master[lic]  # Doc 2 wins for name/address/postal; master adds coordinates and an alternative name
            auth = Authority(auth.name, auth.address, auth.postal, m.lat, m.lng, m.name if m.name != auth.name else "")
        if url in ctx.input_url_licences and len(ctx.input_url_licences[url]) > 1:
            reasons.append("url_shared_by_multiple_licences")
            detail["licences_on_url"] = sorted(ctx.input_url_licences[url])
        other = ctx.target.url_licences.get(url, set()) - {lic}
        if other:
            reasons.append("url_belongs_to_other_licence")
            detail["other_licences"] = sorted(other)
    if auth is not None:
        id_reasons, id_info = check_identity(raw, auth)
        reasons += id_reasons
        detail["identity"] = id_info

    diet, diet_reasons = resolve_dietary(raw.get("dietary"), warnings)
    reasons += diet_reasons

    img, quality = normalise_image_url(raw.get("image_url"))
    if raw.get("image_url") and img is None:
        warnings.append("image_url_invalid")
    if quality == "thumbnail_only":
        warnings.append("image_thumbnail_only")

    cat = clean_text(raw.get("category"))
    if cat.casefold() in FEATURED_CATEGORIES:
        cat = ""
        detail["featured_only"] = True

    if reasons:
        return None, sorted(set(reasons)), detail, warnings
    key = (lic, norm_name(name), money_str(pinfo.amount))
    if not key[1]:
        return None, ["item_name_missing"], detail, warnings
    return Accepted(
        raw=raw, licence=lic, name=name, category=cat, price=pinfo.amount, price_info=pinfo, discounted=disc_amount,
        description=clean_text(raw.get("description")), image_url=img, image_quality=quality, source_url=url,
        source_type=st, source=source, captured_at=cap, verified=verified, price_basis=basis, diet=diet, auth=auth,
        identity=detail.get("identity", {}), key=key, sold_out=bool(raw.get("sold_out")),
    ), [], detail, warnings


@dataclass
class Context:
    target: Target
    master: dict
    now: datetime
    max_age_days: int
    default_source_type: Optional[str]
    default_captured_at: Optional[str]
    input_url_licences: dict


# ---------------------------------------------------------------- planning

def build_notes(a: Accepted) -> str:
    parts = [a.description] if a.description else []
    if len(a.price_info.options) > 1:
        parts.append("Price options (SGD): " + ", ".join(money_str(p) for p in a.price_info.options))
    if a.price_info.service_charge_excluded:
        parts.append("Price excludes service charge and GST (++)")
    if a.discounted is not None:
        parts.append(f"Promo price S${money_str(a.discounted)} at capture")
    menu_title = clean_text(a.raw.get("menu_title"))
    hours = a.raw.get("menu_hours") or {}
    if menu_title:
        span = f" {hours.get('start', '')[:5]}-{hours.get('end', '')[:5]}" if hours.get("start") and hours.get("end") else ""
        parts.append(f"Available: {menu_title}{span}")
    if a.sold_out:
        parts.append("Sold out at capture")
    if a.price_basis == "delivery":
        parts.append(DELIVERY_NOTE)
    if not a.verified:
        parts.append(UNVERIFIED_NOTE)
    return " | ".join(parts)


def item_key(key: tuple) -> str:
    return hashlib.sha1("|".join(key).encode("utf-8")).hexdigest()[:16]


def sidecar_record(a: Accepted, image_in_workbook: bool, reuse: int, recrawl_days: int) -> dict:
    hours = a.raw.get("menu_hours")
    scope = clean_text(_first(a.raw, "menu_scope", default="")) or (clean_text(a.raw.get("menu_title")) or "unknown")
    return {
        "item_key": item_key(a.key), "licence": a.licence, "dish_name": a.name, "price_sgd": money_str(a.price),
        "discounted_price_sgd": money_str(a.discounted) if a.discounted is not None else None,
        "price_from": a.price_info.is_from, "price_options": [money_str(p) for p in a.price_info.options],
        "price_basis": a.price_basis, "price_excludes_service_charge": a.price_info.service_charge_excluded,
        "source_url": a.source_url, "source_type": a.source_type, "source": a.source,
        "captured_at": a.captured_at.isoformat(), "recrawl_after": (a.captured_at + timedelta(days=recrawl_days)).isoformat(),
        "verified": a.verified, "verified_by": a.raw.get("verified_by"), "verified_at": a.raw.get("verified_at"),
        "menu_id": a.raw.get("menu_id"), "menu_title": a.raw.get("menu_title"), "menu_description": a.raw.get("menu_description"),
        "menu_hours": hours, "menu_scope": scope, "other_menus_captured": bool(a.raw.get("other_menus_captured", False)),
        "also_in_menus": sorted(set(a.also_in_menus)), "stall_hours": a.raw.get("stall_hours"),
        "image_url_original": a.image_url, "image_quality": a.image_quality, "image_in_workbook": image_in_workbook,
        "image_reuse_count": reuse, "sold_out": a.sold_out, "identity": a.identity,
    }


@dataclass
class Plan:
    new_rows: list = field(default_factory=list)       # list of dicts keyed by column
    sidecar: list = field(default_factory=list)
    queue: list = field(default_factory=list)
    warnings: Counter = field(default_factory=Counter)
    stats: Counter = field(default_factory=Counter)
    per_licence: Counter = field(default_factory=Counter)
    partial_menu_licences: set = field(default_factory=set)


def _rank(a: Accepted) -> tuple:
    return (0 if a.raw.get("category") and clean_text(a.raw.get("category")).casefold() not in FEATURED_CATEGORIES else 1,
            0 if a.image_url else 1, -len(a.description))


def read_jsonl(path: Path) -> list:
    out = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, start=1):
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                if not isinstance(obj, dict):
                    raise ValueError("not an object")
                out.append((n, obj, None))
            except ValueError as e:
                out.append((n, None, f"{e}: {line[:120]!r}"))
    return out


def build_plan(rows: list, target: Target, master: dict, now: datetime, max_age_days: int,
               default_source_type=None, default_captured_at=None, recrawl_days: int = 30) -> Plan:
    plan = Plan()
    url_lics = defaultdict(set)
    for _, obj, err in rows:
        if obj:
            lic = clean_text(_first(obj, "licence", "sfa_licence", "stall_licence_no", default="")).upper()
            u = clean_text(_first(obj, "source_url", default=""))
            if lic and u:
                url_lics[u].add(lic)
    ctx = Context(target, master, now, max_age_days, default_source_type, default_captured_at, url_lics)

    groups: dict = {}
    for lineno, obj, err in rows:
        plan.stats["input_rows"] += 1
        if err:
            plan.queue.append({"reasons": ["invalid_json"], "line": lineno, "detail": {"error": err}})
            plan.stats["rejected"] += 1
            continue
        acc, reasons, detail, warns = validate_row(obj, ctx)
        plan.warnings.update(warns)
        if reasons:
            plan.queue.append({"reasons": reasons, "line": lineno, "detail": detail, "row": obj})
            plan.stats["rejected"] += 1
            for r in reasons:
                plan.stats[f"reject:{r}"] += 1
            continue
        groups.setdefault(acc.key, []).append(acc)

    chosen = []
    for key, members in groups.items():
        members.sort(key=_rank)
        best = members[0]
        plan.stats["duplicates_in_input"] += len(members) - 1
        best.also_in_menus = [clean_text(m.raw.get("menu_title")) for m in members[1:] if m.raw.get("menu_title")]
        chosen.append(best)

    # Reuse = rows already in the workbook + new rows; rows being re-seen are not counted twice (keeps re-runs identical).
    new_image_counts = Counter(a.image_url for a in chosen if a.image_url and a.key not in target.keys)
    for a in chosen:
        lic, nn, price = a.key
        if a.key in target.keys:
            plan.stats["already_present"] += 1
            accepted_new = False
        else:
            prior = target.prices_by_dish.get((lic, nn))
            if prior and price not in prior and "" not in prior:
                plan.queue.append({"reasons": ["price_changed_existing"], "row": a.raw,
                                   "detail": {"existing_prices": sorted(prior), "new_price": price}})
                plan.stats["rejected"] += 1
                plan.stats["reject:price_changed_existing"] += 1
                continue
            accepted_new = True
        reuse = target.image_counts[a.image_url] + new_image_counts[a.image_url] if a.image_url else 0
        image_ok = bool(a.image_url) and a.image_quality == "full" and reuse <= IMAGE_REUSE_LIMIT
        if a.image_url and reuse > IMAGE_REUSE_LIMIT:
            plan.warnings["image_generic_reuse_blanked"] += 1
        if a.image_url and a.image_quality == "thumbnail_only":
            plan.warnings["image_thumbnail_not_written"] += 1
        record = sidecar_record(a, image_ok, reuse, recrawl_days)
        row = None
        if accepted_new:
            row = {c: "" for c in target.header}
            row.update({c: v for c, v in DIET_DEFAULTS.items() if c in row})
            row.update({c: v for c, v in a.diet.items() if c in row})
            row.update({
                "F&B Venue Name": a.auth.name, "SFA Licence": a.licence, "Address": a.auth.address, "Postal Code": a.auth.postal,
                "Menu Item / Dish Name": a.name, "Price (SGD)": money_str(a.price), "Menu Source URL": a.source_url,
                "Last Verified Date": a.captured_at.astimezone(SGT).date().isoformat(),
            })
            for col, val in (("Category / Section", a.category), ("Description / Notes", build_notes(a)),
                             ("Dish Image URL", a.image_url if image_ok else "")):
                if col in row:
                    row[col] = val
            too_long = [c for c, v in row.items() if len(v) > MAX_CELL]
            if too_long:
                plan.queue.append({"reasons": ["cell_too_long"], "row": a.raw, "detail": {"columns": too_long}})
                plan.stats["rejected"] += 1
                plan.stats["reject:cell_too_long"] += 1
                continue
        plan.sidecar.append(record)
        if not a.raw.get("other_menus_captured") and a.raw.get("menu_title"):
            plan.partial_menu_licences.add(a.licence)
        if row is not None:
            plan.new_rows.append(row)
            plan.stats["new_rows"] += 1
            plan.per_licence[a.licence] += 1
    plan.stats["accepted"] = plan.stats["new_rows"] + plan.stats["already_present"]
    return plan


# ---------------------------------------------------------------- safe writing

def disk_free(path: Path) -> int:
    return shutil.disk_usage(path).free


def check_disk(dirs_and_sizes: list, free_fn: Callable = disk_free, factor: int = DISK_FACTOR) -> None:
    """dirs_and_sizes: [(directory, bytes_of_files_written_there)]. Refuse when free < factor x bytes (per device)."""
    need: dict = defaultdict(int)
    where: dict = {}
    for d, size in dirs_and_sizes:
        dev = os.stat(d).st_dev
        need[dev] += size * factor
        where[dev] = d
    for dev, required in need.items():
        free = free_fn(where[dev])
        if free < required:
            raise MergeError(f"Refusing to write: {free} bytes free in {where[dev]}, need at least {required} ({factor}x file size)", 3)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def make_backup(src: Path, backup_dir: Path, stamp: str) -> Path:
    dest = backup_dir / f"{src.stem}_before_menu_merge_{stamp}{src.suffix}"
    if dest.exists():
        raise MergeError(f"Backup already exists, refusing to overwrite: {dest}")
    shutil.copy2(src, dest)
    if dest.stat().st_size != src.stat().st_size or sha256_of(dest) != sha256_of(src):
        dest.unlink(missing_ok=True)
        raise MergeError("Backup verification failed (size or sha256 differs); nothing was changed", 4)
    return dest


def _append_rows(tmp_path: Path, header: list, rows: Iterable[dict], newline: str) -> None:
    with open(tmp_path, "rb+") as fb:
        fb.seek(0, os.SEEK_END)
        if fb.tell():
            fb.seek(-1, os.SEEK_END)
            if fb.read(1) not in (b"\n", b"\r"):
                fb.write(newline.encode())
        fb.seek(0, os.SEEK_END)
        text = io.TextIOWrapper(fb, encoding="utf-8", newline="", write_through=True)
        w = csv.writer(text, lineterminator=newline)
        for r in rows:
            w.writerow([r[c] for c in header])
        text.flush()
        text.detach()
        fb.flush()
        os.fsync(fb.fileno())


def validate_csv(path: Path, header: list, expected_rows: int, tail: list) -> None:
    n = len(header)
    count, last = 0, []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        if next(reader) != header:
            raise MergeError("Validation failed: header changed", 4)
        for row in reader:
            if len(row) != n:
                raise MergeError("Validation failed: ragged row", 4)
            count += 1
            if tail:
                last.append(row)
                if len(last) > len(tail):
                    last.pop(0)
    if count != expected_rows:
        raise MergeError(f"Validation failed: {count} rows, expected {expected_rows}", 4)
    if tail and last != tail:
        raise MergeError("Validation failed: appended rows differ from plan", 4)


def build_xlsx(csv_path: Path, out_path: Path, sheet_name: str) -> int:
    try:
        from openpyxl import Workbook, load_workbook
        from openpyxl.cell import WriteOnlyCell
    except ImportError:
        raise MergeError("openpyxl is required for --xlsx (pip install openpyxl)")
    if len(sheet_name) > 31 or re.search(r"[\[\]:*?/\\]", sheet_name):
        raise MergeError(f"Invalid sheet name: {sheet_name!r}")
    wb = Workbook(write_only=True)
    ws = wb.create_sheet(sheet_name)
    rows = 0
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            cells = []
            for v in row:
                c = WriteOnlyCell(ws, value=v)
                c.data_type = "s"  # never let '=' start a formula
                cells.append(c)
            ws.append(cells)
            rows += 1
    wb.save(out_path)
    with zipfile.ZipFile(out_path) as z:
        if z.testzip() is not None:
            raise MergeError("XLSX validation failed: corrupt zip member", 4)
    check = load_workbook(out_path, read_only=True)
    sheet = check[sheet_name]
    seen, width = 0, None
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        width = len(next(csv.reader(f)))
    for r in sheet.iter_rows(values_only=True):
        seen += 1
        if len(r) != width and any(x not in (None, "") for x in r[width:]):
            raise MergeError("XLSX validation failed: column count differs", 4)
    check.close()
    if seen != rows:
        raise MergeError(f"XLSX validation failed: {seen} rows, CSV has {rows}", 4)
    return rows


def atomic_write_text(path: Path, text: str) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def jsonl(records: Iterable[dict]) -> str:
    return "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in records)


def merged_sidecar(path: Path, records: list) -> tuple:
    """Upsert by item_key. Returns (new_text, changed)."""
    existing = {}
    if path.exists():
        for n, obj, err in read_jsonl(path):
            if err or "item_key" not in obj:
                raise MergeError(f"Sidecar {path} line {n} is invalid; fix it before merging (refusing to drop it silently)")
            existing[obj["item_key"]] = obj
    before = dict(existing)
    for r in records:
        existing[r["item_key"]] = r
    return jsonl(existing.values()), existing != before


def apply_plan(plan: Plan, target: Target, *, sidecar_path: Optional[Path], xlsx_path: Optional[Path], sheet_name: str,
               backup_dir: Path, stamp: str, free_fn: Callable = disk_free) -> dict:
    result = {"backups": [], "restore": [], "csv_rows_after": target.rows, "xlsx_rows": None}
    if not backup_dir.is_dir():
        raise MergeError(f"Backup directory does not exist: {backup_dir}")
    sidecar_text, sidecar_changed = (None, False)
    if sidecar_path:
        sidecar_text, sidecar_changed = merged_sidecar(sidecar_path, plan.sidecar)
    if not plan.new_rows and not sidecar_changed:
        return result  # idempotent no-op: no backup, no write

    sizes = [(target.path.parent, target.size)]
    if xlsx_path:
        sizes.append((xlsx_path.parent, (xlsx_path.stat().st_size if xlsx_path.exists() else 0) + target.size))
    if sidecar_path and sidecar_path.exists():
        sizes.append((sidecar_path.parent, sidecar_path.stat().st_size))
    sizes.append((backup_dir, target.size + (xlsx_path.stat().st_size if xlsx_path and xlsx_path.exists() else 0)))
    check_disk(sizes, free_fn)

    tmp_csv = tmp_xlsx = None
    replaced = []
    try:
        def backup(src: Path) -> None:
            b = make_backup(src, backup_dir, stamp)
            result["backups"].append(str(b))
            result["restore"].append(f'cp -p "{b}" "{src}"')

        if plan.new_rows:
            backup(target.path)
        if xlsx_path and xlsx_path.exists() and plan.new_rows:
            backup(xlsx_path)
        if sidecar_path and sidecar_path.exists() and sidecar_changed:
            backup(sidecar_path)

        if plan.new_rows:
            fd, tmp = tempfile.mkstemp(dir=target.path.parent, prefix=target.path.name + ".", suffix=".tmp")
            os.close(fd)
            tmp_csv = Path(tmp)
            shutil.copyfile(target.path, tmp_csv)
            _append_rows(tmp_csv, target.header, plan.new_rows, target.newline)
            tail = [[r[c] for c in target.header] for r in plan.new_rows[-50:]]
            validate_csv(tmp_csv, target.header, target.rows + len(plan.new_rows), tail)
            if xlsx_path:
                fd, tmpx = tempfile.mkstemp(dir=xlsx_path.parent, prefix=xlsx_path.name + ".", suffix=".tmp.xlsx")
                os.close(fd)
                tmp_xlsx = Path(tmpx)
                result["xlsx_rows"] = build_xlsx(tmp_csv, tmp_xlsx, sheet_name)
        # all temps validated; swap in
        if sidecar_path and sidecar_changed:
            atomic_write_text(sidecar_path, sidecar_text)
            replaced.append("sidecar")
        if tmp_csv:
            os.replace(tmp_csv, target.path)
            tmp_csv = None
            replaced.append("csv")
        if tmp_xlsx:
            os.replace(tmp_xlsx, xlsx_path)
            tmp_xlsx = None
            replaced.append("xlsx")
    except BaseException:
        for t in (tmp_csv, tmp_xlsx):
            if t:
                Path(t).unlink(missing_ok=True)
        if "csv" in replaced and "xlsx" not in replaced and xlsx_path and plan.new_rows:
            _restore(Path(result["backups"][0]), target.path)  # keep CSV and XLSX consistent
        raise
    result["csv_rows_after"] = target.rows + len(plan.new_rows)
    return result


def _restore(backup: Path, dest: Path) -> None:
    fd, tmp = tempfile.mkstemp(dir=dest.parent, prefix=dest.name + ".", suffix=".restore")
    os.close(fd)
    shutil.copyfile(backup, tmp)
    os.replace(tmp, dest)


# ---------------------------------------------------------------- CLI

def summary_text(plan: Plan, target: Target, applying: bool, restore: list) -> str:
    s = plan.stats
    lines = [
        f"Mode: {'APPLY' if applying else 'DRY RUN (nothing written)'}",
        f"Target: {target.path} ({target.rows} rows, {len(target.header)} columns, header order preserved)",
        f"Input rows: {s['input_rows']}   accepted: {s['accepted']}   rejected to review queue: {s['rejected']}",
        f"New rows to append: {s['new_rows']}   already present: {s['already_present']}   duplicates collapsed in input: {s['duplicates_in_input']}",
        f"Rows after merge: {target.rows + s['new_rows']}",
    ]
    rej = sorted((k[7:], v) for k, v in s.items() if k.startswith("reject:"))
    if rej:
        lines.append("Rejected by reason: " + ", ".join(f"{k}={v}" for k, v in rej))
    if plan.warnings:
        lines.append("Warnings: " + ", ".join(f"{k}={v}" for k, v in sorted(plan.warnings.items())))
    if plan.per_licence:
        top = ", ".join(f"{k}:{v}" for k, v in plan.per_licence.most_common(8))
        lines.append(f"New rows per licence (top 8): {top}")
    if plan.partial_menu_licences:
        lines.append(f"Stalls with only the menu active at capture (other menus not captured): {len(plan.partial_menu_licences)}")
    for cmd in restore:
        lines.append(f"Backup made. To restore: {cmd}")
    if applying and not restore:
        lines.append("Nothing to write (re-run is a no-op); no backup made.")
    return "\n".join(lines)


def main(argv=None, *, free_fn: Callable = disk_free) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--input", required=True, type=Path, help="JSONL of extracted rows")
    ap.add_argument("--target", required=True, type=Path, help="Doc 2 CSV; its header defines column order")
    ap.add_argument("--master", type=Path, help="Master database CSV (join by SFA Licence for name/address/postal)")
    ap.add_argument("--review-queue", type=Path, help="Write rejected rows here (default with --apply: <input>.review-queue.jsonl)")
    ap.add_argument("--sidecar", type=Path, help="Provenance sidecar JSONL (default: <target>.provenance.jsonl)")
    ap.add_argument("--no-sidecar", action="store_true")
    ap.add_argument("--apply", action="store_true", help="Write changes (default is a dry run)")
    ap.add_argument("--xlsx", type=Path, help="Rebuild this XLSX from the merged CSV (validated before replacing)")
    ap.add_argument("--sheet-name", default="Hungry Full Menu & Price")
    ap.add_argument("--backup-dir", type=Path, help="Default: the target's folder")
    ap.add_argument("--max-age-days", type=int, default=30, help="Reject captures older than this (0 disables)")
    ap.add_argument("--default-source-type", choices=SOURCE_TYPES)
    ap.add_argument("--default-captured-at", help="ISO-8601 with timezone, for rows that lack captured_at")
    ap.add_argument("--now", help="Override current time (ISO-8601 with timezone); for tests")
    ap.add_argument("--report", type=Path, help="Also write the summary as JSON here")
    args = ap.parse_args(argv)

    try:
        now = parse_iso(args.now) if args.now else datetime.now(timezone.utc)
        if now is None:
            raise MergeError("--now must be ISO-8601 with a timezone")
        if not args.input.is_file():
            raise MergeError(f"Input not found: {args.input}")
        target = load_target(args.target)
        rows = read_jsonl(args.input)
        lics = {clean_text(_first(o, "licence", "sfa_licence", "stall_licence_no", default="")).upper() for _, o, _e in rows if o}
        master = load_master(args.master, lics) if args.master else {}
        plan = build_plan(rows, target, master, now, args.max_age_days, args.default_source_type, args.default_captured_at)
        backup_dir = args.backup_dir or args.target.parent
        sidecar = None if args.no_sidecar else (args.sidecar or Path(str(args.target) + ".provenance.jsonl"))
        stamp = now.strftime("%Y%m%dT%H%M%SZ") if args.apply else "dryrun"
        queue_path = args.review_queue or (Path(str(args.input) + ".review-queue.jsonl") if args.apply else None)
        if queue_path:
            atomic_write_text(queue_path, jsonl(plan.queue))
        backups, result = [], {}
        if args.apply:
            result = apply_plan(plan, target, sidecar_path=sidecar, xlsx_path=args.xlsx, sheet_name=args.sheet_name,
                                backup_dir=backup_dir, stamp=stamp, free_fn=free_fn)
            backups = result["backups"]
        text = summary_text(plan, target, args.apply, result.get("restore", []))
        if queue_path:
            text += f"\nReview queue: {queue_path} ({len(plan.queue)} rows)"
        print(text)
        if args.report:
            atomic_write_text(args.report, json.dumps({
                "stats": dict(plan.stats), "warnings": dict(plan.warnings), "backups": backups,
                "applied": args.apply, "result": result, "queue_rows": len(plan.queue)}, indent=2, sort_keys=True) + "\n")
        return 0
    except MergeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return e.exit_code
    except OSError as e:
        print(f"ERROR: write failed, original files unchanged unless a backup path was printed: {e}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    sys.exit(main())
