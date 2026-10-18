#!/usr/bin/env python3
"""Build a Supabase catalog load from the "Public Access" F&B workbook.

The workbook (sheets "Public F&B Directory" and "Menu Items") uses a different
layout from the legacy importer, so this script maps it straight onto the
canonical buildings / venues / dishes tables:

  python3 scripts/load_public_fnb_catalog.py <workbook.xlsx> --out data/catalog_load

It writes buildings.csv, venues.csv, dishes.csv and load.sql. Apply with:

  psql "$DB_URL" -v ON_ERROR_STOP=1 -v commit=0 -f data/catalog_load/load.sql  # dry run
  psql "$DB_URL" -v ON_ERROR_STOP=1 -v commit=1 -f data/catalog_load/load.sql  # apply

What is kept:
- Venues with a usable F&B name and coordinates; supermarkets, vending
  machines, market produce and herbal tea stalls are skipped.
- Menu items linked to a kept venue by SFA licence, when the item's F&B name
  matches the venue name. Legacy filler rows, delivery-app listings and
  review-only rows are dropped; official operator sources are shown as
  operator_owned menu facts, anything else loads hidden.
- No images: the workbook approves none for display.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import math
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

AREAS_MIGRATION = Path("supabase/migrations/20260606120000_database_excel_integration_foundation.sql")
SKIPPED_BUSINESS_TYPES = (
    "supermarket",
    "food vending machine",
    "market produce",
    "sales of herbal tea",
)
LEGACY_SCOPE = "Legacy branch association from prior dataset"
DELIVERY_RE = re.compile(r"foodpanda|grab|deliveroo", re.I)
HAWKER_TYPES = ("nea managed foodstall", "ma managed foodstall")
FOOD_COURT_TYPES = ("foodcourt", "food court")
KOPITIAM_TYPES = ("coffeeshop", "eating house")
MALL_WORDS = ("mall", "plaza", "square", "point", "shopping", "hub", "atria", "junction", "city", "centre")


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def load_areas() -> list[tuple[str, str, float, float]]:
    areas = []
    pattern = re.compile(r"\('([^']+)',\s*'[^']+',\s*'([^']*)',\s*([\d.]+),\s*([\d.]+)\)")
    for match in pattern.finditer(AREAS_MIGRATION.read_text()):
        areas.append((match.group(1), match.group(2), float(match.group(3)), float(match.group(4))))
    if not areas:
        raise SystemExit("could not read the areas seed")
    return areas


def nearest_area(areas: list[tuple[str, str, float, float]], lat: float, lng: float) -> tuple[str, str]:
    best = min(areas, key=lambda a: (a[2] - lat) ** 2 + ((a[3] - lng) * math.cos(math.radians(lat))) ** 2)
    return best[0], best[1]


def parse_address(raw: str) -> tuple[str, str, str]:
    """Return (street, unit, building) from 'Address: 1 X ROAD #01-10,BUILDING,Singapore 123456'."""
    text = re.sub(r"^Address:\s*", "", raw).strip()
    parts = [p.strip() for p in text.split(",") if p.strip()]
    parts = [p for p in parts if not re.match(r"^Singapore\s*\d*$", p, re.I)]
    if not parts:
        return "", "", ""
    first = re.sub(r"\s+Singapore\s*\d*$", "", parts[0], flags=re.I).strip()
    units = []
    unit_match = re.search(r"\s(#\S+)", first)
    if unit_match:
        units.append(unit_match.group(1))
        first = first[: unit_match.start()].strip()
    building = ""
    for part in parts[1:]:
        if part.startswith("#"):
            units.append(part)
        elif not building:
            building = re.sub(r"\s*\([^)]*$", "", part).strip()
            if building.startswith("(") and building.endswith(")"):
                building = building[1:-1].strip()
    return first, ",".join(units), building


def title(text: str) -> str:
    words = []
    for word in text.split():
        words.append(word if any(c.isdigit() for c in word) else word.capitalize())
    return " ".join(words)


def floor_from_unit(unit: str) -> str:
    match = re.match(r"#\s*(B?)(\d+)-", unit, re.I)
    if not match:
        return "L1"
    level = int(match.group(2))
    return f"B{level}" if match.group(1) else f"L{level}"


def hygiene_grade(raw: str) -> str:
    match = re.search(r"SFA grade:\s*([A-D])\b", raw)
    # The column only accepts A-D; ungraded ("New", "Not graded") venues keep the
    # schema default. The app does not display hygiene grades.
    return match.group(1) if match else "A"


def building_type(business_types: set[str], name: str) -> str:
    lowered = {t.lower() for t in business_types}
    if re.search(r"hawker|food centre|market", name, re.I):
        return "hawker_centre"
    if re.search(r"food court|foodcourt|koufu|food junction|kopitiam", name, re.I):
        return "food_court" if not re.search(r"kopitiam", name, re.I) else "kopitiam"
    if any(word in name.lower() for word in MALL_WORDS):
        return "mall"
    if any(any(h in t for h in HAWKER_TYPES) for t in lowered):
        return "hawker_centre"
    if lowered & set(FOOD_COURT_TYPES):
        return "food_court"
    if any(any(k in t for k in KOPITIAM_TYPES) for t in lowered):
        return "kopitiam"
    return "other"


def cuisine_tags(raw: str) -> list[str]:
    tags = []
    for part in re.split(r"[;,/]", raw):
        tag = part.strip().lower()
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def excel_date(value: Any) -> str:
    if isinstance(value, (int, float)):
        return (date(1899, 12, 30) + timedelta(days=int(value))).isoformat()
    return ""


def parse_price(raw: Any) -> str:
    if isinstance(raw, (int, float)):
        return f"{float(raw):.2f}"
    match = re.search(r"(\d+(?:\.\d+)?)", clean(raw))
    if not match:
        return "0.00"
    value = float(match.group(1))
    return f"{value:.2f}" if value < 1000 else "0.00"


NAME_STOPWORDS = {"pte", "ltd", "the", "and", "restaurant", "cafe", "food", "singapore"}


def name_tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in NAME_STOPWORDS}


def pg_array(values: list[str]) -> str:
    escaped = ['"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"' for v in values]
    return "{" + ",".join(escaped) + "}"


def rows(sheet) -> list[dict[str, Any]]:
    iterator = sheet.iter_rows(values_only=True)
    header = next(iterator)
    return [dict(zip(header, row)) for row in iterator]


def build(workbook: Path, out: Path) -> dict[str, int]:
    wb = load_workbook(workbook, read_only=True)
    directory = rows(wb["Public F&B Directory"])
    menu = rows(wb["Menu Items"])
    areas = load_areas()

    buildings: dict[str, dict[str, Any]] = {}
    venues: dict[str, dict[str, Any]] = {}
    skipped = {"no_name": 0, "no_coordinates": 0, "not_a_food_destination": 0}

    for row in directory:
        licence = clean(row.get("SFA Licence"))
        name = clean(row.get("F&B Name"))
        business_type = clean(row.get("Business Type"))
        if not licence or licence in venues:
            continue
        if not name:
            skipped["no_name"] += 1
            continue
        if any(s in business_type.lower() for s in SKIPPED_BUSINESS_TYPES):
            skipped["not_a_food_destination"] += 1
            continue
        lat, lng = row.get("Latitude"), row.get("Longitude")
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            skipped["no_coordinates"] += 1
            continue

        street, unit, building_name = parse_address(clean(row.get("Full Address")))
        postal = clean(row.get("Postal Code"))
        display_building = title(building_name or street or "Standalone")
        building_id = "bld-" + hashlib.md5(f"{display_building.lower()}:{postal}".encode()).hexdigest()
        area, region = nearest_area(areas, float(lat), float(lng))

        building = buildings.setdefault(
            building_id,
            {
                "id": building_id,
                "name": display_building,
                "types": set(),
                "lats": [],
                "lngs": [],
                "address": title(street) + (f", Singapore {postal}" if postal else ""),
                "postal_code": postal,
                "region": region,
                "planning_area": area,
            },
        )
        building["types"].add(business_type)
        building["lats"].append(float(lat))
        building["lngs"].append(float(lng))

        venues[licence] = {
            "id": f"ven-{licence}",
            "building_id": building_id,
            "name": name,
            "unit_number": unit,
            "floor": floor_from_unit(unit),
            "hygiene_grade": hygiene_grade(clean(row.get("SFA Status / Hygiene Grade"))),
            "operating_hours": clean(row.get("Opening Hours / Closed Days")),
            "business_id": licence,
            "licence_no": licence,
            "cuisine_tags": pg_array(cuisine_tags(clean(row.get("Cuisine")))),
            "latitude": f"{float(lat):.7f}",
            "longitude": f"{float(lng):.7f}",
            "address": re.sub(r"^Address:\s*", "", clean(row.get("Full Address"))),
            "postal_code": postal,
            "planning_area": area,
            "last_verified_at": excel_date(row.get("SFA Verified Date")),
        }

    dishes: dict[str, dict[str, Any]] = {}
    menu_unlinked = 0
    for item in menu:
        # Legacy rows reuse a few generic dishes across hundreds of unrelated
        # venues; delivery-app and review-only rows are not operator facts.
        if clean(item.get("Menu Scope")) == LEGACY_SCOPE:
            continue
        source_type = clean(item.get("Source Type")).lower()
        notes = (clean(item.get("Rights / Reuse Status")) + " " + clean(item.get("Freshness Status"))).lower()
        if DELIVERY_RE.search(source_type + " " + clean(item.get("Official / Source URL"))):
            continue
        if re.search(r"review[-_ ]only|not approved", notes):
            continue
        name = re.sub(r"\s+", " ", clean(item.get("Menu Item")))
        if not (2 <= len(name) <= 120):
            continue
        licences = [x.strip() for x in clean(item.get("Applicable SFA Licence(s)")).split(",") if x.strip()]
        # Some licence links in the workbook point at the wrong outlet (e.g. a
        # milk tea under a Sichuan restaurant), so the item's F&B name must
        # share a word with the venue name.
        item_tokens = name_tokens(clean(item.get("F&B Name")))
        linked = [
            venues[l]
            for l in licences
            if l in venues and item_tokens & name_tokens(venues[l]["name"])
        ]
        if not linked:
            menu_unlinked += 1
            continue
        source_url = clean(item.get("Official / Source URL"))
        # The workbook's rights column is free text; official operator
        # sources are displayed as operator-published menu facts.
        approved = bool(re.search(r"official|operator|first-party", source_type))
        rights = "operator_owned" if approved else "unverified"
        for venue in linked:
            dish_id = "dsh-menu-" + hashlib.md5(f"{venue['business_id']}:{name.lower()}".encode()).hexdigest()
            price = parse_price(item.get("Price As Published"))
            existing = dishes.get(dish_id)
            if existing and (existing["price"] != "0.00" or price == "0.00"):
                continue
            dishes[dish_id] = {
                "id": dish_id,
                "venue_id": venue["id"],
                "building_id": venue["building_id"],
                "name": name,
                "price": price,
                "price_range": clean(item.get("Price As Published")),
                "cuisine_tags": venue["cuisine_tags"],
                "menu_approved_for_display": "true" if approved else "false",
                "menu_rights_status": rights,
                "menu_source_url": source_url,
            }

    out.mkdir(parents=True, exist_ok=True)
    building_rows = [
        {
            "id": b["id"],
            "name": b["name"],
            "building_type": building_type(b["types"], b["name"]),
            "latitude": f"{sum(b['lats']) / len(b['lats']):.7f}",
            "longitude": f"{sum(b['lngs']) / len(b['lngs']):.7f}",
            "address": b["address"],
            "postal_code": b["postal_code"],
            "region": b["region"],
            "planning_area": b["planning_area"],
        }
        for b in buildings.values()
    ]
    write_csv(out / "buildings.csv", building_rows)
    write_csv(out / "venues.csv", list(venues.values()))
    write_csv(out / "dishes.csv", list(dishes.values()))
    (out / "load.sql").write_text(LOAD_SQL)

    approved_dishes = sum(1 for d in dishes.values() if d["menu_approved_for_display"] == "true")
    return {
        "directory_rows": len(directory),
        "buildings": len(building_rows),
        "venues": len(venues),
        "dishes": len(dishes),
        "dishes_display_approved": approved_dishes,
        "menu_items_unlinked": menu_unlinked,
        **{f"skipped_{k}": v for k, v in skipped.items()},
    }


def write_csv(path: Path, data: list[dict[str, Any]]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(data[0].keys()))
        writer.writeheader()
        writer.writerows(data)


LOAD_SQL = r"""-- Generated by scripts/load_public_fnb_catalog.py. Run from the repo root:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v commit=0 -f data/catalog_load/load.sql
-- commit=0 rolls back (dry run); commit=1 keeps the load.
\set ON_ERROR_STOP on
set statement_timeout = 0;
begin;

