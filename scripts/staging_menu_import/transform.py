"""Workbook -> staging table rows, with explicit counted filters.

Pure functions only (no DB, no network) so every rule is unit-testable.
The workbook is treated as read-only.
"""
from __future__ import annotations

import csv
import hashlib
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Iterable

IMPORT_NAMESPACE = uuid.UUID("5d1c7a63-7f3e-4c52-9a3b-0c4f1b6f2d11")
IMPORTER_VERSION = "1"

# --- filter reasons (order = first-match-wins for the exclusions CSV) -------------
R_QUARANTINED = "quarantined_row"
R_PRICE_NOT_PUBLISHED = "price_not_published"
R_NON_FOOD_STALL = "non_food_stall"
R_CONFIRMED_ERROR = "confirmed_error_active"
R_TEMPLATE = "template_pattern"
R_PRICE_OUTLIER = "price_outlier"
R_ENCODING = "encoding_damaged"
R_NO_PRICE_NO_SOURCE = "no_price_and_no_source"
R_NO_PRICE = "no_price"
R_NO_STALL_LINK = "no_stall_link"
R_DUPLICATE = "duplicate_licence_dish_price"
MENU_REASON_ORDER = [
    R_QUARANTINED, R_PRICE_NOT_PUBLISHED, R_NON_FOOD_STALL, R_CONFIRMED_ERROR, R_TEMPLATE,
    R_PRICE_OUTLIER, R_ENCODING, R_NO_PRICE_NO_SOURCE, R_NO_PRICE, R_NO_STALL_LINK, R_DUPLICATE,
]
R_STALL_QUARANTINED = "stall_quarantined_non_food"
R_STALL_NO_BUILDING = "stall_no_postal_for_building"
R_STALL_NO_COORDS = "stall_no_coordinates"

PRICE_MIN_EXCLUSIVE = 0.50   # price <= 0.50 is an outlier
PRICE_MAX = 200.0            # price > 200 is an outlier

# Generic default cuisines (4,692 directory rows in the 2026-11-04 workbook).
GENERIC_CUISINES = frozenset({"Local / Hawker Delights", "Local & Multi-Cuisine", "Drinks and coffee"})

DELIVERY_RE = re.compile(r"grab\.com|foodpanda\.|deliveroo\.", re.I)
DELIVERY_NAME_RE = re.compile(r"foodpanda|grab", re.I)
COUNTER_NOTE_RE = re.compile(r"official|counter|in-store", re.I)
VERIFIED_COUNTER_RE = re.compile(r"Verified Counter/Open-Source Price")
QUARANTINE_RE = re.compile(r"QUARANTINE", re.I)
PRICE_NOT_PUBLISHED_RE = re.compile(r"price not published", re.I)
ENCODING_RE = re.compile(
    r"&(?:#\d+|#x[0-9a-fA-F]+|amp|quot|lt|gt|apos|nbsp);|�|Ã[\x80-\xbf]|Â[\x80-\xbf]|â€|[\x00-\x08\x0b\x0c\x0e-\x1f\x80-\x9f]"
)

# Dietary mapping: workbook column -> app DietaryFlag slug (Yes => flag row).
DIET_YES_FLAG = {
    "Halal": "halal", "Vegetarian": "vegetarian", "Vegan": "vegan", "Pork-free": "pork_free",
    "Gluten-free": "gluten_free", "Dairy-free": "dairy_free", "Nut-free": "nut_free",
}
# Allergen columns: 'No' (explicitly absent) => the *_free flag. 'Yes' only records contains.
ALLERGEN_NO_FLAG = {
    "Beef": "beef_free", "Milk": "dairy_free", "Eggs": "egg_free", "Fish": "fish_free",
    "Crustaceans": "shellfish_free", "Soy": "soy_free", "Peanuts": "peanut_free", "Tree nuts": "nut_free",
}
ALLERGEN_COLUMNS = ["Beef", "Milk", "Eggs", "Fish", "Crustaceans", "Soy", "Peanuts", "Tree nuts", "Wheat"]
DIET_COLUMNS = list(DIET_YES_FLAG)
TASTE_COLUMNS = ["Sweet", "Spicy", "Sour", "Salty", "Rich", "Aromatic"]
ALL_FLAG_SLUGS = sorted(set(DIET_YES_FLAG.values()) | set(ALLERGEN_NO_FLAG.values()))
FLAG_NAMES = {s: s.replace("_", " ").title() for s in ALL_FLAG_SLUGS}


