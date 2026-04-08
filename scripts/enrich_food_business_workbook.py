#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import subprocess
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable

try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
except ModuleNotFoundError as exc:  # pragma: no cover - runtime guard
    raise SystemExit(
        "Missing dependency: openpyxl. Install it with `python3 -m pip install openpyxl` "
        "and rerun this script."
    ) from exc


WORKBOOK_TITLE = "Singapore Food Stalls & Restaurants Database — Hungry App"
TODAY = date.today().isoformat()

EATING_ESTABLISHMENTS_DATASET_ID = "d_1f0313499a17075d13aae6ed3e825bc6"
EATING_ESTABLISHMENTS_DATASET_URL = (
    "https://data.gov.sg/datasets/d_1f0313499a17075d13aae6ed3e825bc6/view"
)
EATING_ESTABLISHMENTS_SOURCE_TYPE = "data.gov.sg:SFA Eating Establishments"

GRADING_DATASET_ID = "d_546a95c5e6a0a264a82247ec107a0629"
GRADING_DATASET_URL = (
    "https://data.gov.sg/datasets/d_546a95c5e6a0a264a82247ec107a0629/view"
)

HAWKER_CENTRES_DATASET_ID = "d_bda4baa634dd1cc7a6c7cad5f19e2d68"
HAWKER_CENTRES_DATASET_URL = (
    "https://data.gov.sg/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/view"
)
HAWKER_CENTRES_SOURCE_TYPE = "data.gov.sg:NEA Hawker Centres Directory"
WHYQ_SITEMAP_URL = "https://www.whyq.sg/sitemap.xml"
WHYQ_SOURCE_TYPE = "WhyQ Corporate Catering"
FOOD_REPUBLIC_OUTLETS_URL = "https://foodrepublic.com.sg/food-republic-outlets/"
FOOD_REPUBLIC_SOURCE_TYPE = "Food Republic Outlets"
DEFAULT_SEED_SNAPSHOT_PATH = Path("data/singapore_food_stalls_seed_curated.csv")

DEFAULT_SEED_SOURCE_TYPE = "Curated workbook seed"

NULLISH_VALUES = {"", "-", "—", "N/A", "NA", "nil", "None", "none", "null"}
MALL_KEYWORDS = {
    "MALL",
    "PLAZA",
    "POINT",
    "SQUARE",
    "HUB",
    "TOWER",
    "CENTRE",
    "CENTER",
    "SANDS",
    "COMPLEX",
    "JUNCTION",
    "GATEWAY",
    "ATRIUM",
    "EXCHANGE",
}
FOOD_COURT_KEYWORDS = {
    "FOOD COURT",
    "FOOD REPUBLIC",
    "FOOD JUNCTION",
    "KOPITIAM",
    "KOUFU",
    "CANTEEN",
    "FOOD HUB",
}
CAFE_KEYWORDS = {
    "CAFE",
    "COFFEE",
    "TOAST",
    "JUICE",
    "JUICES",
    "TEA",
    "BAKERY",
    "PATISSERIE",
    "ESPRESSO",
    "BREW",
}
BAR_KEYWORDS = {
    "BISTRO",
    "BAR",
    "TAPROOM",
    "PUB",
    "SPEAKEASY",
}
OTHER_KEYWORDS = {
    "7 ELEVEN",
    "CHEERS",
    "COLD STORAGE",
    "NTUC FAIRPRICE",
    "MINIMART",
}
SHOUSE_STREET_KEYWORDS = {
    "ROAD",
    "STREET",
    "LANE",
    "AVENUE",
    "DRIVE",
    "WAY",
}
PLACE_SUFFIX_PATTERNS = (
    r"\bmarket\s*&\s*food\s*centre\b",
    r"\bmarket\s+and\s+food\s+centre\b",
    r"\bfood\s+centre\b",
    r"\bhawker\s+centre\b",
    r"\binterim\s+hawker\s+centre\b",
    r"\bfood\s+court\b",
    r"\bkopitiam\b",
    r"\bmarket\b",
)
FOOD_REPUBLIC_SKIP_LABELS = {
    "featured stalls",
    "mini restaurant",
    "kiosks",
}
FOOD_REPUBLIC_LOCATION_OVERRIDES = {
    "the food place by food republic @ raffles city": {
        "place_name": "Raffles City Shopping Centre",
        "address": "252 North Bridge Road",
        "postal": "179103",
    },
    "food republic @ 313 somerset": {
        "place_name": "313@Somerset",
        "address": "313 Orchard Road",
        "postal": "238895",
    },
    "food republic @ 313@somerset": {
        "place_name": "313@Somerset",
        "address": "313 Orchard Road",
        "postal": "238895",
    },
    "food republic @ breadtalk ihq": {
        "place_name": "BreadTalk IHQ",
        "address": "30 Tai Seng Street",
        "postal": "534013",
    },
    "food republic @ causeway point": {
        "place_name": "Causeway Point",
        "address": "1 Woodlands Square",
        "postal": "738099",
    },
    "food republic @ city square mall": {
        "place_name": "City Square Mall",
        "address": "180 Kitchener Road",
        "postal": "208539",
    },
    "food republic @ jewel": {
        "place_name": "Jewel Changi Airport",
        "address": "78 Airport Boulevard",
        "postal": "819666",
    },
    "food republic @ nex": {
        "place_name": "NEX",
        "address": "23 Serangoon Central",
        "postal": "556083",
    },
    "food opera @ ion orchard": {
        "place_name": "ION Orchard",
        "address": "2 Orchard Turn",
        "postal": "238801",
    },
    "food republic @ shaw house": {
        "place_name": "Shaw House",
        "address": "350 Orchard Road",
        "postal": "238868",
    },
    "food republic @ suntec city": {
        "place_name": "Suntec City Mall",
        "address": "3 Temasek Boulevard",
        "postal": "038983",
    },
    "food republic @ the woodleigh mall": {
        "place_name": "The Woodleigh Mall",
        "address": "11 Bidadari Park Drive",
        "postal": "367803",
    },
    "food republic @ vivocity": {
        "place_name": "VivoCity",
        "address": "1 HarbourFront Walk",
        "postal": "098585",
    },
    "food republic @ wisma atria": {
        "place_name": "Wisma Atria",
        "address": "435 Orchard Road",
        "postal": "238877",
    },
}

MAIN_COLUMNS = [
    "Business ID",
    "Stall ID",
    "Licence No",
    "Stall / Restaurant Name",
    "Business Name Normalized",
    "Stall Type",
    "Cuisine",
    "Signature Dish",
    "Menu",
    "Price",
    "Price Min (SGD)",
    "Price Max (SGD)",
    "Opening Hours",
    "Closed Days",
    "NEA Hygiene Grade",
    "Michelin Recognition",
    "Dietary Options",
    "Delivery Platforms",
    "Contact",
    "Instagram",
    "Image URL",
    "Hawker Centre / Building",
    "Building Name",
    "Unit No.",
    "Address",
    "Postal Code",
    "Region",
    "Location",
    "Location Key",
    "Latitude",
    "Longitude",
    "Source Type",
    "Source URL",
    "Last Verified Date",
    "Coverage Status",
    "Notes",
]