create temp table load_buildings (
  id text, name text, building_type text, latitude double precision, longitude double precision,
  address text, postal_code text, region text, planning_area text
) on commit drop;
create temp table load_venues (
  id text, building_id text, name text, unit_number text, floor text, hygiene_grade text,
  operating_hours text, business_id text, licence_no text, cuisine_tags text[],
  latitude double precision, longitude double precision, address text, postal_code text,
  planning_area text, last_verified_at text
) on commit drop;
create temp table load_dishes (
  id text, venue_id text, building_id text, name text, price numeric, price_range text,
  cuisine_tags text[], menu_approved_for_display boolean, menu_rights_status text, menu_source_url text
) on commit drop;

\copy load_buildings from 'data/catalog_load/buildings.csv' with (format csv, header true)
\copy load_venues from 'data/catalog_load/venues.csv' with (format csv, header true)
\copy load_dishes from 'data/catalog_load/dishes.csv' with (format csv, header true)

insert into buildings (
  id, name, building_type, latitude, longitude, address, postal_code, region, planning_area,
  source_type, source_confidence
)
select id, name, building_type, latitude, longitude, coalesce(address, ''), coalesce(postal_code, ''),
  coalesce(region, ''), coalesce(planning_area, ''), 'spreadsheet', 0.800