def norm_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value or "")).strip().lower()


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v or None


def parse_price(value: str | None) -> float | None:
    try:
        p = float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None
    if p is None or p != p:
        return None
    return round(p, 2)


def sha1_hex(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def batch_id_for(source_sha256: str) -> str:
    return str(uuid.uuid5(IMPORT_NAMESPACE, f"{source_sha256}:{IMPORTER_VERSION}"))


def is_delivery_url(url: str | None) -> bool:
    return bool(url and DELIVERY_RE.search(url))


def classify_price_confidence(source_url: str | None, notes: str | None) -> str:
    """counter_price | delivery_price | listed_price.

    sh confirmed (2026-11-11) the counter price IS the real price because Foodpanda
    and Grab inflate prices. Delivery-sourced rows carrying an official/counter
    note are therefore 'counter_price'. Delivery-sourced rows with NO such note
    only have a (possibly inflated) delivery-app price: they are still loaded and
    shown (decision 2026-11-12) but tagged 'delivery_price' so the app can label them.
    """
    notes = notes or ""
    if VERIFIED_COUNTER_RE.search(notes):
        return "counter_price"
    if is_delivery_url(source_url):
        return "counter_price" if COUNTER_NOTE_RE.search(notes) else "delivery_price"
    return "listed_price"


RIGHTS_OK = frozenset({"merchant_owned", "operator_owned", "user_submitted", "permitted_api", "licensed"})


def menu_is_displayable(approved: bool, rights: str | None, source_url: str | None) -> bool:
    """Python mirror of public.catalog_menu_is_displayable (live on staging, read 2026-11-12)."""
    rights = rights or "unverified"
    return bool(approved) and rights in RIGHTS_OK and (rights == "licensed" or not is_delivery_url(source_url))


def tri(value: str | None) -> str:
    v = (value or "").strip().lower()
    if v in ("yes", "y", "true"):
        return "yes"
    if v in ("no", "n", "false"):
        return "no"
    return "unknown"  # blank / 'Unknown' / anything else is never coerced to false


# ----------------------------------------------------------------------------------
@dataclass
class Sheet:
    headers: list[str]
    rows: list[list[str | None]]
    idx: dict[str, int] = field(init=False)

    def __post_init__(self) -> None:
        self.idx = {h: i for i, h in enumerate(self.headers)}

    def get(self, row: list[str | None], col: str) -> str | None:
        i = self.idx[col]
        return row[i] if i < len(row) else None


@dataclass
class Exclusion:
    kind: str           # 'menu_row' | 'stall'
    reason: str
    all_reasons: str
    key: str
    venue: str
    dish: str
    price: str
    licence: str


@dataclass
class Plan:
    batch_id: str
    source_sha256: str
    buildings: list[dict]
    venues: list[dict]
    dishes: list[dict]
    taste_vectors: list[dict]
    dietary_flag_seed: list[dict]
    dish_dietary_flags: list[dict]
    exclusions: list[Exclusion]
    counts: dict[str, Any]


def load_catalog_qa(confirmed_csv: str, templates_csv: str) -> tuple[set[tuple[str, str]], set[tuple[str, str]]]:
    confirmed: set[tuple[str, str]] = set()
    with open(confirmed_csv, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            confirmed.add((r["licence"].strip(), norm_text(r["dish"])))
    templates: set[tuple[str, str]] = set()
    with open(templates_csv, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            p = parse_price(r["price"])
            templates.add((norm_text(r["dish"]), f"{p:.2f}" if p is not None else ""))
    return confirmed, templates


# ----------------------------------------------------------------------------------
def stall_key_for(licence: str | None, name: str | None, address: str | None, postal: str | None) -> str:
    if licence:
        return licence.strip()
    return "x" + sha1_hex(norm_text(name), norm_text(address), (postal or "").strip())[:16]


def building_key_for(venue_id: str | None, postal: str | None, address: str | None) -> str | None:
    if venue_id:
        return venue_id.strip()
    p = (postal or "").strip()
    if not p and address:
        m = re.search(r"Singapore\s+(\d{6})", address)
        p = m.group(1) if m else ""
    return f"VEN-{p}" if re.fullmatch(r"\d{6}", p) else None


def building_name_from_address(address: str | None, fallback: str) -> str:
    if not address:
        return fallback
    parts = [p.strip() for p in address.split(",") if p.strip()]
    middle = [p for p in parts[1:-1] if not p.startswith("#")]
    if middle:
        return middle[0].title() if middle[0].isupper() else middle[0]
    return re.sub(r"\s*#.*$", "", parts[0]).title() if parts else fallback


def building_type_for(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ("hawker", "food centre", "market", "open-air", "street food")):
        return "hawker_centre"
    if any(k in n for k in ("food court", "kopitiam", "foodare", "food junction", "koufu", "food republic")):
        return "food_court"
    if any(k in n for k in ("mall", "plaza", "square", "point", "shopping", "hub", "atria", "jewel", "centre", "complex")):
        return "mall"
    return "other"


def parse_unit_floor(address: str | None) -> tuple[str, str]:
    m = re.search(r"#([A-Za-z]{0,2}\d+)-[A-Za-z0-9]+", address or "")
    if not m:
        return "", "L1"
    unit = re.search(r"#[A-Za-z0-9]+-[A-Za-z0-9]+", address).group(0)
    fl = m.group(1)
    if fl.isdigit():
        return unit, f"L{int(fl)}"
    return unit, fl.upper()


def parse_rating(value: str | None) -> tuple[float | None, int | None]:
    m = re.match(r"\s*([0-9.]+)\s*\(([\d,]+)\)", value or "")
    if not m:
        return None, None
    try:
        r = float(m.group(1))
        return (r if 0 <= r <= 5 else None), int(m.group(2).replace(",", ""))
    except ValueError:
        return None, None


def parse_dmy(value: str | None) -> str | None:
    m = re.fullmatch(r"\s*(\d{2})-(\d{2})-(\d{4})\s*", value or "")
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
    except ValueError:
        return None


def to_float(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


# ----------------------------------------------------------------------------------
def build_plan(
    directory: Sheet,
    menu: Sheet,
    *,
    source_sha256: str,
    confirmed_errors: set[tuple[str, str]],
    template_rows: set[tuple[str, str]],
    approve_menu_display: bool = False,
) -> Plan:
    batch_id = batch_id_for(source_sha256)
    exclusions: list[Exclusion] = []
    counts: dict[str, Any] = {}

    # ---- directory (stall) pass -------------------------------------------------
    flagged_idx: set[int] = set()
    by_licence: dict[str, int] = {}
    by_name: dict[str, list[int]] = defaultdict(list)
    for i, row in enumerate(directory.rows):
        cov = directory.get(row, "Coverage Status") or ""
        if QUARANTINE_RE.search(cov):
            flagged_idx.add(i)
        lic = clean(directory.get(row, "SFA Licence"))
        if lic and lic not in by_licence:
            by_licence[lic] = i
        by_name[norm_text(directory.get(row, "F&B Name"))].append(i)
    counts["directory_rows"] = len(directory.rows)
    counts["directory_quarantined_non_food_stalls"] = len(flagged_idx)
    for i in sorted(flagged_idx):
        row = directory.rows[i]
        exclusions.append(Exclusion("stall", R_STALL_QUARANTINED, R_STALL_QUARANTINED,
                                    clean(directory.get(row, "SFA Licence")) or f"row{i + 2}",
                                    directory.get(row, "F&B Name") or "", "", "", directory.get(row, "SFA Licence") or ""))

    def link_stall(licence: str | None, venue_name: str | None) -> int | None:
        if licence and licence in by_licence:
            return by_licence[licence]
        if not licence:
            cands = by_name.get(norm_text(venue_name), [])
            if len(cands) == 1:
                return cands[0]
        return None

    # ---- menu pass: row-level filters ------------------------------------------
    surviving: list[tuple[int, list[str | None], int]] = []   # (row index, row, directory index)
    matched_any: Counter = Counter()
    first_reason: Counter = Counter()
    link_how: Counter = Counter()
    seen_dupe: dict[tuple[str, str, str], int] = {}
    n_menu = len(menu.rows)
    counts["menu_rows"] = n_menu

    for mi, row in enumerate(menu.rows):
        g = lambda c: menu.get(row, c)  # noqa: E731
        notes = g("Description / Notes") or ""
        name = clean(g("Menu Item / Dish Name")) or ""
        venue = clean(g("F&B Venue Name")) or ""
        licence = clean(g("SFA Licence"))
        price = parse_price(g("Price (SGD)"))
        source = clean(g("Menu Source URL"))
        di = link_stall(licence, venue)
        if di is not None:
            link_how["licence" if licence else "unique_exact_name"] += 1
        reasons: list[str] = []
        if QUARANTINE_RE.search(notes):
            reasons.append(R_QUARANTINED)
        if price is not None and PRICE_NOT_PUBLISHED_RE.search(notes):
            reasons.append(R_PRICE_NOT_PUBLISHED)
        if di is not None and di in flagged_idx:
            reasons.append(R_NON_FOOD_STALL)
        if licence and (licence, norm_text(name)) in confirmed_errors:
            reasons.append(R_CONFIRMED_ERROR)
        if price is not None and (norm_text(name), f"{price:.2f}") in template_rows:
            reasons.append(R_TEMPLATE)
        if price is not None and (price <= PRICE_MIN_EXCLUSIVE or price > PRICE_MAX):
            reasons.append(R_PRICE_OUTLIER)
        if any(ENCODING_RE.search(g(c) or "") for c in ("Menu Item / Dish Name", "F&B Venue Name", "Category / Section")):
            reasons.append(R_ENCODING)
        if price is None:
            reasons.append(R_NO_PRICE_NO_SOURCE if not source else R_NO_PRICE)
        if di is None:
            reasons.append(R_NO_STALL_LINK)
        for r_ in reasons:
            matched_any[r_] += 1
        if not reasons:
            drow = directory.rows[di]
            sk = stall_key_for(clean(directory.get(drow, "SFA Licence")), directory.get(drow, "F&B Name"),
                               directory.get(drow, "Full Address"), directory.get(drow, "Postal Code"))
            dkey = (sk, norm_text(name), f"{price:.2f}")
            if dkey in seen_dupe:
                reasons.append(R_DUPLICATE)
                matched_any[R_DUPLICATE] += 1
            else:
                seen_dupe[dkey] = mi
        if reasons:
            first = next(r_ for r_ in MENU_REASON_ORDER if r_ in reasons)
            first_reason[first] += 1
            exclusions.append(Exclusion("menu_row", first, "|".join(r_ for r_ in MENU_REASON_ORDER if r_ in reasons),
                                        f"menu_row_{mi + 2}", venue, name, g("Price (SGD)") or "", licence or ""))
        else:
            surviving.append((mi, row, di))

    counts["menu_rows_excluded_first_match"] = {r_: first_reason.get(r_, 0) for r_ in MENU_REASON_ORDER}
    counts["menu_rows_matching_reason_any_overlap"] = {r_: matched_any.get(r_, 0) for r_ in MENU_REASON_ORDER}
    counts["menu_rows_linked_to_stall_by"] = dict(link_how)
    counts["menu_rows_surviving"] = len(surviving)

    # ---- venues / buildings -----------------------------------------------------
    stalls_with_dishes: dict[int, list[tuple[int, list[str | None]]]] = defaultdict(list)
    for mi, row, di in surviving:
        stalls_with_dishes[di].append((mi, row))

    venues: list[dict] = []
    buildings: dict[str, dict] = {}
    venue_id_by_dir: dict[int, str] = {}
    venue_by_id: dict[str, dict] = {}
    cat_counts_by_dir: dict[int, Counter] = defaultdict(Counter)
    for di, rows_ in stalls_with_dishes.items():
        for _mi, row in rows_:
            cat = clean(menu.get(row, "Category / Section"))
            if cat:
                cat_counts_by_dir[di][cat] += 1
    canonical = {c for ctr in cat_counts_by_dir.values() for c in ctr}
    counts["canonical_categories"] = len(canonical)

    generic_dir = 0
    venues_generic_tags = 0
    venues_cuisine_empty = 0
    stall_excl = Counter()
    for di, row in enumerate(directory.rows):
        if di in flagged_idx:
            continue
        g = lambda c: directory.get(row, c)  # noqa: E731
        raw_cuisine = clean(g("Cuisine"))
        if raw_cuisine in GENERIC_CUISINES:
            generic_dir += 1
        name = clean(g("F&B Name")) or "Unnamed stall"
        address = clean(g("Full Address"))
        postal = clean(g("Postal Code"))
        bkey = building_key_for(clean(g("Venue ID")), postal, address)
        if not bkey:
            stall_excl[R_STALL_NO_BUILDING] += 1
            exclusions.append(Exclusion("stall", R_STALL_NO_BUILDING, R_STALL_NO_BUILDING, clean(g("SFA Licence")) or f"row{di + 2}",
                                        name, "", "", clean(g("SFA Licence")) or ""))
            continue
        lat, lng = to_float(g("Latitude")), to_float(g("Longitude"))
        if lat is None or lng is None or not (1.1 <= lat <= 1.5 and 103.5 <= lng <= 104.2):
            stall_excl[R_STALL_NO_COORDS] += 1
            exclusions.append(Exclusion("stall", R_STALL_NO_COORDS, R_STALL_NO_COORDS, clean(g("SFA Licence")) or f"row{di + 2}",
                                        name, "", "", clean(g("SFA Licence")) or ""))
            continue
        licence = clean(g("SFA Licence"))
        skey = stall_key_for(licence, name, address, postal)
        vid = f"ven-{skey}"
        venue_id_by_dir[di] = vid
        bid = "bld-" + hashlib.md5(bkey.lower().encode()).hexdigest()
        if bid not in buildings:
            bname = building_name_from_address(address, bkey)
            buildings[bid] = {
                "id": bid, "name": bname, "building_type": building_type_for(bname), "latitude": lat, "longitude": lng,
                "address": address, "postal_code": postal, "source_type": "spreadsheet", "source_confidence": 0.85,
                "import_batch_id": batch_id,
            }
        unit, floor = parse_unit_floor(address)
        rating, rcount = parse_rating(g("Rating / Review Count"))
        cats = [c for c, _ in cat_counts_by_dir.get(di, Counter()).most_common(3)]
        is_generic = False
        if cats:
            cuisine_tags = cats
        elif raw_cuisine in canonical:
            cuisine_tags = [raw_cuisine]
        elif raw_cuisine in GENERIC_CUISINES:
            cuisine_tags, is_generic = [raw_cuisine], True
            venues_generic_tags += 1
        else:
            cuisine_tags = []
            venues_cuisine_empty += 1
        menu_url = clean(g("Menu URL"))
        site = clean(g("Website"))
        venue_by_id[vid] = venue = {
            "id": vid, "building_id": bid, "name": name, "unit_number": unit, "floor": floor,
            "hygiene_grade": None, "is_open": True,   # hygiene grade is removed from the database (2026-11-12): never set
            "operating_hours": clean(g("Opening Hours / Closed Days")) or "",
            "stall_id": skey, "licence_no": licence, "cuisine_tags": cuisine_tags, "dietary_tags": [],
            "image_url": clean(g("Approved Image URL")), "latitude": lat, "longitude": lng, "address": address,
            "postal_code": postal, "google_place_id": clean(g("Google Place ID")),   # attribute only, never a key
            "google_rating": rating, "google_review_count": rcount, "source_type": "spreadsheet",
            "source_confidence": 0.85, "last_verified_at": parse_dmy(g("SFA Verified Date")),
            "website_url": site if not is_delivery_url(site) else None,
            "contact_phone": clean(g("Contact Details")),
            "menu_url": None if is_delivery_url(menu_url) else menu_url,
            "secondary_menu_url": menu_url if is_delivery_url(menu_url) else (site if is_delivery_url(site) else None),
            "is_generic_cuisine": is_generic, "import_batch_id": batch_id,
            "menu_approved_for_display": approve_menu_display,
            "menu_rights_status": "operator_owned" if approve_menu_display else "unverified",
        }
        venues.append(venue)
    counts["directory_cuisine_generic_rows"] = generic_dir
    counts["venues_with_generic_default_cuisine_tags"] = venues_generic_tags
    counts["venues_with_empty_cuisine_tags"] = venues_cuisine_empty
    counts["stall_level_exclusions"] = {R_STALL_QUARANTINED: len(flagged_idx), **dict(stall_excl)}

    # ---- dishes -----------------------------------------------------------------
    dishes: list[dict] = []
    tastes: list[dict] = []
    flag_rows: list[dict] = []
    pc_counts: Counter = Counter()
    dietary_unknown = Counter()
    dropped_no_venue = 0
    id_collisions = 0
    seen_ids: set[str] = set()
    for mi, row, di in surviving:
        vid = venue_id_by_dir.get(di)
        if not vid:      # stall dropped at stall level (no building/coords): dish can't load
            dropped_no_venue += 1
            exclusions.append(Exclusion("menu_row", R_STALL_NO_COORDS, R_STALL_NO_COORDS, f"menu_row_{mi + 2}",
                                        menu.get(row, "F&B Venue Name") or "", menu.get(row, "Menu Item / Dish Name") or "",
                                        menu.get(row, "Price (SGD)") or "", menu.get(row, "SFA Licence") or ""))
            continue
        g = lambda c: menu.get(row, c)  # noqa: E731
        name = clean(g("Menu Item / Dish Name")) or ""
        price = parse_price(g("Price (SGD)"))
        source = clean(g("Menu Source URL"))
        skey = vid[4:]
        did = "dsh-" + sha1_hex(skey, norm_text(name), f"{price:.2f}")[:24]
        if did in seen_ids:
            id_collisions += 1
            continue
        seen_ids.add(did)
        cat = clean(g("Category / Section"))
        conf = classify_price_confidence(source, g("Description / Notes"))
        pc_counts[conf] += 1
        delivery = is_delivery_url(source)
        if delivery and conf == "counter_price":
            pc_counts["counter_price_with_delivery_source_link"] += 1
        palette = [t.strip() for t in (g("Taste Palette") or "").split(",") if t.strip()]
        diet = {DIET_YES_FLAG[k]: tri(g(k)) for k in DIET_COLUMNS}
        contains = {k.lower().replace(" ", "_"): tri(g(k)) for k in ALLERGEN_COLUMNS}
        for k, v in {**diet, **contains}.items():
            if v == "unknown":
                dietary_unknown[k] += 1
        dishes.append({
            "id": did, "venue_id": vid, "building_id": venue_by_id[vid]["building_id"],
            "name": name, "description": clean(strip_notes(g("Description / Notes"))), "image_url": clean(g("Dish Image URL")),
            "price": price, "price_range": f"S${price:.2f}", "taste_tags": palette, "cuisine_tags": [cat] if cat else [],
            "food_type": cat, "source_type": "spreadsheet", "source_confidence": 0.85,
            "menu_source_url": None if delivery else source, "secondary_menu_url": source if delivery else None,
            "price_confidence": conf, "is_generic_cuisine": False,
            "dietary_status": {"flags": diet, "contains": contains,
                               "intolerances": clean(g("Intolerances")) or "Not assessed"},
            "menu_approved_for_display": approve_menu_display,
            "menu_rights_status": "operator_owned" if approve_menu_display else "unverified",
            "import_batch_id": batch_id,
        })
        vec = [to_float(g(c)) for c in TASTE_COLUMNS]
        if all(v is not None and 0 <= v <= 10 for v in vec):
            tastes.append({"dish_id": did, **{c.lower(): v for c, v in zip(TASTE_COLUMNS, vec)},
                           "confidence": 0.3, "source": "category_baseline", "import_batch_id": batch_id})
        slugs: set[str] = set()
        for col, slug in DIET_YES_FLAG.items():
            if diet[slug] == "yes":
                slugs.add(slug)
        for col, slug in ALLERGEN_NO_FLAG.items():
            if contains[col.lower().replace(" ", "_")] == "no":
                slugs.add(slug)
        for s in sorted(slugs):
            flag_rows.append({"dish_id": did, "slug": s, "import_batch_id": batch_id})

    displayable = [d for d in dishes if d["price"] > 0 and menu_is_displayable(d["menu_approved_for_display"], d["menu_rights_status"], d["menu_source_url"])]
    counts["display"] = {
        "menu_display_approved": approve_menu_display,
        "dishes_loaded": len(dishes),
        "dishes_discovery_visible": len(displayable),
        "venues_with_discovery_visible_dish": len({d["venue_id"] for d in displayable}),
    }
    counts["venues_with_hygiene_grade_set"] = sum(1 for v in venues if v["hygiene_grade"] is not None)
    counts["dishes_dropped_stall_without_building_or_coords"] = dropped_no_venue
    counts["dish_id_collisions_skipped"] = id_collisions
    counts["price_confidence"] = dict(pc_counts)
    counts["dietary_unknown_by_field"] = dict(dietary_unknown)
    counts["taste_source_category_baseline"] = len(tastes)
    counts["taste_vectors_distinct"] = len({(t["sweet"], t["spicy"], t["sour"], t["salty"], t["rich"], t["aromatic"]) for t in tastes})

    used_flags = sorted({r["slug"] for r in flag_rows})
    seed = [{"slug": s, "name": FLAG_NAMES[s]} for s in ALL_FLAG_SLUGS]
    counts["rows_to_insert"] = {
        "buildings": len(buildings), "venues": len(venues), "dishes": len(dishes),
        "dish_taste_vectors": len(tastes), "dietary_flags(seed)": len(seed), "dish_dietary_flags": len(flag_rows),
    }
    counts["dish_dietary_flag_slugs_used"] = used_flags
    counts["menu_row_total_exclusions"] = sum(1 for e in exclusions if e.kind == "menu_row")
    return Plan(batch_id, source_sha256, list(buildings.values()), venues, dishes, tastes, seed, flag_rows, exclusions, counts)


INTERNAL_NOTE_RE = re.compile(
    r"SFA licen[cs]e|GrabFood|Grab Dine|Foodpanda|foodpanda|Deliveroo|HTTP \d{3}|candidate|verification|verified|"
    r"source URL|outlet[- ]specific|outlet availability|brand[- ]level|catalogue|catalog|identity|quarantin|"
    r"price not published|Pass \d|crawl|scrap|payload|Official [A-Za-z' &.-]+ menu item|open-source|not confirmed|"
    r"delivery price|in-store",
    re.I,
)


def strip_notes(notes: str | None) -> str | None:
    """Keep only customer-facing description text.

    The Description / Notes column mixes the dish description with internal
    audit notes (verification tags, crawl evidence). Segments (split on ' | ')
    that look like audit notes are dropped; bracketed tags are removed; the
    result is capped at 300 characters.
    """
    if not notes:
        return None
    text = re.sub(r"\[[^\]]*\]", "", notes)
    kept = [seg.strip() for seg in text.split("|") if seg.strip() and not INTERNAL_NOTE_RE.search(seg)]
    out = re.sub(r"\s+", " ", " ".join(kept)).strip()
    return out[:300] or None