FIELD_GUIDE = [
    ("Business ID", "Text", "Yes", "Canonical row identifier for one business outlet at one location.", "SG001 / SFA-CE16G95X000", "Existing workbook ID or official licence-derived identifier."),
    ("Stall ID", "Text", "No", "Legacy workbook identifier preserved for seeded rows.", "SG001", "Blank for newly imported rows unless a legacy value exists."),
    ("Licence No", "Text", "No", "Official food-establishment licence number where available.", "CE16G95X000", "Merged from SFA datasets."),
    ("Stall / Restaurant Name", "Text", "Yes", "Business-facing outlet name.", "Tian Tian Hainanese Chicken Rice", "Seed workbook overrides official name when richer."),
    ("Business Name Normalized", "Text", "Yes", "Lowercase normalized value used for dedupe and database joins.", "tian tian hainanese chicken rice", "Generated."),
    ("Stall Type", "Categorical", "Yes", "Closed vocabulary classification of the outlet type.", "Hawker Stall", "Generated using hawker/food-court/chain/cafe heuristics."),
    ("Cuisine", "Text", "No", "Primary cuisine classification.", "Hainanese", "Seed workbook only unless manually enriched later."),
    ("Signature Dish", "Text", "No", "Primary dish associated with the business.", "Hainanese Chicken Rice", "Seed workbook only unless manually enriched later."),
    ("Menu", "Long Text", "No", "Concise plain-text menu summary.", "Chicken Rice, Roasted Chicken Rice", "Blank when unavailable."),
    ("Price", "Text", "No", "Human-readable price range.", "$3–$6", "Derived from seed workbook or left blank."),
    ("Price Min (SGD)", "Numeric", "No", "Lowest numeric value parsed from Price.", "3", "Generated from Price."),
    ("Price Max (SGD)", "Numeric", "No", "Highest numeric value parsed from Price.", "6", "Generated from Price."),
    ("Opening Hours", "Text", "No", "Human-readable opening hours.", "Mon–Sun 10:00–20:00", "Blank when unavailable."),
    ("Closed Days", "Text", "No", "Known closure or regular off day.", "Tue", "Seed workbook or blank."),
    ("NEA Hygiene Grade", "Text", "No", "Official hygiene grading where available.", "A", "Merged from SFA grading dataset."),
    ("Michelin Recognition", "Text", "No", "Michelin or Bib Gourmand recognition.", "Michelin Bib Gourmand", "Seed workbook or manual enrichment."),
    ("Dietary Options", "Text", "No", "Any dietary indication captured in source data.", "Halal-friendly", "Seed workbook only."),
    ("Delivery Platforms", "Text", "No", "Known delivery platform list.", "GrabFood, foodpanda", "Seed workbook only."),
    ("Contact", "Text", "No", "Phone or contact point.", "6225 5506", "Seed workbook only."),
    ("Instagram", "Text", "No", "Instagram handle or profile.", "@tiantianchickenrice", "Seed workbook only."),
    ("Image URL", "URL", "No", "Public image URL for the outlet or associated hawker centre.", "https://www.nea.gov.sg/...", "Hawker centre image when official outlet image is unavailable."),
    ("Hawker Centre / Building", "Text", "No", "Original building field kept for compatibility.", "Maxwell Food Centre", "Existing workbook compatibility field."),
    ("Building Name", "Text", "No", "Normalized building or mall name.", "Marina Bay Sands", "Derived from official address where possible."),
    ("Unit No.", "Text", "No", "Outlet unit identifier.", "#01-10", "Normalized from seed or official data."),
    ("Address", "Text", "Yes", "Street-level address line without duplicated building fragments where possible.", "1 Kadayanallur St", "Required locational anchor."),
    ("Postal Code", "Text", "No", "Singapore postal code.", "069184", "Normalized to 6 digits when available."),
    ("Region", "Text", "No", "Singapore region label.", "Central", "Inherited from seed data or hawker directory when known."),
    ("Location", "Text", "Yes", "Human-readable location string combining building, unit, address, postal code, and region.", "Maxwell Food Centre, #01-10, 1 Kadayanallur St, Singapore 069184, Central", "Generated for user-facing display."),
    ("Location Key", "Text", "Yes", "Normalized key used for dedupe across sources.", "maxwell food centre|#01-10|069184", "Generated."),
    ("Latitude", "Numeric", "No", "Latitude from official geospatial source.", "1.279129028", "Merged from official datasets."),
    ("Longitude", "Numeric", "No", "Longitude from official geospatial source.", "103.8469849", "Merged from official datasets."),
    ("Source Type", "Text", "Yes", "Primary source class for the row.", "data.gov.sg:SFA Eating Establishments", "Set per row."),
    ("Source URL", "URL", "Yes", "Primary traceable source URL for the row.", "https://data.gov.sg/datasets/...", "Used for data review."),
    ("Last Verified Date", "Date", "Yes", "Date the row was last regenerated or verified.", TODAY, "Generated on workbook refresh."),
    ("Coverage Status", "Categorical", "Yes", "Completeness status for downstream review.", "Partial", "Generated as Complete / Partial / Needs Review."),
    ("Notes", "Long Text", "No", "Free-text notes or source conflict details.", "Featured in CNN Travel", "Preserved from seed workbook."),
]

HAWKER_DIRECTORY_COLUMNS = [
    "HC ID",
    "Name",
    "Region",
    "Address",
    "Postal Code",
    "No. Food Stalls",
    "No. Market Stalls",
    "Latitude",
    "Longitude",
    "Photo URL",
    "Google 3D View",
    "Status",
    "Description",
    "Source URL",
    "Last Verified Date",
]


@dataclass
class HawkerCentre:
    name: str
    address: str
    postal_code: str
    region: str
    photo_url: str
    food_stall_count: str
    market_stall_count: str
    latitude: str
    longitude: str
    status: str
    description: str
    google_3d_view: str
    source_url: str = HAWKER_CENTRES_DATASET_URL


@dataclass
class PlaceReference:
    building_name: str
    address: str
    postal_code: str
    region: str
    latitude: str
    longitude: str
    image_url: str


def is_blank(value: object) -> bool:
    text = clean_text(value)
    return text in NULLISH_VALUES


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in NULLISH_VALUES else text