from load_buildings
on conflict (id) do update set
  name = excluded.name,
  building_type = excluded.building_type,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  address = excluded.address,
  postal_code = excluded.postal_code,
  region = excluded.region,
  planning_area = excluded.planning_area,
  updated_at = now();

insert into venues (
  id, building_id, name, unit_number, floor, hygiene_grade, is_open, operating_hours,
  business_id, licence_no, cuisine_tags, latitude, longitude, address, postal_code,
  planning_area, source_type, source_confidence, last_verified_at
)
select id, building_id, name, coalesce(unit_number, ''), floor, hygiene_grade, true,
  coalesce(operating_hours, ''), business_id, licence_no, coalesce(cuisine_tags, '{}'),
  latitude, longitude, coalesce(address, ''), coalesce(postal_code, ''), coalesce(planning_area, ''),
  'spreadsheet', 0.800, coalesce(nullif(last_verified_at, '')::date, current_date)
from load_venues
on conflict (id) do update set
  building_id = excluded.building_id,
  name = excluded.name,
  unit_number = excluded.unit_number,
  floor = excluded.floor,
  hygiene_grade = excluded.hygiene_grade,
  operating_hours = excluded.operating_hours,
  cuisine_tags = excluded.cuisine_tags,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  address = excluded.address,
  postal_code = excluded.postal_code,
  planning_area = excluded.planning_area,
  last_verified_at = excluded.last_verified_at,
  updated_at = now();

insert into dishes (
  id, venue_id, building_id, name, price, price_range, cuisine_tags, is_featured, must_order,
  source_type, source_confidence, menu_approved_for_display, menu_rights_status, menu_source_url
)
select id, venue_id, building_id, name, price, coalesce(price_range, ''), coalesce(cuisine_tags, '{}'),
  false, false, 'spreadsheet_menu_item', 0.800, menu_approved_for_display, menu_rights_status,
  nullif(menu_source_url, '')
from load_dishes
on conflict (id) do update set
  venue_id = excluded.venue_id,
  building_id = excluded.building_id,
  name = excluded.name,
  price = excluded.price,
  price_range = excluded.price_range,
  cuisine_tags = excluded.cuisine_tags,
  menu_approved_for_display = excluded.menu_approved_for_display,
  menu_rights_status = excluded.menu_rights_status,
  menu_source_url = excluded.menu_source_url,
  updated_at = now();

-- Neutral taste vectors; the tag-dishes worker refines them later.
insert into dish_taste_vectors (dish_id, sweet, spicy, sour, salty, rich, aromatic, vector)
select id, 5, 5, 5, 5, 5, 5, '[5,5,5,5,5,5]' from load_dishes
on conflict (dish_id) do nothing;

with stats as (
  select building_id,
    coalesce(array_agg(distinct floor order by floor) filter (where floor <> ''), '{}') as floors,
    count(*) as venue_count
  from venues
  where building_id in (select id from load_buildings)
  group by building_id
)
update buildings b set floors = s.floors, venue_count = s.venue_count, updated_at = now()
from stats s where b.id = s.building_id;

with top_dishes as (
  select distinct on (venue_id) venue_id, id
  from dishes
  where venue_id in (select id from load_venues)
  order by venue_id, menu_approved_for_display desc, (price > 0) desc, rating_avg desc, id
)
update venues v set top_dish_id = t.id, updated_at = now()
from top_dishes t where v.id = t.venue_id;

select
  (select count(*) from buildings) as buildings,
  (select count(*) from venues) as venues,
  (select count(*) from dishes) as dishes,
  (select count(*) from dishes where public.catalog_menu_is_displayable(menu_approved_for_display, menu_rights_status, menu_source_url)) as displayable_dishes;

\if :commit
commit;
\else
rollback;
\endif
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--out", type=Path, default=Path("data/catalog_load"))
    args = parser.parse_args()
    for key, value in build(args.workbook, args.out).items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