def first_present(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = clean_text(row.get(key))
        if value:
            return value
    return ""


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def strip_html(value: str) -> str:
    text = html.unescape(value)
    text = re.sub(r"<[^>]+>", " ", text)
    return normalize_spaces(text)


def normalize_name(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower().replace("&", " and ")
    normalized = re.sub(r"\([^)]*\)", " ", normalized)
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return normalize_spaces(normalized)


def normalize_postal(value: str) -> str:
    digits = re.sub(r"\D", "", clean_text(value))
    if not digits:
        return ""
    return digits[-6:] if len(digits) >= 6 else digits.zfill(6)


def format_unit(unit: str, level: str = "") -> str:
    cleaned = clean_text(unit).upper().replace(" ", "")
    if not cleaned:
        return ""
    if cleaned.startswith("#"):
        return cleaned
    if "-" in cleaned:
        return f"#{cleaned}"
    level_digits = re.sub(r"\D", "", clean_text(level))
    if level_digits:
        return f"#{int(level_digits):02d}-{cleaned}"
    return f"#{cleaned}"


def parse_price_range(value: str) -> tuple[str, str, str]:
    text = clean_text(value).replace("S$", "$")
    if not text:
        return "", "", ""
    matches = re.findall(r"\d+(?:\.\d+)?", text)
    if not matches:
        return text, "", ""
    numbers = [float(item) for item in matches]
    min_value = format_number(min(numbers))
    max_value = format_number(max(numbers))
    display = text
    if len(numbers) == 1:
        display = f"${min_value}"
    return display, min_value, max_value


def format_number(value: float) -> str:
    if int(value) == value:
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def build_location(building: str, unit: str, address: str, postal: str, region: str) -> str:
    parts = []
    if building:
        parts.append(building)
    if unit:
        parts.append(unit)
    if address:
        parts.append(address)
    if postal:
        parts.append(f"Singapore {postal}")
    if region:
        parts.append(region)
    return ", ".join(parts)


def build_location_key(building: str, unit: str, address: str, postal: str) -> str:
    key_parts = [
        normalize_name(building),
        normalize_name(unit),
        normalize_name(address),
        normalize_postal(postal),
    ]
    return "|".join(part for part in key_parts if part)


def strip_unit_suffix(name: str) -> str:
    text = clean_text(name)
    if not text:
        return ""
    return normalize_spaces(re.sub(r"\s*\((?:#?\d[\w/-]*)\)\s*$", "", text, flags=re.IGNORECASE))


def extract_unit_from_name(name: str) -> str:
    text = clean_text(name)
    match = re.search(r"\((#?[\dA-Za-z/-]+)\)\s*$", text)
    if not match:
        return ""
    return format_unit(match.group(1))


def build_aliases(building_name: str) -> set[str]:
    aliases: set[str] = set()
    cleaned = clean_text(building_name)
    if not cleaned:
        return aliases
    normalized_full = normalize_name(cleaned)
    if normalized_full:
        aliases.add(normalized_full)
    reduced = cleaned
    for pattern in PLACE_SUFFIX_PATTERNS:
        reduced = re.sub(pattern, "", reduced, flags=re.IGNORECASE)
    normalized_reduced = normalize_name(reduced)
    if normalized_reduced and len(normalized_reduced) >= 4:
        aliases.add(normalized_reduced)
        words = normalized_reduced.split()
        if words:
            first_word = words[0]
            if len(first_word) >= 5:
                aliases.add(first_word)
        if len(words) >= 2:
            first_two = " ".join(words[:2])
            if len(first_two) >= 6:
                aliases.add(first_two)
    return aliases


def extract_image_url_from_tag(tag: str) -> str:
    for attr in ("data-src", "src"):
        match = re.search(rf'{attr}="([^"]+)"', tag)
        if match:
            candidate = clean_text(match.group(1))
            if candidate and "default_stall.png" not in candidate:
                return candidate
    return ""


def source_url_for_seed(stall_type: str) -> str:
    if stall_type == "Hawker Stall":
        return HAWKER_CENTRES_DATASET_URL
    return EATING_ESTABLISHMENTS_DATASET_URL


def normalize_hawker_photo(url: str) -> str:
    cleaned = clean_text(url)
    if cleaned.startswith("http://"):
        return "https://" + cleaned.removeprefix("http://")
    return cleaned


def parse_description_table(value: str) -> dict[str, str]:
    description = html.unescape(clean_text(value))
    matches = re.findall(r"<th>([^<]+)</th>\s*<td>(.*?)</td>", description, flags=re.IGNORECASE | re.DOTALL)
    parsed: dict[str, str] = {}
    for key, raw_value in matches:
        text = re.sub(r"<[^>]+>", "", raw_value)
        parsed[normalize_spaces(key)] = normalize_spaces(text)
    return parsed


def fetch_json_from_dataset(dataset_id: str) -> tuple[str, dict]:
    api_url = f"https://api-open.data.gov.sg/v1/public/api/datasets/{dataset_id}/poll-download"
    api_response = poll_dataset(api_url, dataset_id)
    download_url = api_response["data"]["url"]
    payload = subprocess.check_output(["curl", "-L", "--silent", download_url], text=True)
    return download_url, json.loads(payload)


def fetch_csv_from_dataset(dataset_id: str) -> tuple[str, list[dict[str, str]]]:
    api_url = f"https://api-open.data.gov.sg/v1/public/api/datasets/{dataset_id}/poll-download"
    api_response = poll_dataset(api_url, dataset_id)
    download_url = api_response["data"]["url"]
    payload = subprocess.check_output(["curl", "-L", "--silent", download_url], text=True)
    rows = list(csv.DictReader(io.StringIO(payload)))
    return download_url, rows


def curl_text(url: str) -> str:
    payload = subprocess.check_output(
        [
            "curl",
            "-L",
            "--silent",
            "--compressed",
            "--user-agent",
            "HungryDataBot/1.0",
            url,
        ],
        text=False,
        timeout=60,
    )
    return payload.decode("utf-8", errors="ignore")


def poll_dataset(api_url: str, dataset_id: str) -> dict:
    for attempt in range(5):
        api_payload = subprocess.check_output(["curl", "-L", "--silent", api_url], text=True)
        api_response = json.loads(api_payload)
        if api_response.get("code") == 0:
            return api_response
        if api_response.get("name") == "TOO_MANY_REQUESTS" and attempt < 4:
            time.sleep(12)
            continue
        raise RuntimeError(f"Failed to poll dataset {dataset_id}: {api_response}")
    raise RuntimeError(f"Failed to poll dataset {dataset_id}: exhausted retries")


def canonical_stall_type(existing: str) -> str:
    text = clean_text(existing)
    if not text:
        return ""
    normalized = normalize_name(text)
    mapping = {
        "hawker stall": "Hawker Stall",
        "hawker": "Hawker Stall",
        "hawker centre": "Hawker Stall",
        "restaurant": "Restaurant",
        "fine dining": "Restaurant",
        "seafood restaurant": "Restaurant",
        "vegan restaurant": "Restaurant",
        "vegetarian restaurant": "Restaurant",
        "casual dining": "Restaurant",
        "modern bbq": "Restaurant",
        "burger joint": "Restaurant",
        "cafe": "Cafe",
        "specialty coffee": "Cafe",
        "vegan cafe": "Cafe",
        "dessert cafe": "Cafe",
        "dessert shop": "Cafe",
        "bakery": "Cafe",
        "artisan bakery": "Cafe",
        "bakery kueh": "Cafe",
        "cafe bakery": "Cafe",
        "cafe restaurant": "Cafe",
        "shophouse": "Shophouse",
        "chain": "Chain Outlet",
        "chain outlet": "Chain Outlet",
        "cafe chain": "Chain Outlet",
        "fast food chain": "Chain Outlet",
        "food court stall": "Food Court Stall",
        "kopitiam": "Food Court Stall",
        "zi char": "Zi Char",
        "bar bistro": "Bar / Bistro",
        "other": "Other",
    }
    if normalized in mapping:
        return mapping[normalized]
    if "hawker" in normalized:
        return "Hawker Stall"
    if "food court" in normalized or "kopitiam" in normalized:
        return "Food Court Stall"
    if any(keyword in normalized for keyword in ("bar", "bistro", "taproom", "pub")):
        return "Bar / Bistro"
    if any(keyword in normalized for keyword in ("cafe", "coffee", "bakery", "dessert", "tea", "toast")):
        return "Cafe"
    if any(keyword in normalized for keyword in ("restaurant", "dining", "bbq", "burger", "seafood", "vegan", "vegetarian")):
        return "Restaurant"
    if "chain" in normalized:
        return "Chain Outlet"
    if "zi char" in normalized or "zichar" in normalized:
        return "Zi Char"
    return "Other"


def load_existing_workbook(path: Path) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    workbook = load_workbook(path, data_only=True)
    main_sheet = workbook["Food Stalls & Restaurants"]
    guide_sheet = workbook["Schema & Field Guide"]
    hawker_sheet = workbook["Hawker Centres Directory"]
    _ = guide_sheet  # retained to validate presence

    headers = [clean_text(cell.value) for cell in main_sheet[2]]
    rows: list[dict[str, str]] = []
    for row in main_sheet.iter_rows(min_row=3, values_only=True):
        row_dict = {headers[index]: clean_text(value) for index, value in enumerate(row[: len(headers)])}
        if clean_text(row_dict.get("Stall ID")).startswith("Legend"):
            continue
        if row_dict.get("Stall ID") and row_dict.get("Stall / Restaurant Name"):
            rows.append(row_dict)

    hawker_headers = [clean_text(cell.value) for cell in hawker_sheet[2]]
    hawker_rows: list[dict[str, str]] = []
    for row in hawker_sheet.iter_rows(min_row=3, values_only=True):
        row_dict = {
            hawker_headers[index]: clean_text(value)
            for index, value in enumerate(row[: len(hawker_headers)])
        }
        if row_dict.get("Name"):
            hawker_rows.append(row_dict)
    return rows, hawker_rows


def load_seed_snapshot(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            cleaned = {key: clean_text(value) for key, value in row.items()}
            if first_present(cleaned, "Stall ID").startswith("Legend"):
                continue
            if first_present(cleaned, "Stall / Restaurant Name"):
                rows.append(cleaned)
    return rows


def merge_seed_sources(
    current_rows: list[dict[str, str]],
    snapshot_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}

    for row in snapshot_rows:
        stall_id = first_present(row, "Stall ID")
        if stall_id:
            merged[stall_id] = dict(row)

    for row in current_rows:
        stall_id = first_present(row, "Stall ID")
        if not stall_id:
            continue
        combined = dict(merged.get(stall_id, {}))
        for key, value in row.items():
            cleaned = clean_text(value)
            if cleaned:
                combined[key] = cleaned
        merged[stall_id] = combined

    return list(merged.values())


def build_region_lookups(seed_rows: Iterable[dict[str, str]], hawker_rows: Iterable[dict[str, str]]) -> tuple[dict[str, str], dict[str, str]]:
    region_by_postal: dict[str, str] = {}
    region_by_building: dict[str, str] = {}
    for row in list(seed_rows) + list(hawker_rows):
        region = clean_text(row.get("Region"))
        postal = normalize_postal(row.get("Postal Code", ""))
        building = clean_text(row.get("Hawker Centre / Building") or row.get("Name"))
        if region and postal:
            region_by_postal[postal] = region
        if region and building:
            region_by_building[normalize_name(building)] = region
    return region_by_postal, region_by_building


def build_hawker_centres(existing_hawker_rows: list[dict[str, str]]) -> list[HawkerCentre]:
    _, dataset_rows = fetch_csv_from_dataset(HAWKER_CENTRES_DATASET_ID)
    existing_region_by_postal = {
        normalize_postal(row.get("Postal Code", "")): clean_text(row.get("Region"))
        for row in existing_hawker_rows
        if clean_text(row.get("Region"))
    }
    existing_region_by_name = {
        normalize_name(row.get("Name", "")): clean_text(row.get("Region"))
        for row in existing_hawker_rows
        if clean_text(row.get("Region"))
    }

    centres: list[HawkerCentre] = []
    for index, row in enumerate(dataset_rows, start=1):
        name = clean_text(row.get("name"))
        address = clean_text(row.get("address_myenv"))
        postal = normalize_postal(address)
        region = existing_region_by_postal.get(postal) or existing_region_by_name.get(normalize_name(name), "")
        centres.append(
            HawkerCentre(
                name=name,
                address=address,
                postal_code=postal,
                region=region,
                photo_url=normalize_hawker_photo(row.get("photourl", "")),
                food_stall_count=clean_text(row.get("no_of_food_stalls")),
                market_stall_count=clean_text(row.get("no_of_market_stalls")),
                latitude=clean_text(row.get("latitude_hc")),
                longitude=clean_text(row.get("longitude_hc")),
                status=clean_text(row.get("status")),
                description=clean_text(row.get("description_myenv")),
                google_3d_view=clean_text(row.get("google_3d_view")),
            )
        )
    return centres


def build_place_reference_maps(
    rows: Iterable[dict[str, str]],
    hawker_centres: Iterable[HawkerCentre],
) -> tuple[dict[str, PlaceReference], dict[str, PlaceReference]]:
    refs_by_name: dict[str, PlaceReference] = {}
    alias_candidates: defaultdict[str, list[str]] = defaultdict(list)

    def add_reference(ref: PlaceReference) -> None:
        normalized_building = normalize_name(ref.building_name)
        if not normalized_building or normalized_building in refs_by_name:
            return
        refs_by_name[normalized_building] = ref
        for alias in build_aliases(ref.building_name):
            alias_candidates[alias].append(normalized_building)

    for row in rows:
        building = first_present(row, "Building Name", "Hawker Centre / Building")
        address = first_present(row, "Address")
        postal = normalize_postal(row.get("Postal Code", ""))
        if not building or not (address or postal):
            continue
        add_reference(
            PlaceReference(
                building_name=building,
                address=address,
                postal_code=postal,
                region=first_present(row, "Region"),
                latitude=first_present(row, "Latitude"),
                longitude=first_present(row, "Longitude"),
                image_url=first_present(row, "Image URL"),
            )
        )

    for centre in hawker_centres:
        add_reference(
            PlaceReference(
                building_name=centre.name,
                address=centre.address,
                postal_code=centre.postal_code,
                region=centre.region,
                latitude=centre.latitude,
                longitude=centre.longitude,
                image_url=centre.photo_url,
            )
        )

    alias_map: dict[str, PlaceReference] = {}
    for alias, building_names in alias_candidates.items():
        unique_names = sorted(set(building_names))
        if len(unique_names) == 1:
            alias_map[alias] = refs_by_name[unique_names[0]]
    return refs_by_name, alias_map


def find_place_reference(text: str, alias_map: dict[str, PlaceReference]) -> PlaceReference | None:
    normalized_text = normalize_name(text)
    if not normalized_text:
        return None
    padded_text = f" {normalized_text} "
    for alias in sorted(alias_map.keys(), key=len, reverse=True):
        if f" {alias} " in padded_text:
            return alias_map[alias]
    return None


def match_hawker_centre(
    building: str,
    address: str,
    postal: str,
    by_postal: dict[str, HawkerCentre],
    by_name: dict[str, HawkerCentre],
) -> HawkerCentre | None:
    normalized_postal = normalize_postal(postal)
    if normalized_postal and normalized_postal in by_postal:
        return by_postal[normalized_postal]

    normalized_building = normalize_name(building)
    if normalized_building:
        if normalized_building in by_name:
            return by_name[normalized_building]
        for candidate_name, centre in by_name.items():
            if normalized_building and normalized_building in candidate_name:
                return centre

    normalized_address = normalize_name(address)
    if normalized_address:
        for centre in by_postal.values():
            if normalize_name(centre.address) and normalize_name(centre.address) in normalized_address:
                return centre
    return None


def derive_building_name(premises_address: str) -> str:
    address = normalize_spaces(clean_text(premises_address))
    if not address:
        return ""
    stripped = re.sub(r"\bSINGAPORE\s+\d{6}\b", "", address, flags=re.IGNORECASE).strip(", ")
    if "#" in stripped:
        tail = stripped.split("#", 1)[1]
        tail = normalize_spaces(re.sub(r"^[A-Z0-9/-]+\s*", "", tail))
        if any(keyword in tail.upper() for keyword in MALL_KEYWORDS | FOOD_COURT_KEYWORDS):
            return tail
    return ""


def classify_stall_type(
    name: str,
    building: str,
    address: str,
    existing_type: str,
    chain_count: int,
    hawker_match: bool,
) -> str:
    if existing_type:
        return existing_type

    upper_name = clean_text(name).upper()
    upper_building = clean_text(building).upper()
    upper_address = clean_text(address).upper()

    if hawker_match:
        return "Hawker Stall"
    if any(keyword in upper_building for keyword in FOOD_COURT_KEYWORDS):
        return "Food Court Stall"
    if any(keyword in upper_name for keyword in BAR_KEYWORDS):
        return "Bar / Bistro"
    if any(keyword in upper_name for keyword in CAFE_KEYWORDS):
        return "Cafe"
    if chain_count >= 3:
        return "Chain Outlet"
    if any(keyword in upper_name for keyword in OTHER_KEYWORDS):
        return "Other"
    if upper_building and not any(keyword in upper_building for keyword in MALL_KEYWORDS | FOOD_COURT_KEYWORDS):
        if not hawker_match and any(keyword in upper_address for keyword in SHOUSE_STREET_KEYWORDS):
            return "Shophouse"
    return "Restaurant"


def similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right or left in right or right in left:
        return 1.0
    return SequenceMatcher(a=left, b=right).ratio()


def compute_coverage(row: dict[str, str]) -> str:
    required = ["Stall / Restaurant Name", "Stall Type", "Location", "Source URL"]
    if any(is_blank(row.get(field)) for field in required):
        return "Needs Review"
    rich_fields = ["Image URL", "Menu", "Price", "Opening Hours"]
    if all(not is_blank(row.get(field)) for field in rich_fields):
        return "Complete"
    return "Partial"


def build_seed_rows(
    existing_rows: list[dict[str, str]],
    hawker_by_postal: dict[str, HawkerCentre],
    hawker_by_name: dict[str, HawkerCentre],
) -> list[dict[str, str]]:
    canonical_rows: list[dict[str, str]] = []
    for row in existing_rows:
        building = first_present(row, "Hawker Centre / Building", "Building Name", "Name")
        address = first_present(row, "Address")
        postal = normalize_postal(row.get("Postal Code", ""))
        unit = first_present(row, "Unit No.")
        region = first_present(row, "Region")
        hawker_match = match_hawker_centre(building, address, postal, hawker_by_postal, hawker_by_name)
        price_display, price_min, price_max = parse_price_range(first_present(row, "Price", "Price Range (SGD)"))
        if not price_min:
            price_min = first_present(row, "Price Min (SGD)")
        if not price_max:
            price_max = first_present(row, "Price Max (SGD)")
        location = build_location(building, unit, address, postal, region)
        stall_name = first_present(row, "Stall / Restaurant Name")
        stall_type = canonical_stall_type(first_present(row, "Stall Type"))
        business_id = first_present(row, "Business ID", "Stall ID") or f"SEED-{normalize_name(stall_name)[:24]}"
        canonical = {
            "Business ID": business_id,
            "Stall ID": first_present(row, "Stall ID"),
            "Licence No": first_present(row, "Licence No"),
            "Stall / Restaurant Name": stall_name,
            "Business Name Normalized": first_present(row, "Business Name Normalized") or normalize_name(stall_name),
            "Stall Type": stall_type,
            "Cuisine": first_present(row, "Cuisine"),
            "Signature Dish": first_present(row, "Signature Dish"),
            "Menu": first_present(row, "Menu", "Menu Items"),
            "Price": price_display,
            "Price Min (SGD)": price_min,
            "Price Max (SGD)": price_max,
            "Opening Hours": first_present(row, "Opening Hours"),
            "Closed Days": first_present(row, "Closed Days"),
            "NEA Hygiene Grade": first_present(row, "NEA Hygiene Grade"),
            "Michelin Recognition": first_present(row, "Michelin Recognition"),
            "Dietary Options": first_present(row, "Dietary Options"),
            "Delivery Platforms": first_present(row, "Delivery Platforms"),
            "Contact": first_present(row, "Contact"),
            "Instagram": first_present(row, "Instagram"),
            "Image URL": first_present(row, "Image URL") or (hawker_match.photo_url if hawker_match else ""),
            "Hawker Centre / Building": building,
            "Building Name": building,
            "Unit No.": unit,
            "Address": address,
            "Postal Code": postal,
            "Region": region,
            "Location": location,
            "Location Key": build_location_key(building, unit, address, postal),
            "Latitude": first_present(row, "Latitude") or (hawker_match.latitude if hawker_match else ""),
            "Longitude": first_present(row, "Longitude") or (hawker_match.longitude if hawker_match else ""),
            "Source Type": first_present(row, "Source Type") or DEFAULT_SEED_SOURCE_TYPE,
            "Source URL": first_present(row, "Source URL") or source_url_for_seed(stall_type),
            "Last Verified Date": TODAY,
            "Coverage Status": "",
            "Notes": first_present(row, "Notes"),
        }
        canonical["Coverage Status"] = compute_coverage(canonical)
        canonical_rows.append(canonical)
    return canonical_rows


def build_grading_lookup() -> dict[str, dict[str, str]]:
    _, payload = fetch_json_from_dataset(GRADING_DATASET_ID)
    lookup: dict[str, dict[str, str]] = {}
    for feature in payload["features"]:
        attrs = parse_description_table(feature["properties"].get("Description", ""))
        licence = clean_text(attrs.get("LICENCE_NUMBER"))
        if not licence:
            continue
        lookup[licence] = {
            "grade": clean_text(attrs.get("GRADE")),
            "premises_address": clean_text(attrs.get("PREMISES_ADDRESS")),
            "postal_code": normalize_postal(attrs.get("POSTAL_CODE", "")),
        }
    return lookup


def dedupe_key(name_normalized: str, location_key: str, licence_no: str) -> str:
    return licence_no or f"{name_normalized}|{location_key}"


def build_official_rows(
    existing_regions_by_postal: dict[str, str],
    existing_regions_by_building: dict[str, str],
    hawker_by_postal: dict[str, HawkerCentre],
    hawker_by_name: dict[str, HawkerCentre],
) -> list[dict[str, str]]:
    grading_lookup = build_grading_lookup()
    _, payload = fetch_json_from_dataset(EATING_ESTABLISHMENTS_DATASET_ID)

    parsed_rows: list[dict[str, str]] = []
    for feature in payload["features"]:
        attrs = parse_description_table(feature["properties"].get("Description", ""))
        licence_no = clean_text(attrs.get("LIC_NO"))
        business_name = clean_text(attrs.get("BUSINESS_NAME")) or clean_text(attrs.get("LIC_NAME"))
        if not normalize_name(business_name):
            business_name = clean_text(attrs.get("LIC_NAME")) or business_name
        postal_code = normalize_postal(attrs.get("POSTCODE", ""))
        blk_house = clean_text(attrs.get("BLK_HOUSE"))
        street_name = clean_text(attrs.get("STR_NAME"))
        level_no = clean_text(attrs.get("LEVEL_NO"))
        unit_no = format_unit(attrs.get("UNIT_NO", ""), level_no)
        address = normalize_spaces(" ".join(part for part in [blk_house, street_name] if part))
        grade_info = grading_lookup.get(licence_no, {})
        premises_address = clean_text(grade_info.get("premises_address"))
        building_name = derive_building_name(premises_address)
        hawker_match = match_hawker_centre(building_name, address or premises_address, postal_code, hawker_by_postal, hawker_by_name)
        if hawker_match:
            building_name = hawker_match.name
        region = (
            existing_regions_by_postal.get(postal_code)
            or existing_regions_by_building.get(normalize_name(building_name))
            or (hawker_match.region if hawker_match else "")
        )
        parsed_rows.append(
            {
                "Business ID": f"SFA-{licence_no}" if licence_no else "",
                "Stall ID": "",
                "Licence No": licence_no,
                "Stall / Restaurant Name": business_name,
                "Business Name Normalized": normalize_name(business_name),
                "Stall Type": "",
                "Cuisine": "",
                "Signature Dish": "",
                "Menu": "",
                "Price": "",
                "Price Min (SGD)": "",
                "Price Max (SGD)": "",
                "Opening Hours": "",
                "Closed Days": "",
                "NEA Hygiene Grade": clean_text(grade_info.get("grade")),
                "Michelin Recognition": "",
                "Dietary Options": "",
                "Delivery Platforms": "",
                "Contact": "",
                "Instagram": "",
                "Image URL": hawker_match.photo_url if hawker_match else "",
                "Hawker Centre / Building": building_name,
                "Building Name": building_name,
                "Unit No.": unit_no,
                "Address": address,
                "Postal Code": postal_code or clean_text(grade_info.get("postal_code")),
                "Region": region,
                "Location": "",
                "Location Key": "",
                "Latitude": str(feature["geometry"]["coordinates"][1]) if feature.get("geometry") else "",
                "Longitude": str(feature["geometry"]["coordinates"][0]) if feature.get("geometry") else "",
                "Source Type": EATING_ESTABLISHMENTS_SOURCE_TYPE,
                "Source URL": EATING_ESTABLISHMENTS_DATASET_URL,
                "Last Verified Date": TODAY,
                "Coverage Status": "",
                "Notes": "Hygiene grade merged from SFA grading dataset." if clean_text(grade_info.get("grade")) else "",
            }
        )

    chain_counts = Counter(row["Business Name Normalized"] for row in parsed_rows if row["Business Name Normalized"])
    deduped: dict[str, dict[str, str]] = {}
    for row in parsed_rows:
        building = row["Building Name"]
        address = row["Address"]
        postal = row["Postal Code"]
        unit = row["Unit No."]
        row["Stall Type"] = classify_stall_type(
            row["Stall / Restaurant Name"],
            building,
            address,
            row["Stall Type"],
            chain_counts[row["Business Name Normalized"]],
            bool(match_hawker_centre(building, address, postal, hawker_by_postal, hawker_by_name)),
        )
        row["Location"] = build_location(building, unit, address, postal, row["Region"])
        row["Location Key"] = build_location_key(building, unit, address, postal)
        row["Coverage Status"] = compute_coverage(row)
        key = dedupe_key(row["Business Name Normalized"], row["Location Key"], row["Licence No"])
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = row
            continue
        for field in MAIN_COLUMNS:
            if is_blank(existing.get(field)) and not is_blank(row.get(field)):
                existing[field] = row[field]
        if row["Notes"] and row["Notes"] not in clean_text(existing.get("Notes")):
            merged_notes = "; ".join(item for item in [clean_text(existing.get("Notes")), row["Notes"]] if item)
            existing["Notes"] = merged_notes
        existing["Coverage Status"] = compute_coverage(existing)
    return list(deduped.values())


def extract_whyq_vendor_urls() -> list[str]:
    xml = curl_text(WHYQ_SITEMAP_URL)
    urls = re.findall(r"<loc>([^<]+)</loc>", xml)
    seen: set[str] = set()
    vendor_urls: list[str] = []
    for url in urls:
        if "/corporate-catering/" not in url:
            continue
        if url.rstrip("/") == "https://www.whyq.sg/corporate-catering":
            continue
        if url not in seen:
            seen.add(url)
            vendor_urls.append(url)
    return vendor_urls


def whyq_vendor_type_to_stall_type(vendor_type: str, place_ref: PlaceReference | None) -> str:
    normalized = normalize_name(vendor_type)
    if normalized == "hawker":
        return "Hawker Stall"
    if normalized in {"cafe", "dessert cafe"}:
        return "Cafe"
    if normalized in {"bar", "bistro"}:
        return "Bar / Bistro"
    if place_ref:
        normalized_building = normalize_name(place_ref.building_name)
        if any(term in normalized_building for term in ("hawker centre", "food centre", "market")):
            return "Hawker Stall"
        if any(term in normalized_building for term in ("food court", "kopitiam", "canteen")):
            return "Food Court Stall"
    return canonical_stall_type(vendor_type) or "Restaurant"


def parse_whyq_vendor_page(url: str, alias_map: dict[str, PlaceReference]) -> dict[str, str] | None:
    html_text = curl_text(url)
    if "<title>Page not found</title>" in html_text:
        return None

    name_match = re.search(r'<h1 class="stall_name">(.*?)</h1>', html_text, re.S)
    if not name_match:
        return None
    raw_name = strip_html(name_match.group(1))
    if not raw_name:
        return None
    unit = extract_unit_from_name(raw_name)
    name = strip_unit_suffix(raw_name) or raw_name

    desc_match = re.search(r'<div class="stall_desc">(.*?)</div>', html_text, re.S)
    description = strip_html(desc_match.group(1)) if desc_match else ""
    vendor_type_match = re.search(r'<span class="vendor_type">.*?</svg>\s*([^<]+)</span>', html_text, re.S)
    vendor_type = clean_text(vendor_type_match.group(1)) if vendor_type_match else ""
    cuisines_match = re.search(r'<span class="cuisines">(.*?)</span>', html_text, re.S)
    cuisines = strip_html(cuisines_match.group(1)) if cuisines_match else ""
    dollar_match = re.search(r'<span class="dollar_val">(.*?)</span>', html_text, re.S)
    dollar_value = strip_html(dollar_match.group(1)) if dollar_match else ""

    stall_img_match = re.search(r"(<img[^>]+stall_img[^>]+>)", html_text, re.S)
    image_url = extract_image_url_from_tag(stall_img_match.group(1)) if stall_img_match else ""

    item_matches = re.findall(
        r'<h2>(.*?)</h2>.*?<div class="item-price">\s*<span>\$?([0-9.]+)</span>',
        html_text,
        re.S,
    )
    menu_items: list[str] = []
    prices: list[float] = []
    for raw_item_name, raw_price in item_matches:
        item_name = strip_html(raw_item_name)
        if not item_name or item_name in menu_items:
            continue
        menu_items.append(item_name)
        try:
            prices.append(float(raw_price))
        except ValueError:
            continue

    menu_summary = ", ".join(menu_items[:8])
    if prices:
        price_display = f"${format_number(min(prices))}–${format_number(max(prices))}" if len(prices) > 1 else f"${format_number(prices[0])}"
        price_min = format_number(min(prices))
        price_max = format_number(max(prices))
    else:
        price_display = dollar_value
        price_min = ""
        price_max = ""

    place_ref = find_place_reference(" ".join(part for part in [name, description, url] if part), alias_map)
    building = place_ref.building_name if place_ref else ""
    address = place_ref.address if place_ref else ""
    postal = place_ref.postal_code if place_ref else ""
    region = place_ref.region if place_ref else ""
    if not image_url and place_ref:
        image_url = place_ref.image_url

    notes_parts = [part for part in [description, f"WhyQ vendor type: {vendor_type}" if vendor_type else "", f"WhyQ cuisines: {cuisines}" if cuisines else ""] if part]
    row = {
        "Business ID": "",
        "Stall ID": "",
        "Licence No": "",
        "Stall / Restaurant Name": name,
        "Business Name Normalized": normalize_name(name),
        "Stall Type": whyq_vendor_type_to_stall_type(vendor_type, place_ref),
        "Cuisine": cuisines,
        "Signature Dish": menu_items[0] if menu_items else "",
        "Menu": menu_summary,
        "Price": price_display,
        "Price Min (SGD)": price_min,
        "Price Max (SGD)": price_max,
        "Opening Hours": "",
        "Closed Days": "",
        "NEA Hygiene Grade": "",
        "Michelin Recognition": "",
        "Dietary Options": "",
        "Delivery Platforms": "",
        "Contact": "",
        "Instagram": "",
        "Image URL": image_url,
        "Hawker Centre / Building": building,
        "Building Name": building,
        "Unit No.": unit,
        "Address": address,
        "Postal Code": postal,
        "Region": region,
        "Location": build_location(building, unit, address, postal, region),
        "Location Key": build_location_key(building, unit, address, postal),
        "Latitude": place_ref.latitude if place_ref else "",
        "Longitude": place_ref.longitude if place_ref else "",
        "Source Type": WHYQ_SOURCE_TYPE,
        "Source URL": url,
        "Last Verified Date": TODAY,
        "Coverage Status": "",
        "Notes": "; ".join(notes_parts),
    }
    row["Coverage Status"] = compute_coverage(row)
    return row


def build_whyq_rows(
    base_rows: list[dict[str, str]],
    hawker_centres: list[HawkerCentre],
) -> list[dict[str, str]]:
    _, alias_map = build_place_reference_maps(base_rows, hawker_centres)
    urls = extract_whyq_vendor_urls()

    def parse_vendor(vendor_url: str) -> dict[str, str] | None:
        try:
            return parse_whyq_vendor_page(vendor_url, alias_map)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, RuntimeError, ValueError):
            return None

    with ThreadPoolExecutor(max_workers=8) as executor:
        rows = list(executor.map(parse_vendor, urls))
    return [row for row in rows if row]


def merge_whyq_rows(base_rows: list[dict[str, str]], whyq_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    merged_rows = [dict(row) for row in base_rows]
    full_name_index: defaultdict[str, list[int]] = defaultdict(list)
    base_name_index: defaultdict[str, list[int]] = defaultdict(list)

    def index_row(row_index: int) -> None:
        row = merged_rows[row_index]
        full_name_index[normalize_name(row.get("Stall / Restaurant Name", ""))].append(row_index)
        base_name_index[normalize_name(strip_unit_suffix(row.get("Stall / Restaurant Name", "")))].append(row_index)

    for index in range(len(merged_rows)):
        index_row(index)

    whyq_counter = 1
    for candidate in whyq_rows:
        candidate_full_name = normalize_name(candidate.get("Stall / Restaurant Name", ""))
        candidate_base_name = normalize_name(strip_unit_suffix(candidate.get("Stall / Restaurant Name", "")))
        search_indices = set(full_name_index.get(candidate_full_name, [])) | set(base_name_index.get(candidate_base_name, []))

        best_index: int | None = None
        best_score = 0.0
        for row_index in search_indices:
            existing = merged_rows[row_index]
            score = 0.0
            existing_full_name = normalize_name(existing.get("Stall / Restaurant Name", ""))
            existing_base_name = normalize_name(strip_unit_suffix(existing.get("Stall / Restaurant Name", "")))
            if candidate_full_name and candidate_full_name == existing_full_name:
                score += 0.7
            if candidate_base_name and candidate_base_name == existing_base_name:
                score += 0.5
            score += similarity(candidate_base_name, existing_base_name) * 0.2
            if candidate.get("Unit No.") and candidate.get("Unit No.") == existing.get("Unit No."):
                score += 0.25
            if candidate.get("Location Key") and candidate.get("Location Key") == existing.get("Location Key"):
                score += 0.4
            if candidate.get("Building Name") and normalize_name(candidate.get("Building Name", "")) == normalize_name(existing.get("Building Name", "")):
                score += 0.25
            if candidate.get("Postal Code") and candidate.get("Postal Code") == existing.get("Postal Code"):
                score += 0.15
            if score > best_score:
                best_score = score
                best_index = row_index

        if best_index is not None and best_score >= 0.8:
            existing = merged_rows[best_index]
            if candidate["Stall Type"] in {"Hawker Stall", "Food Court Stall"} and existing.get("Stall Type") not in {"Hawker Stall", "Food Court Stall"}:
                existing["Stall Type"] = candidate["Stall Type"]
            for field in ("Cuisine", "Signature Dish", "Menu", "Price", "Price Min (SGD)", "Price Max (SGD)", "Opening Hours"):
                if not clean_text(existing.get(field)) and clean_text(candidate.get(field)):
                    existing[field] = candidate[field]
            existing_image = clean_text(existing.get("Image URL"))
            if clean_text(candidate.get("Image URL")) and (not existing_image or "nea.gov.sg/images/default-source" in existing_image):
                existing["Image URL"] = candidate["Image URL"]
            if not clean_text(existing.get("Building Name")) and clean_text(candidate.get("Building Name")):
                for field in ("Hawker Centre / Building", "Building Name", "Unit No.", "Address", "Postal Code", "Region", "Location", "Location Key", "Latitude", "Longitude"):
                    if clean_text(candidate.get(field)):
                        existing[field] = candidate[field]
            if clean_text(existing.get("Source Type")):
                if WHYQ_SOURCE_TYPE not in existing["Source Type"]:
                    existing["Source Type"] = f"{existing['Source Type']} + {WHYQ_SOURCE_TYPE}"
            else:
                existing["Source Type"] = WHYQ_SOURCE_TYPE
            if candidate.get("Notes"):
                notes = clean_text(existing.get("Notes"))
                if candidate["Notes"] not in notes:
                    existing["Notes"] = "; ".join(part for part in [notes, candidate["Notes"]] if part)
            existing["Coverage Status"] = compute_coverage(existing)
            continue

        if candidate["Stall Type"] not in {"Hawker Stall", "Food Court Stall"}:
            continue
        if not clean_text(candidate.get("Location")):
            continue
        candidate["Business ID"] = f"WHYQ-{whyq_counter:04d}"
        whyq_counter += 1
        merged_rows.append(candidate)
        index_row(len(merged_rows) - 1)

    merged_rows.sort(key=lambda row: (row.get("Region", ""), row.get("Stall Type", ""), row.get("Stall / Restaurant Name", "")))
    return merged_rows


def extract_food_republic_outlet_urls() -> list[str]:
    html_text = curl_text(FOOD_REPUBLIC_OUTLETS_URL)
    urls = re.findall(r"https://foodrepublic\.com\.sg/food-republic-outlets/[^\"' <>]+", html_text)
    seen: set[str] = set()
    outlet_urls: list[str] = []
    for url in urls:
        cleaned = url.rstrip("/")
        if cleaned in {
            FOOD_REPUBLIC_OUTLETS_URL.rstrip("/"),
            f"{FOOD_REPUBLIC_OUTLETS_URL.rstrip('/')}#breadcrumb",
        }:
            continue
        if "#" in cleaned:
            continue
        if cleaned not in seen:
            seen.add(cleaned)
            outlet_urls.append(cleaned + "/")
    return outlet_urls


def extract_food_republic_mall_hint(outlet_name: str) -> str:
    match = re.search(r"\s@\s(.+)$", clean_text(outlet_name))
    if match:
        return clean_text(match.group(1))
    return clean_text(outlet_name)


def build_postal_reference_map(
    rows: Iterable[dict[str, str]],
    hawker_centres: Iterable[HawkerCentre],
) -> dict[str, PlaceReference]:
    refs_by_postal: dict[str, PlaceReference] = {}

    def add_reference(ref: PlaceReference) -> None:
        if ref.postal_code and ref.address and ref.postal_code not in refs_by_postal:
            refs_by_postal[ref.postal_code] = ref

    for row in rows:
        postal = normalize_postal(row.get("Postal Code", ""))
        address = first_present(row, "Address")
        if not postal or not address:
            continue
        add_reference(
            PlaceReference(
                building_name=first_present(row, "Building Name", "Hawker Centre / Building"),
                address=address,
                postal_code=postal,
                region=first_present(row, "Region"),
                latitude=first_present(row, "Latitude"),
                longitude=first_present(row, "Longitude"),
                image_url=first_present(row, "Image URL"),
            )
        )

    for centre in hawker_centres:
        if not centre.postal_code or not centre.address:
            continue
        add_reference(
            PlaceReference(
                building_name=centre.name,
                address=centre.address,
                postal_code=centre.postal_code,
                region=centre.region,
                latitude=centre.latitude,
                longitude=centre.longitude,
                image_url=centre.photo_url,
            )
        )

    return refs_by_postal


def resolve_food_republic_place_reference(
    outlet_name: str,
    refs_by_name: dict[str, PlaceReference],
    alias_map: dict[str, PlaceReference],
    refs_by_postal: dict[str, PlaceReference],
) -> PlaceReference | None:
    normalized_outlet = normalize_name(outlet_name)
    mall_hint = extract_food_republic_mall_hint(outlet_name)
    normalized_hint = normalize_name(mall_hint)

    for key in (normalized_outlet, normalized_hint):
        override = None
        for override_key, override_value in FOOD_REPUBLIC_LOCATION_OVERRIDES.items():
            if normalize_name(override_key) == key:
                override = override_value
                break
        if not override:
            continue
        postal = normalize_postal(override.get("postal", ""))
        postal_ref = refs_by_postal.get(postal)
        return PlaceReference(
            building_name=clean_text(override.get("place_name")) or mall_hint,
            address=clean_text(override.get("address")),
            postal_code=postal,
            region=postal_ref.region if postal_ref else "",
            latitude=postal_ref.latitude if postal_ref else "",
            longitude=postal_ref.longitude if postal_ref else "",
            image_url=postal_ref.image_url if postal_ref else "",
        )

    variants = [normalized_hint]
    if normalized_hint.startswith("the "):
        variants.append(normalized_hint.removeprefix("the ").strip())

    for variant in variants:
        if variant in refs_by_name:
            return refs_by_name[variant]
        if variant in alias_map:
            return alias_map[variant]

    for variant in variants:
        candidates = {
            ref.building_name: ref
            for key, ref in refs_by_name.items()
            if variant and (variant in key or key in variant)
        }
        if len(candidates) == 1:
            return next(iter(candidates.values()))
    return None


def parse_food_republic_outlet_page(
    url: str,
    refs_by_name: dict[str, PlaceReference],
    alias_map: dict[str, PlaceReference],
    refs_by_postal: dict[str, PlaceReference],
) -> list[dict[str, str]]:
    html_text = curl_text(url)
    if "<title>Page not found</title>" in html_text:
        return []

    title_match = re.search(r"<title>(.*?)</title>", html_text, re.S | re.I)
    if not title_match:
        return []
    outlet_name = strip_html(title_match.group(1))
    outlet_name = re.sub(r"\s*[-|]\s*Food Republic Singapore\s*$", "", outlet_name, flags=re.I)
    outlet_name = clean_text(outlet_name)
    if not outlet_name:
        return []

    description_match = re.search(
        r'<meta\s+property="og:description"\s+content="([^"]+)"',
        html_text,
        re.I,
    )
    if not description_match:
        description_match = re.search(
            r'<meta\s+name="description"\s+content="([^"]+)"',
            html_text,
            re.I,
        )
    description = html.unescape(clean_text(description_match.group(1))) if description_match else ""

    if "Featured Stalls" not in html_text:
        return []
    featured_section = html_text.split("Featured Stalls", 1)[1]
    featured_section = featured_section.split('<div class="section the_content no_content">', 1)[0]
    featured_section = featured_section.split("<footer id=\"Footer\"", 1)[0]

    image_by_name: dict[str, str] = {}
    for raw_src, raw_name in re.findall(
        r'<div class="photo_box.*?<img[^>]+src="([^"]+)".*?<div class="desc">(.*?)</div>',
        featured_section,
        re.S | re.I,
    ):
        stall_name = clean_text(strip_html(raw_name))
        if not stall_name:
            continue
        image_by_name[normalize_name(stall_name)] = clean_text(raw_src)

    raw_blocks = re.findall(r"<p>(.*?)</p>", featured_section, re.S | re.I)
    seen_names: set[str] = set()
    stalls: list[tuple[str, bool]] = []
    for raw_block in raw_blocks:
        stall_name = clean_text(strip_html(raw_block))
        stall_name = re.sub(r"\(\s*halal\s*\)\s*$", "", stall_name, flags=re.I).strip()
        normalized_name = normalize_name(stall_name)
        if not normalized_name or normalized_name in seen_names:
            continue
        if normalized_name in FOOD_REPUBLIC_SKIP_LABELS:
            continue
        is_halal = "halal_favicon" in raw_block.lower() or "(halal)" in raw_block.lower()
        seen_names.add(normalized_name)
        stalls.append((stall_name, is_halal))

    if not stalls:
        return []

    place_ref = resolve_food_republic_place_reference(
        outlet_name,
        refs_by_name,
        alias_map,
        refs_by_postal,
    )
    address = place_ref.address if place_ref else ""
    postal = place_ref.postal_code if place_ref else ""
    region = place_ref.region if place_ref else ""
    latitude = place_ref.latitude if place_ref else ""
    longitude = place_ref.longitude if place_ref else ""
    location = build_location(outlet_name, "", address, postal, region)
    location_key = build_location_key(outlet_name, "", address, postal)

    rows: list[dict[str, str]] = []
    for stall_name, is_halal in stalls:
        normalized_name = normalize_name(stall_name)
        notes_parts = [f"Featured stall at {outlet_name}"]
        if place_ref and clean_text(place_ref.building_name) and clean_text(place_ref.building_name) != outlet_name:
            notes_parts.append(f"Located within {place_ref.building_name}")
        if description:
            notes_parts.append(description)
        row = {
            "Business ID": "",
            "Stall ID": "",
            "Licence No": "",
            "Stall / Restaurant Name": stall_name,
            "Business Name Normalized": normalized_name,
            "Stall Type": "Food Court Stall",
            "Cuisine": "",
            "Signature Dish": "",
            "Menu": "",
            "Price": "",
            "Price Min (SGD)": "",
            "Price Max (SGD)": "",
            "Opening Hours": "",
            "Closed Days": "",
            "NEA Hygiene Grade": "",
            "Michelin Recognition": "",
            "Dietary Options": "Halal-friendly" if is_halal else "",
            "Delivery Platforms": "",
            "Contact": "",
            "Instagram": "",
            "Image URL": image_by_name.get(normalized_name, ""),
            "Hawker Centre / Building": outlet_name,
            "Building Name": outlet_name,
            "Unit No.": "",
            "Address": address,
            "Postal Code": postal,
            "Region": region,
            "Location": location,
            "Location Key": location_key,
            "Latitude": latitude,
            "Longitude": longitude,
            "Source Type": FOOD_REPUBLIC_SOURCE_TYPE,
            "Source URL": url,
            "Last Verified Date": TODAY,
            "Coverage Status": "",
            "Notes": "; ".join(part for part in notes_parts if part),
        }
        row["Coverage Status"] = compute_coverage(row)
        rows.append(row)
    return rows


def build_food_republic_rows(
    base_rows: list[dict[str, str]],
    hawker_centres: list[HawkerCentre],
) -> list[dict[str, str]]:
    refs_by_name, alias_map = build_place_reference_maps(base_rows, hawker_centres)
    refs_by_postal = build_postal_reference_map(base_rows, hawker_centres)
    urls = extract_food_republic_outlet_urls()

    def parse_outlet(outlet_url: str) -> list[dict[str, str]]:
        try:
            return parse_food_republic_outlet_page(
                outlet_url,
                refs_by_name,
                alias_map,
                refs_by_postal,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, RuntimeError, ValueError):
            return []

    with ThreadPoolExecutor(max_workers=6) as executor:
        row_groups = list(executor.map(parse_outlet, urls))

    rows: list[dict[str, str]] = []
    seen_keys: set[str] = set()
    for group in row_groups:
        for row in group:
            key = "|".join(
                [
                    row.get("Business Name Normalized", ""),
                    row.get("Location Key", ""),
                    row.get("Source URL", ""),
                ]
            )
            if key in seen_keys:
                continue
            seen_keys.add(key)
            rows.append(row)
    return rows


def merge_food_republic_rows(
    base_rows: list[dict[str, str]],
    food_republic_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    merged_rows = [dict(row) for row in base_rows]
    full_name_index: defaultdict[str, list[int]] = defaultdict(list)
    base_name_index: defaultdict[str, list[int]] = defaultdict(list)

    def index_row(row_index: int) -> None:
        row = merged_rows[row_index]
        full_name_index[normalize_name(row.get("Stall / Restaurant Name", ""))].append(row_index)
        base_name_index[normalize_name(strip_unit_suffix(row.get("Stall / Restaurant Name", "")))].append(row_index)

    for index in range(len(merged_rows)):
        index_row(index)

    food_republic_counter = 1
    for candidate in food_republic_rows:
        candidate_full_name = normalize_name(candidate.get("Stall / Restaurant Name", ""))
        candidate_base_name = normalize_name(strip_unit_suffix(candidate.get("Stall / Restaurant Name", "")))
        search_indices = set(full_name_index.get(candidate_full_name, [])) | set(base_name_index.get(candidate_base_name, []))

        best_index: int | None = None
        best_score = 0.0
        for row_index in search_indices:
            existing = merged_rows[row_index]
            score = 0.0
            existing_full_name = normalize_name(existing.get("Stall / Restaurant Name", ""))
            existing_base_name = normalize_name(strip_unit_suffix(existing.get("Stall / Restaurant Name", "")))
            if candidate_full_name and candidate_full_name == existing_full_name:
                score += 0.35
            if candidate_base_name and candidate_base_name == existing_base_name:
                score += 0.25
            score += similarity(candidate_base_name, existing_base_name) * 0.15
            if candidate.get("Postal Code") and candidate.get("Postal Code") == existing.get("Postal Code"):
                score += 0.15
            candidate_address = normalize_name(candidate.get("Address", ""))
            existing_context = normalize_name(" ".join(filter(None, [existing.get("Building Name", ""), existing.get("Address", ""), existing.get("Location", "")])))
            if candidate_address and candidate_address in existing_context:
                score += 0.15
            if normalize_name(candidate.get("Building Name", "")) == normalize_name(existing.get("Building Name", "")):
                score += 0.4
            if FOOD_REPUBLIC_SOURCE_TYPE in clean_text(existing.get("Source Type")):
                score += 0.25
            if score > best_score:
                best_score = score
                best_index = row_index

        if best_index is not None and best_score >= 0.85:
            existing = merged_rows[best_index]
            previous_stall_type = clean_text(existing.get("Stall Type"))
            existing["Stall Type"] = "Food Court Stall"
            if clean_text(candidate.get("Building Name")) and (
                not clean_text(existing.get("Building Name"))
                or previous_stall_type != "Food Court Stall"
                or FOOD_REPUBLIC_SOURCE_TYPE in clean_text(existing.get("Source Type"))
            ):
                existing["Hawker Centre / Building"] = candidate["Hawker Centre / Building"]
                existing["Building Name"] = candidate["Building Name"]
                existing["Location"] = candidate["Location"]
                existing["Location Key"] = candidate["Location Key"]
            for field in ("Address", "Postal Code", "Region", "Latitude", "Longitude", "Image URL", "Dietary Options"):
                if not clean_text(existing.get(field)) and clean_text(candidate.get(field)):
                    existing[field] = candidate[field]
            if FOOD_REPUBLIC_SOURCE_TYPE not in clean_text(existing.get("Source Type")):
                existing["Source Type"] = " + ".join(
                    part for part in [clean_text(existing.get("Source Type")), FOOD_REPUBLIC_SOURCE_TYPE] if part
                )
            if candidate.get("Notes"):
                notes = clean_text(existing.get("Notes"))
                if candidate["Notes"] not in notes:
                    existing["Notes"] = "; ".join(part for part in [notes, candidate["Notes"]] if part)
            existing["Coverage Status"] = compute_coverage(existing)
            continue

        if not clean_text(candidate.get("Location")):
            continue
        candidate["Business ID"] = f"FR-{food_republic_counter:04d}"
        food_republic_counter += 1
        merged_rows.append(candidate)
        index_row(len(merged_rows) - 1)

    merged_rows.sort(key=lambda row: (row.get("Region", ""), row.get("Stall Type", ""), row.get("Stall / Restaurant Name", "")))
    return merged_rows


def merge_seed_and_official(seed_rows: list[dict[str, str]], official_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    merged_rows = list(seed_rows)
    seed_by_postal: dict[str, list[int]] = defaultdict(list)
    for index, row in enumerate(merged_rows):
        postal = normalize_postal(row.get("Postal Code", ""))
        if postal:
            seed_by_postal[postal].append(index)

    for official in official_rows:
        postal = normalize_postal(official.get("Postal Code", ""))
        unit = clean_text(official.get("Unit No."))
        official_name = official.get("Business Name Normalized", "")
        matched_index: int | None = None
        for candidate_index in seed_by_postal.get(postal, []):
            candidate = merged_rows[candidate_index]
            same_unit = unit and unit == clean_text(candidate.get("Unit No."))
            close_name = similarity(official_name, candidate.get("Business Name Normalized", "")) >= 0.78
            same_location = (
                official.get("Location Key")
                and official.get("Location Key") == candidate.get("Location Key")
            )
            if (same_unit and close_name) or (same_location and close_name):
                matched_index = candidate_index
                break

        if matched_index is None:
            merged_rows.append(official)
            if postal:
                seed_by_postal[postal].append(len(merged_rows) - 1)
            continue

        seed = merged_rows[matched_index]
        overwrite_from_official = {
            "Licence No",
            "NEA Hygiene Grade",
            "Latitude",
            "Longitude",
            "Postal Code",
            "Address",
            "Location",
            "Location Key",
        }
        for field in MAIN_COLUMNS:
            official_value = clean_text(official.get(field))
            if not official_value:
                continue
            seed_value = clean_text(seed.get(field))
            if field in overwrite_from_official and (not seed_value or field == "NEA Hygiene Grade"):
                seed[field] = official_value
            elif not seed_value:
                seed[field] = official_value

        if clean_text(seed.get("Source Type")):
            if EATING_ESTABLISHMENTS_SOURCE_TYPE not in seed["Source Type"]:
                seed["Source Type"] = f"{seed['Source Type']} + {EATING_ESTABLISHMENTS_SOURCE_TYPE}"
        else:
            seed["Source Type"] = official["Source Type"]
        if not clean_text(seed.get("Source URL")):
            seed["Source URL"] = official["Source URL"]
        if official.get("Notes"):
            existing_notes = clean_text(seed.get("Notes"))
            if official["Notes"] not in existing_notes:
                seed["Notes"] = "; ".join(item for item in [existing_notes, official["Notes"]] if item)
        seed["Coverage Status"] = compute_coverage(seed)

    merged_rows.sort(key=lambda row: (row.get("Region", ""), row.get("Stall Type", ""), row.get("Stall / Restaurant Name", "")))
    return merged_rows


def write_main_sheet(workbook: Workbook, rows: list[dict[str, str]]) -> None:
    sheet = workbook.active
    sheet.title = "Food Stalls & Restaurants"
    sheet["A1"] = f"\U0001F1F8\U0001F1EC {WORKBOOK_TITLE}"
    sheet["A1"].font = Font(size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor="1A2E44")
    sheet["A1"].alignment = Alignment(horizontal="left")
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(MAIN_COLUMNS))

    header_fill = PatternFill("solid", fgColor="E8531E")
    for column_index, header in enumerate(MAIN_COLUMNS, start=1):
        cell = sheet.cell(row=2, column=column_index, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row_index, row in enumerate(rows, start=3):
        for column_index, header in enumerate(MAIN_COLUMNS, start=1):
            sheet.cell(row=row_index, column=column_index, value=row.get(header, ""))

    sheet.freeze_panes = "A3"
    sheet.auto_filter.ref = f"A2:{get_column_letter(len(MAIN_COLUMNS))}{sheet.max_row}"

    widths = {
        "A": 18, "B": 14, "C": 18, "D": 32, "E": 28, "F": 18, "G": 18, "H": 24,
        "I": 46, "J": 12, "K": 14, "L": 14, "M": 22, "N": 16, "O": 12, "P": 12,
        "Q": 12, "R": 18, "S": 16, "T": 18, "U": 28, "V": 30, "W": 28, "X": 14,
        "Y": 32, "Z": 12, "AA": 14, "AB": 46, "AC": 36, "AD": 12, "AE": 12,
        "AF": 24, "AG": 42, "AH": 14, "AI": 14, "AJ": 22,
    }
    for column_letter, width in widths.items():
        sheet.column_dimensions[column_letter].width = width


def write_field_guide(workbook: Workbook) -> None:
    sheet = workbook.create_sheet("Schema & Field Guide")
    sheet["A1"] = "Schema & Field Guide — Singapore Food Business Database"
    sheet["A1"].font = Font(size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor="1A2E44")
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=6)

    headers = ["Field Name", "Data Type", "Required", "Description", "Example Values", "Source / Notes"]
    for column_index, header in enumerate(headers, start=1):
        cell = sheet.cell(row=2, column=column_index, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="E8531E")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row_index, row in enumerate(FIELD_GUIDE, start=3):
        for column_index, value in enumerate(row, start=1):
            sheet.cell(row=row_index, column=column_index, value=value)

    sheet.freeze_panes = "A3"
    sheet.auto_filter.ref = f"A2:F{sheet.max_row}"
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 16
    sheet.column_dimensions["C"].width = 12
    sheet.column_dimensions["D"].width = 44
    sheet.column_dimensions["E"].width = 28
    sheet.column_dimensions["F"].width = 40


def write_hawker_directory(workbook: Workbook, centres: list[HawkerCentre]) -> None:
    sheet = workbook.create_sheet("Hawker Centres Directory")
    sheet["A1"] = "Singapore Hawker Centres & Food Courts Directory"
    sheet["A1"].font = Font(size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor="1A2E44")
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(HAWKER_DIRECTORY_COLUMNS))

    for column_index, header in enumerate(HAWKER_DIRECTORY_COLUMNS, start=1):
        cell = sheet.cell(row=2, column=column_index, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="E8531E")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row_index, centre in enumerate(centres, start=3):
        values = {
            "HC ID": f"HC{row_index - 2:03d}",
            "Name": centre.name,
            "Region": centre.region,
            "Address": centre.address,
            "Postal Code": centre.postal_code,
            "No. Food Stalls": centre.food_stall_count,
            "No. Market Stalls": centre.market_stall_count,
            "Latitude": centre.latitude,
            "Longitude": centre.longitude,
            "Photo URL": centre.photo_url,
            "Google 3D View": centre.google_3d_view,
            "Status": centre.status,
            "Description": centre.description,
            "Source URL": centre.source_url,
            "Last Verified Date": TODAY,
        }
        for column_index, header in enumerate(HAWKER_DIRECTORY_COLUMNS, start=1):
            sheet.cell(row=row_index, column=column_index, value=values[header])

    sheet.freeze_panes = "A3"
    sheet.auto_filter.ref = f"A2:{get_column_letter(len(HAWKER_DIRECTORY_COLUMNS))}{sheet.max_row}"
    widths = {"A": 10, "B": 42, "C": 14, "D": 36, "E": 12, "F": 16, "G": 18, "H": 14, "I": 14, "J": 38, "K": 28, "L": 14, "M": 56, "N": 34, "O": 16}
    for column_letter, width in widths.items():
        sheet.column_dimensions[column_letter].width = width


def write_canonical_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MAIN_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich the Hungry Singapore food workbook with official public datasets.")
    parser.add_argument(
        "--workbook",
        default="data/singapore_food_stalls.xlsx",
        help="Path to the workbook to enrich in place.",
    )
    parser.add_argument(
        "--csv-output",
        default="data/singapore_food_businesses_canonical.csv",
        help="Path for the canonical CSV export.",
    )
    args = parser.parse_args()

    workbook_path = Path(args.workbook)
    csv_output_path = Path(args.csv_output)
    if not workbook_path.exists():
        raise SystemExit(f"Workbook not found: {workbook_path}")

    existing_rows, existing_hawker_rows = load_existing_workbook(workbook_path)
    seed_snapshot_rows = load_seed_snapshot(DEFAULT_SEED_SNAPSHOT_PATH)
    seed_source_rows = merge_seed_sources(existing_rows, seed_snapshot_rows)
    region_by_postal, region_by_building = build_region_lookups(seed_source_rows, existing_hawker_rows)
    hawker_centres = build_hawker_centres(existing_hawker_rows)
    hawker_by_postal = {centre.postal_code: centre for centre in hawker_centres if centre.postal_code}
    hawker_by_name = {normalize_name(centre.name): centre for centre in hawker_centres if centre.name}

    seed_rows = build_seed_rows(seed_source_rows, hawker_by_postal, hawker_by_name)
    official_rows = build_official_rows(region_by_postal, region_by_building, hawker_by_postal, hawker_by_name)
    merged_rows = merge_seed_and_official(seed_rows, official_rows)
    whyq_rows = build_whyq_rows(merged_rows, hawker_centres)
    merged_rows = merge_whyq_rows(merged_rows, whyq_rows)
    food_republic_rows = build_food_republic_rows(merged_rows, hawker_centres)
    merged_rows = merge_food_republic_rows(merged_rows, food_republic_rows)

    workbook = Workbook()
    write_main_sheet(workbook, merged_rows)
    write_field_guide(workbook)
    write_hawker_directory(workbook, hawker_centres)

    workbook.save(workbook_path)
    write_canonical_csv(merged_rows, csv_output_path)

    print(
        json.dumps(
            {
                "workbook": str(workbook_path),
                "csv": str(csv_output_path),
                "main_rows": len(merged_rows),
                "hawker_centres": len(hawker_centres),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
