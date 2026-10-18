#!/usr/bin/env python3
"""Fill venue catalog gaps from open-licensed public data.

  python3 scripts/enrich_from_open_data.py --sources osm,datagov,overture,foursquare,onemap \
      --venues data/catalog_load/venues.csv --out data/open_data_enrichment \
      [--priority datagov,osm,overture,foursquare] [--overwrite] [--limit N] [--offline]

Sources (official/open APIs only, read-only):
- osm      OpenStreetMap via the Overpass API (ODbL). Opening hours, website,
           phone, cuisine and diet:* tags for F&B places in Singapore.
- datagov  data.gov.sg (Singapore Open Data Licence). The licensed eating
           establishment list is discovered through the collections API, with
           a configured fallback id. Used for licence matching and an
           informational hygiene-grade count; it fills no venue columns.
- overture Overture Maps Places (CDLA-Permissive-2.0), latest release, Singapore
           bbox only, read with DuckDB httpfs row-group pushdown (needs duckdb).
- foursquare Foursquare OS Places (Apache-2.0), Singapore rows. Gated on Hugging
           Face: skipped unless HF_TOKEN is set and the terms were accepted.
- onemap   OneMap search (SLA). Optional postal-code geocode check. Skipped
           when the endpoint returns no results without a token.

When several sources offer the same field, --priority decides
(default datagov,osm,overture,foursquare); dietary tags are unioned. Every filled
field carries <field>_source and <field>_licence columns for attribution.

Matching, per source record against data/catalog_load/venues.csv:
  1. licence number (exact)
  2. postal code + normalised name similarity >= --name-threshold (0.85)
  3. distance < --max-distance-m (40) + name similarity >= --near-threshold (0.75)

Only fill-ins are written: a field already set on the venue is skipped unless
--overwrite is passed. Nothing is written to the database; apply the generated
apply_enrichment.sql with psql (see data/open_data_enrichment/README.md).
Responses are cached under data/open_data_cache/ so reruns are cheap.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import hashlib
import json
import math
import os
import re
import ssl
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

USER_AGENT = "Hungry-open-data-enrichment/1.0 (Singapore F&B catalog; contact: data@hungry.example)"
CACHE_DIR = Path("data/open_data_cache")

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
OSM_AMENITIES = ("restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "ice_cream")
OSM_LICENCE = "ODbL-1.0 (© OpenStreetMap contributors)"

DATAGOV_COLLECTIONS_URL = "https://api-production.data.gov.sg/v2/public/api/collections"
DATAGOV_METADATA_URL = "https://api-production.data.gov.sg/v2/public/api/datasets/{id}/metadata"
DATAGOV_DOWNLOAD_URL = "https://api-open.data.gov.sg/v1/public/api/datasets/{id}/{step}"
DATAGOV_NAME_RE = re.compile(r"licensed eating establishments|eating establishments", re.I)
# Used only when discovery fails. Last checked 2026-10-18.
DATAGOV_FALLBACK_DATASETS = ("d_227473e811b09731e64725f140b77697",)
DATAGOV_LICENCE = "Singapore Open Data Licence v1.0"

ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"
ONEMAP_LICENCE = "Singapore Open Data Licence v1.0 (OneMap, SLA)"

MIN_INTERVAL_S = {"overpass": 5.0, "datagov": 0.5, "onemap": 0.3, "overture": 0.5, "foursquare": 1.0}
BACKOFF_S = (2, 4, 8, 16)

FIELDS = ("operating_hours", "website_url", "contact_phone", "cuisine_tags", "dietary_tags")
# Provenance column prefix per field (<prefix>_source, <prefix>_licence).
PROVENANCE = {
    "operating_hours": "operating_hours",
    "website_url": "website_url",
    "contact_phone": "contact_phone",
    "cuisine_tags": "cuisine",
    "dietary_tags": "dietary",
}
DEFAULT_PRIORITY = ("datagov", "osm", "overture", "foursquare")
OUT_COLUMNS = (
    "venue_id", *FIELDS,
    *(f"{PROVENANCE[f]}_{kind}" for f in FIELDS for kind in ("source", "licence")),
    "osm_opening_hours", "venue_name", "source_name", "source", "licence", "source_id",
    "match_method", "confidence", "fetched_at",
)

OVERTURE_BUCKET = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
OVERTURE_S3 = "s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*"
OVERTURE_LICENCE = "CDLA-Permissive-2.0 (Overture Maps Foundation)"
SG_BBOX = (103.6, 1.15, 104.1, 1.48)  # xmin, ymin, xmax, ymax

FSQ_DATASET = "foursquare/fsq-os-places"
FSQ_TREE_URL = "https://huggingface.co/api/datasets/foursquare/fsq-os-places/tree/main/release"
FSQ_LICENCE = "Apache-2.0 (Foursquare OS Places)"
FSQ_TOKEN_ENV = ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN")
# Not the venue's own website: socials, delivery apps, review sites, map/short links.
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "tiktok.com", "twitter.com", "x.com", "linkedin.com",
                "wa.me", "linktr.ee", "youtube.com", "foodpanda.sg", "foodpanda.com", "grab.com",
                "deliveroo.com.sg", "deliveroo.com", "hungrygowhere.com", "tripadvisor.com", "tripadvisor.com.sg",
                "burpple.com", "yelp.com", "google.com", "goo.gl", "bit.ly")

LEGAL_SUFFIX_RE = re.compile(
    r"\b(pte\.?\s*ltd\.?|private\s+limited|pte|ltd\.?|limited|llp|sdn\.?\s*bhd\.?|inc\.?|co\.)(?=\s|$)", re.I
)
CUISINE_SYNONYMS = {
    "coffee": "coffee_shop",
    "kopitiam": "coffee_shop",
    "local": "singaporean",
    "noodles": "noodle",
    "bubble tea": "bubble_tea",
    "boba": "bubble_tea",
    "hong_kong": "hongkong",
    "steakhouse": "steak_house",
    "bbq": "barbecue",
    "doughnut": "donut",
    "ice cream": "ice_cream",
}
DAYS = ("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
DAY_LABEL = dict(zip(DAYS, ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")))


# ── HTTP: polite, cached, retrying ────────────────────────────────────────────
def ssl_context() -> ssl.SSLContext:
    try:
        import certifi  # type: ignore

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for bundle in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
        if os.path.exists(bundle):
            return ssl.create_default_context(cafile=bundle)
    return ssl.create_default_context()


class OfflineMiss(Exception):
    pass


class Http:
    def __init__(self, cache_dir: Path, offline: bool) -> None:
        self.cache_dir = cache_dir
        self.offline = offline
        self.ctx = ssl_context()
        self.last: dict[str, float] = {}
        self.requests = 0
        self.cache_hits = 0

    def get(self, bucket: str, url: str, data: bytes | None = None, cache_key: str | None = None,
            timeout: int = 60, use_cache: bool = True) -> bytes:
        key = hashlib.sha256((cache_key or (url + "|" + (data or b"").decode())).encode()).hexdigest()
        path = self.cache_dir / bucket / f"{key}.bin"
        if use_cache and path.exists():
            self.cache_hits += 1
            return path.read_bytes()
        if self.offline:
            raise OfflineMiss(url)
        body = self._fetch(bucket, url, data, timeout)
        if use_cache:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        return body

    def _fetch(self, bucket: str, url: str, data: bytes | None, timeout: int) -> bytes:
        last_error: Exception | None = None
        for attempt in range(len(BACKOFF_S) + 1):
            wait = MIN_INTERVAL_S.get(bucket, 1.0) - (time.monotonic() - self.last.get(bucket, 0.0))
            if wait > 0:
                time.sleep(wait)
            headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
            if data is not None:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
            try:
                self.requests += 1
                with urlopen(Request(url, data=data, headers=headers), timeout=timeout, context=self.ctx) as resp:
                    body = resp.read()
                self.last[bucket] = time.monotonic()
                return body
            except HTTPError as err:
                self.last[bucket] = time.monotonic()
                last_error = err
                if err.code not in (429, 500, 502, 503, 504):
                    raise
                retry_after = err.headers.get("Retry-After") if err.headers else None
                delay = float(retry_after) if retry_after and retry_after.isdigit() else None
            except (URLError, TimeoutError, ConnectionError) as err:
                self.last[bucket] = time.monotonic()
                last_error = err
                delay = None
            if attempt < len(BACKOFF_S):
                time.sleep(delay or BACKOFF_S[attempt])
        raise RuntimeError(f"giving up on {urlparse(url).netloc}: {last_error}")


# ── Normalisation ────────────────────────────────────────────────────────────
def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
    text = text.replace("&", " and ").replace("@", " at ")
    text = re.sub(r"\(.*?\)", " ", text)
    text = LEGAL_SUFFIX_RE.sub(" ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def name_similarity(a: str, b: str) -> float:
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    direct = difflib.SequenceMatcher(None, na, nb).ratio()
    sorted_tokens = difflib.SequenceMatcher(None, " ".join(sorted(na.split())), " ".join(sorted(nb.split()))).ratio()
    return round(max(direct, sorted_tokens), 4)


def normalize_phone(raw: str) -> str:
    """First Singapore number in raw as E.164 (+65XXXXXXXX), else ''."""
    for part in re.split(r"[;,/]|\bor\b", raw or ""):
        digits = re.sub(r"\D", "", part)
        if digits.startswith("0065"):
            digits = digits[4:]
        elif digits.startswith("65") and len(digits) in (10, 13):
            digits = digits[2:]
        if len(digits) == 8 and digits[0] in "3689":
            return "+65" + digits
        if len(digits) == 11 and digits.startswith(("1800", "1300", "800")):
            return "+65" + digits
    return ""


def normalize_url(raw: str) -> str:
    """First http(s) URL in raw, forced to https, else ''."""
    for part in re.split(r"[;\s]+", (raw or "").strip()):
        if not part:
            continue
        if not re.match(r"^[a-z][a-z0-9+.-]*://", part, re.I):
            part = "https://" + part.lstrip("/")
        parsed = urlparse(part)
        if parsed.scheme.lower() not in ("http", "https"):
            continue
        host = parsed.netloc.lower()
        if "." not in host or " " in host or "@" in host:
            continue
        rest = part.split("://", 1)[1].split("/", 1)
        path = "/" + rest[1] if len(rest) > 1 else "/"
        return f"https://{host}{path}"
    return ""


def map_cuisines(raw: str, vocabulary: set[str]) -> list[str]:
    tags: list[str] = []
    for part in re.split(r"[;,]", raw or ""):
        tag = part.strip().lower()
        tag = CUISINE_SYNONYMS.get(tag, tag)
        tag = re.sub(r"[^a-z0-9]+", "_", tag).strip("_")
        tag = CUISINE_SYNONYMS.get(tag, tag)
        if not tag or len(tag) > 40:
            continue
        # Keep known vocabulary; also keep clean OSM slugs (the catalog already uses them).
        if (tag in vocabulary or re.fullmatch(r"[a-z]+(_[a-z]+)?", tag)) and tag not in tags:
            tags.append(tag)
    return tags


def dietary_tags(tags: dict[str, str]) -> list[str]:
    out = []
    for key in ("halal", "vegetarian", "vegan"):
        if tags.get(f"diet:{key}", "").lower() in ("yes", "only"):
            out.append(key)
    return out


# OSM opening_hours → the app's free-text format ("Mon-Fri 11:00-22:00; Sat-Sun 10:00-23:00").
# The app (src/utils/stallStatus.ts) pulls every HH:MM pair and treats the word
# "closed" as closed-now, so off days are omitted rather than written as "closed".
TIME_RANGE_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$")
DAY_TOKEN_RE = re.compile(r"^(Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su))?$")


def _parse_days(selector: str) -> list[str] | None:
    days: list[str] = []
    for token in selector.split(","):
        token = token.strip()
        match = DAY_TOKEN_RE.match(token)
        if not match:
            return None
        start = DAYS.index(match.group(1))
        end = DAYS.index(match.group(2) or match.group(1))
        span = range(start, end + 1) if end >= start else list(range(start, 7)) + list(range(0, end + 1))
        days.extend(DAYS[i] for i in span if DAYS[i] not in days)
    return days


def _parse_times(text: str) -> list[tuple[int, int]] | None:
    ranges = []
    for token in text.split(","):
        match = TIME_RANGE_RE.match(token.strip())
        if not match:
            return None
        h1, m1, h2, m2 = (int(g) for g in match.groups())
        if h1 > 24 or h2 > 48 or m1 > 59 or m2 > 59:
            return None
        ranges.append((h1 * 60 + m1, h2 * 60 + m2))
    return ranges


def _fmt(minutes: int) -> str:
    minutes %= 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def osm_hours_to_app(raw: str) -> str:
    """Convert simple OSM opening_hours to app text; '' when unsupported."""
    text = (raw or "").strip()
    if not text:
        return ""
    if text == "24/7":
        return "Daily 24 hours"
    week: dict[str, list[tuple[int, int]]] = {d: [] for d in DAYS}
    for rule in [r.strip() for r in re.split(r";|\|\|", text) if r.strip()]:
        if re.match(r"^(PH|SH)\s*,", rule):
            rule = re.sub(r"^(PH|SH)\s*,\s*", "", rule)
        elif re.match(r"^(PH|SH)\b", rule):
            continue  # public/school holiday overrides are dropped
        rule = re.sub(r"^((?:Mo|Tu|We|Th|Fr|Sa|Su)[\w\s,-]*?),\s*PH\b", r"\1", rule)
        match = re.match(r"^((?:Mo|Tu|We|Th|Fr|Sa|Su)[A-Za-z\s,-]*?)(?:\s+(.*))?$", rule)
        if match and _parse_days(match.group(1)) is not None:
            days, rest = _parse_days(match.group(1)), (match.group(2) or "").strip()
        else:
            days, rest = list(DAYS), rule
        assert days is not None
        if rest.lower() in ("off", "closed"):
            ranges: list[tuple[int, int]] = []
        elif rest in ("", "24/7", "00:00-24:00"):
            ranges = [(0, 24 * 60)]
        else:
            parsed = _parse_times(rest)
            if parsed is None:
                return ""
            ranges = parsed
        for day in days:
            week[day] = ranges
    if not any(week.values()):
        return ""

    def render(ranges: list[tuple[int, int]]) -> str:
        if ranges == [(0, 24 * 60)]:
            return "24 hours"
        return ", ".join(f"{_fmt(a)}-{_fmt(b)}" for a, b in ranges)

    groups: list[tuple[list[str], str]] = []
    for day in DAYS:
        if not week[day]:
            continue
        label = render(week[day])
        if groups and groups[-1][1] == label and DAYS.index(groups[-1][0][-1]) == DAYS.index(day) - 1:
            groups[-1][0].append(day)
        else:
            groups.append(([day], label))
    if len(groups) == 1 and len(groups[0][0]) == 7:
        return f"Daily {groups[0][1]}"
    parts = []
    for days, label in groups:
        span = DAY_LABEL[days[0]] if len(days) == 1 else f"{DAY_LABEL[days[0]]}-{DAY_LABEL[days[-1]]}"
        parts.append(f"{span} {label}")
    return "; ".join(parts)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def postal(raw: str) -> str:
    match = re.search(r"\b(\d{6})\b", raw or "")
    return match.group(1) if match else ""


# ── Venues and matching ──────────────────────────────────────────────────────
@dataclass
class Venue:
    id: str
    name: str
    licence_no: str
    postal_code: str
    lat: float | None
    lng: float | None
    values: dict[str, str]


@dataclass
class SourceRecord:
    source: str
    source_id: str
    name: str
    licence_no: str = ""
    postal_code: str = ""
    lat: float | None = None
    lng: float | None = None
    tags: dict[str, Any] = field(default_factory=dict)
    fields: dict[str, str] = field(default_factory=dict)  # normalised candidate values
    licence: str = ""
    fetched_at: str = ""


@dataclass
class Match:
    venue: Venue
    method: str
    confidence: float


def load_venues(path: Path) -> list[Venue]:
    venues = []
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            def num(key: str) -> float | None:
                try:
                    return float(row.get(key) or "")
                except ValueError:
                    return None

            values = {f: (row.get(f) or "").strip() for f in FIELDS}
            if values["cuisine_tags"] in ("{}", '""'):
                values["cuisine_tags"] = ""
            venues.append(Venue(row["id"], row.get("name", ""), (row.get("licence_no") or "").strip().upper(),
                                postal(row.get("postal_code", "")), num("latitude"), num("longitude"), values))
    return venues


def cuisine_vocabulary(venues: Iterable[Venue]) -> set[str]:
    vocab = set()
    for venue in venues:
        for tag in venue.values["cuisine_tags"].strip("{}").replace('"', "").split(","):
            if re.fullmatch(r"[a-z_]+", tag.strip()):
                vocab.add(tag.strip())
    return vocab


class Matcher:
    CELL = 0.001  # ~110 m grid cells

    def __init__(self, venues: list[Venue], name_threshold: float, near_threshold: float, max_distance_m: float):
        self.name_threshold = name_threshold
        self.near_threshold = near_threshold
        self.max_distance_m = max_distance_m
        self.by_licence: dict[str, Venue] = {}
        self.by_postal: dict[str, list[Venue]] = {}
        self.grid: dict[tuple[int, int], list[Venue]] = {}
        for venue in venues:
            if venue.licence_no:
                self.by_licence.setdefault(venue.licence_no, venue)
            if venue.postal_code:
                self.by_postal.setdefault(venue.postal_code, []).append(venue)
            if venue.lat is not None and venue.lng is not None:
                self.grid.setdefault(self._cell(venue.lat, venue.lng), []).append(venue)

    def _cell(self, lat: float, lng: float) -> tuple[int, int]:
        return int(math.floor(lat / self.CELL)), int(math.floor(lng / self.CELL))

    def match(self, rec: SourceRecord) -> Match | None:
        if rec.licence_no and rec.licence_no.upper() in self.by_licence:
            return Match(self.by_licence[rec.licence_no.upper()], "licence", 1.0)
        best: Match | None = None
        if rec.postal_code:
            for venue in self.by_postal.get(rec.postal_code, []):
                sim = name_similarity(rec.name, venue.name)
                if sim >= self.name_threshold and (best is None or sim > best.confidence):
                    best = Match(venue, "postal_name", round(sim, 3))
        if best:
            return best
        if rec.lat is None or rec.lng is None:
            return None
        cy, cx = self._cell(rec.lat, rec.lng)
        scored = None
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for venue in self.grid.get((cy + dy, cx + dx), []):
                    dist = haversine_m(rec.lat, rec.lng, venue.lat, venue.lng)  # type: ignore[arg-type]
                    if dist >= self.max_distance_m:
                        continue
                    sim = name_similarity(rec.name, venue.name)
                    if sim < self.near_threshold:
                        continue
                    conf = round(sim * (1 - 0.25 * dist / self.max_distance_m), 3)
                    if scored is None or conf > scored.confidence:
                        scored = Match(venue, "distance_name", conf)
        return scored


# ── Sources ──────────────────────────────────────────────────────────────────
def overpass_query() -> str:
    amenity = "|".join(OSM_AMENITIES)
    return (
        "[out:json][timeout:180];"
        'area["ISO3166-1"="SG"][admin_level=2]->.sg;'
        f'(nwr["amenity"~"^({amenity})$"]["name"](area.sg);'
        'nwr["shop"="bakery"]["name"](area.sg););'
        "out center tags;"
    )


def fetch_osm(http: Http, log: list[str]) -> tuple[list[SourceRecord], str]:
    body = None
    data = urlencode({"data": overpass_query()}).encode()
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            body = http.get("overpass", endpoint, data=data, cache_key="overpass|" + overpass_query(), timeout=240)
            break
        except OfflineMiss:
            log.append("osm: offline and no cached Overpass response")
            return [], ""
        except Exception as err:  # noqa: BLE001 - try the next mirror
            log.append(f"osm: {urlparse(endpoint).netloc} failed: {err}")
    if body is None:
        return [], ""
    payload = json.loads(body)
    fetched = payload.get("osm3s", {}).get("timestamp_osm_base", "")
    records = []
    for el in payload.get("elements", []):
        tags = el.get("tags", {})
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lng = el.get("lon", el.get("center", {}).get("lon"))
        records.append(SourceRecord(
            "osm", f"{el['type']}/{el['id']}", tags.get("name", ""), "",
            postal(tags.get("addr:postcode", "")), lat, lng, tags))
    return records, fetched


def discover_datagov(http: Http, log: list[str]) -> list[str]:
    found: list[str] = []
    try:
        first = json.loads(http.get("datagov", f"{DATAGOV_COLLECTIONS_URL}?page=1"))
        pages = int(first["data"].get("pages", 1))
        for page in range(1, pages + 1):
            data = first if page == 1 else json.loads(http.get("datagov", f"{DATAGOV_COLLECTIONS_URL}?page={page}"))
            for coll in data["data"].get("collections", []):
                if DATAGOV_NAME_RE.search(coll.get("name", "")):
                    found.extend(coll.get("childDatasets") or [])
    except OfflineMiss:
        log.append("datagov: offline; collection listing not cached")
    except Exception as err:  # noqa: BLE001
        log.append(f"datagov: discovery failed ({err}); using fallback ids")
    usable = []
    for dataset_id in dict.fromkeys(found):
        try:
            meta = json.loads(http.get("datagov", DATAGOV_METADATA_URL.format(id=dataset_id))).get("data") or {}
        except Exception:  # noqa: BLE001
            continue
        columns = {c.get("name") for c in (meta.get("columnMetadata") or {}).get("metaMapping", {}).values()}
        if "licence_number" in columns:
            usable.append(dataset_id)
    if not usable:
        log.append("datagov: no discovered dataset has licence_number; using fallback config")
        usable = list(DATAGOV_FALLBACK_DATASETS)
    return usable


def fetch_datagov(http: Http, log: list[str]) -> tuple[list[SourceRecord], str, list[str]]:
    records: list[SourceRecord] = []
    fetched = ""
    dataset_ids = discover_datagov(http, log)
    for dataset_id in dataset_ids:
        try:
            meta_raw = http.get("datagov", DATAGOV_METADATA_URL.format(id=dataset_id))
            meta = json.loads(meta_raw).get("data") or {}
            version = meta.get("lastUpdatedAt", "")
            key = f"datagov-csv|{dataset_id}|{version}"
            cache_path = http.cache_dir / "datagov" / f"{hashlib.sha256(key.encode()).hexdigest()}.bin"
            if cache_path.exists():
                body = cache_path.read_bytes()
            elif http.offline:
                raise OfflineMiss(dataset_id)
            else:
                http.get("datagov", DATAGOV_DOWNLOAD_URL.format(id=dataset_id, step="initiate-download"), use_cache=False)
                url = ""
                for _ in range(10):
                    poll = json.loads(http.get("datagov", DATAGOV_DOWNLOAD_URL.format(id=dataset_id, step="poll-download"),
                                               use_cache=False))
                    if poll.get("data", {}).get("status") == "DOWNLOAD_SUCCESS":
                        url = poll["data"]["url"]
                        break
                    time.sleep(3)
                if not url:
                    raise RuntimeError("download not ready")
                body = http.get("datagov", url, cache_key=key, timeout=180)
            fetched = version
        except OfflineMiss:
            log.append(f"datagov: offline and {dataset_id} not cached")
            continue
        except Exception as err:  # noqa: BLE001
            log.append(f"datagov: {dataset_id} failed: {err}")
            continue
        for row in csv.DictReader(body.decode("utf-8-sig").splitlines()):
            licence = (row.get("licence_number") or "").strip().upper()
            if not licence:
                continue
            records.append(SourceRecord(
                "datagov", f"{dataset_id}:{licence}", row.get("licensee_name", ""), licence,
                postal(row.get("premises_address", "")), None, None,
                {"grade": (row.get("grade") or "").strip().upper(), "address": row.get("premises_address", "")}))
    return records, fetched, dataset_ids


def onemap_geocode_checks(http: Http, venues: list[Venue], max_checks: int, log: list[str]) -> list[dict[str, Any]]:
    seen: dict[str, Venue] = {}
    for venue in venues:
        if venue.postal_code and venue.lat is not None and venue.postal_code not in seen:
            seen[venue.postal_code] = venue
    checks = []
    for code, venue in list(seen.items())[:max_checks]:
        query = urlencode({"searchVal": code, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": 1})
        try:
            data = json.loads(http.get("onemap", f"{ONEMAP_SEARCH_URL}?{query}", timeout=30))
        except OfflineMiss:
            continue
        except Exception as err:  # noqa: BLE001
            log.append(f"onemap: stopped after error: {err}")
            break
        results = [r for r in data.get("results", []) if r.get("POSTAL") == code]
        if not results:
            if data.get("error") and not data.get("results"):
                log.append("onemap: endpoint needs a token; skipped")
                break
            continue
        lat, lng = float(results[0]["LATITUDE"]), float(results[0]["LONGITUDE"])
        dist = haversine_m(lat, lng, venue.lat, venue.lng)  # type: ignore[arg-type]
        checks.append({"postal_code": code, "sample_venue_id": venue.id, "onemap_lat": lat, "onemap_lng": lng,
                       "distance_m": round(dist, 1), "flag": "check" if dist > 250 else "ok"})
    return checks


# ── Build outputs ────────────────────────────────────────────────────────────
def pg_array(values: list[str]) -> str:
    return "{" + ",".join('"' + v.replace('"', "") + '"' for v in values) + "}" if values else ""


def website(raw: Iterable[str] | str) -> str:
    """First non-social website, normalised to https."""
    for value in [raw] if isinstance(raw, str) else list(raw or []):
        url = normalize_url(value or "")
        host = urlparse(url).netloc.lower()
        if url and not any(host == h or host.endswith("." + h) for h in SOCIAL_HOSTS):
            return url
    return ""


def first_phone(values: Iterable[str] | str) -> str:
    for value in [values] if isinstance(values, str) else list(values or []):
        phone = normalize_phone(value or "")
        if phone:
            return phone
    return ""


def category_cuisine(labels: Iterable[str], vocab: set[str]) -> list[str]:
    """Cuisine slugs from category names like 'chinese_restaurant' or 'Chinese Restaurant'."""
    raw = []
    for label in labels:
        leaf = re.split(r">", label or "")[-1].strip().lower()
        leaf = re.sub(r"[\s_]*(restaurant|eatery|food|cuisine)$", "", leaf).strip(" _")
        if leaf and leaf not in ("", "fast", "casual", "food_and_drink", "dining and drinking"):
            raw.append(leaf)
    # Category labels are noisier than OSM cuisine tags: keep only known catalog vocabulary.
    return [t for t in map_cuisines(";".join(raw), vocab) if t in vocab]


def osm_fields(tags: dict[str, str], vocab: set[str]) -> dict[str, str]:
    return {
        "operating_hours": osm_hours_to_app(tags.get("opening_hours", "")),
        "website_url": website(tags.get("website") or tags.get("contact:website") or ""),
        "contact_phone": normalize_phone(tags.get("phone") or tags.get("contact:phone") or ""),
        "cuisine_tags": pg_array(map_cuisines(tags.get("cuisine", ""), vocab)),
        "dietary_tags": pg_array(dietary_tags(tags)),
    }


def fill_values(fields: dict[str, str], venue: Venue, overwrite: bool) -> dict[str, str]:
    fill = {}
    for key, value in fields.items():
        if not value:
            continue
        # dietary_tags is merged (array union) on apply, so it is always offered.
        if key != "dietary_tags" and venue.values.get(key) and not overwrite:
            continue
        fill[key] = value
    return fill


def osm_fill(rec: SourceRecord, venue: Venue, vocab: set[str], overwrite: bool) -> dict[str, str]:
    return fill_values(osm_fields(rec.tags, vocab), venue, overwrite)


def overture_row_to_record(row: dict[str, Any], vocab: set[str], release: str) -> SourceRecord | None:
    addresses = row.get("addresses") or []
    address = addresses[0] if addresses else {}
    if address.get("country") and address.get("country") != "SG":
        return None
    hierarchy = row.get("hierarchy") or []
    labels = list(hierarchy[1:]) + list(row.get("alternates") or []) + [row.get("categories_primary") or ""]
    licences = sorted({s.get("license") for s in (row.get("sources") or []) if s and s.get("license")})
    rec = SourceRecord(
        "overture", row["id"], row.get("name") or "", "", postal(address.get("postcode") or ""),
        row.get("lat"), row.get("lng"),
        {"confidence": row.get("confidence"), "socials": row.get("socials") or [], "freeform": address.get("freeform")},
    )
    rec.fields = {
        "operating_hours": "",
        "website_url": website(row.get("websites") or []),
        "contact_phone": first_phone(row.get("phones") or []),
        "cuisine_tags": pg_array(category_cuisine(labels, vocab)),
        "dietary_tags": "",
    }
    rec.licence = OVERTURE_LICENCE + (f"; upstream: {', '.join(licences)}" if licences else "")
    rec.fetched_at = release
    return rec


def latest_overture_release(http: Http, log: list[str]) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    url = f"{OVERTURE_BUCKET}/?list-type=2&prefix=release/&delimiter=/"
    body = http.get("overture", url, cache_key=f"overture-releases|{stamp}").decode()
    releases = sorted(re.findall(r"<Prefix>release/([^/<]+)/</Prefix>", body))
    if not releases:
        raise RuntimeError("no Overture releases listed")
    return releases[-1]


def fetch_overture(http: Http, vocab: set[str], min_confidence: float, log: list[str]) -> tuple[list[SourceRecord], str]:
    try:
        release = latest_overture_release(http, log)
    except OfflineMiss:
        cached = sorted((http.cache_dir / "overture").glob("places-*.json"))
        if not cached:
            log.append("overture: offline and no cached extract")
            return [], ""
        release = cached[-1].stem.removeprefix("places-")
    except Exception as err:  # noqa: BLE001
        log.append(f"overture: release discovery failed: {err}")
        return [], ""
    cache_path = http.cache_dir / "overture" / f"places-{release}.json"
    if cache_path.exists():
        rows = json.loads(cache_path.read_text())
        http.cache_hits += 1
    elif http.offline:
        log.append(f"overture: offline and release {release} not cached")
        return [], release
    else:
        try:
            import duckdb  # type: ignore
        except ImportError:
            log.append("overture: skipped, duckdb not installed (pip install --user duckdb)")
            return [], release
        xmin, ymin, xmax, ymax = SG_BBOX
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
        # Reads only row groups whose bbox stats overlap Singapore; never the global files.
        query = f"""
            select id, names.primary as name, taxonomy.primary as categories_primary,
              taxonomy.hierarchy as hierarchy, taxonomy.alternates as alternates, websites, phones, socials,
              addresses, confidence, sources, operating_status,
              (bbox.ymin + bbox.ymax) / 2 as lat, (bbox.xmin + bbox.xmax) / 2 as lng
            from read_parquet('{OVERTURE_S3.format(release=release)}')
            where bbox.xmin between {xmin} and {xmax} and bbox.ymin between {ymin} and {ymax}
              and taxonomy.hierarchy[1] = 'food_and_drink'
        """
        try:
            cursor = con.execute(query)
        except Exception as err:  # noqa: BLE001 - schema drift between releases
            log.append(f"overture: query failed for {release}: {err}")
            return [], release
        cols = [d[0] for d in cursor.description]
        rows = [dict(zip(cols, r)) for r in cursor.fetchall()]
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(rows, default=str))
    records = []
    for row in rows:
        if (row.get("confidence") or 0) < min_confidence or row.get("operating_status") in ("permanently_closed", "closed"):
            continue
        rec = overture_row_to_record(row, vocab, release)
        if rec and rec.name:
            records.append(rec)
    return records, release


def fsq_row_to_record(row: dict[str, Any], vocab: set[str], release: str) -> SourceRecord | None:
    if row.get("date_closed") or (row.get("country") and row.get("country") != "SG"):
        return None
    rec = SourceRecord(
        "foursquare", row["fsq_place_id"], row.get("name") or "", "", postal(row.get("postcode") or ""),
        row.get("latitude"), row.get("longitude"), {},
    )
    rec.fields = {
        "operating_hours": "",
        "website_url": website(row.get("website") or ""),
        "contact_phone": first_phone(row.get("tel") or ""),
        "cuisine_tags": pg_array(category_cuisine(row.get("fsq_category_labels") or [], vocab)),
        "dietary_tags": "",
    }
    rec.licence = FSQ_LICENCE
    rec.fetched_at = release
    return rec


def fetch_foursquare(http: Http, vocab: set[str], log: list[str]) -> tuple[list[SourceRecord], str]:
    token = next((os.environ[k] for k in FSQ_TOKEN_ENV if os.environ.get(k)), "")
    cached = sorted((http.cache_dir / "foursquare").glob("places-*.json"))
    if not token and not cached:
        log.append(
            "foursquare: skipped, dataset is gated on Hugging Face. To enable: accept the terms at "
            f"https://huggingface.co/datasets/{FSQ_DATASET} with a Hugging Face account, create a read token, "
            "and export HF_TOKEN before running.")
        return [], ""
    release = ""
    if token and not http.offline:
        try:
            tree = json.loads(http.get("foursquare", FSQ_TREE_URL,
                                       cache_key=f"fsq-tree|{datetime.now(timezone.utc):%Y-%m-%d}"))
            dates = sorted(p["path"].split("dt=")[-1] for p in tree if "dt=" in p.get("path", ""))
            release = dates[-1] if dates else ""
        except Exception as err:  # noqa: BLE001
            log.append(f"foursquare: release listing failed: {err}")
    if not release and cached:
        release = cached[-1].stem.removeprefix("places-")
    if not release:
        log.append("foursquare: no release found")
        return [], ""
    cache_path = http.cache_dir / "foursquare" / f"places-{release}.json"
    if cache_path.exists():
        rows = json.loads(cache_path.read_text())
        http.cache_hits += 1
    elif http.offline or not token:
        log.append(f"foursquare: release {release} not cached")
        return [], release
    else:
        try:
            import duckdb  # type: ignore
        except ImportError:
            log.append("foursquare: skipped, duckdb not installed")
            return [], release
        con = duckdb.connect()
        try:
            con.execute("INSTALL httpfs; LOAD httpfs;")
            con.execute("create secret hf_fsq (type huggingface, token $token)".replace(
                "$token", "'" + token.replace("'", "''") + "'"))
            cursor = con.execute(f"""
                select fsq_place_id, name, latitude, longitude, postcode, country, tel, website,
                  fsq_category_labels, date_closed
                from read_parquet('hf://datasets/{FSQ_DATASET}/release/dt={release}/places/parquet/*.parquet')
                where country = 'SG'
                  and list_contains(list_transform(fsq_category_labels, x -> split_part(x, ' > ', 1)), 'Dining and Drinking')
            """)
            cols = [d[0] for d in cursor.description]
            rows = [dict(zip(cols, r)) for r in cursor.fetchall()]
        except Exception as err:  # noqa: BLE001 - token/terms errors land here; message has no secret
            log.append(f"foursquare: query failed ({type(err).__name__}); check HF_TOKEN and accepted terms")
            return [], release
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(rows, default=str))
    records = [r for r in (fsq_row_to_record(row, vocab, release) for row in rows) if r and r.name]
    return records, release


def merge_candidates(candidates: dict[str, dict[str, tuple[Match, SourceRecord, dict[str, str]]]],
                     priority: list[str]) -> tuple[list[dict[str, Any]], dict[str, dict[str, int]]]:
    """One row per venue; each field comes from the highest-priority source offering it."""
    won: dict[str, dict[str, int]] = {s: {f: 0 for f in FIELDS} for s in priority}
    rows = []
    for venue_id, by_source in sorted(candidates.items()):
        row: dict[str, Any] = {"venue_id": venue_id}
        used: list[str] = []
        for fld in FIELDS:
            prefix = PROVENANCE[fld]
            if fld == "dietary_tags":
                tags: list[str] = []
                srcs = []
                for src in priority:
                    value = by_source.get(src, (None, None, {}))[2].get(fld, "")
                    new = [t for t in value.strip("{}").replace('"', "").split(",") if t and t not in tags]
                    if new:
                        tags += new
                        srcs.append(src)
                if tags:
                    row[fld] = pg_array(sorted(tags))
                    row[f"{prefix}_source"] = ";".join(srcs)
                    row[f"{prefix}_licence"] = ";".join(by_source[s][1].licence for s in srcs)
                    used += srcs
                    for s in srcs:
                        won[s][fld] += 1
                continue
            for src in priority:
                if src in by_source and by_source[src][2].get(fld):
                    row[fld] = by_source[src][2][fld]
                    row[f"{prefix}_source"] = src
                    row[f"{prefix}_licence"] = by_source[src][1].licence
                    used.append(src)
                    won[src][fld] += 1
                    break
        if not used:
            continue
        srcs = [s for s in priority if s in used]
        osm = by_source.get("osm")
        row.update({
            "osm_opening_hours": osm[1].tags.get("opening_hours", "") if osm else "",
            "venue_name": next(iter(by_source.values()))[0].venue.name,
            "source_name": ";".join(by_source[s][1].name for s in srcs),
            "source": ";".join(srcs),
            "licence": ";".join(by_source[s][1].licence for s in srcs),
            "source_id": ";".join(by_source[s][1].source_id for s in srcs),
            "match_method": ";".join(by_source[s][0].method for s in srcs),
            "confidence": min(by_source[s][0].confidence for s in srcs),
            "fetched_at": ";".join(by_source[s][1].fetched_at for s in srcs),
        })
        rows.append(row)
    return rows, won


def write_csv(path: Path, columns: Iterable[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(columns), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def apply_sql(csv_rel: str, overwrite: bool) -> str:
    def fill(col: str) -> str:
        if overwrite:
            return f"coalesce(nullif(e.{col}, ''), v.{col})"
        return f"case when coalesce(v.{col}, '') = '' then coalesce(nullif(e.{col}, ''), v.{col}) else v.{col} end"

    cuisine = ("case when e.cuisine_tags <> '' then e.cuisine_tags::text[] else v.cuisine_tags end" if overwrite else
               "case when coalesce(cardinality(v.cuisine_tags), 0) = 0 and e.cuisine_tags <> '' "
               "then e.cuisine_tags::text[] else v.cuisine_tags end")
    counts = """select
  count(*) as venues,
  count(*) filter (where coalesce(operating_hours, '') <> '') as with_hours,
  count(*) filter (where coalesce(website_url, '') <> '') as with_website,
  count(*) filter (where coalesce(contact_phone, '') <> '') as with_phone,
  count(*) filter (where coalesce(cardinality(cuisine_tags), 0) > 0) as with_cuisine,
  count(*) filter (where coalesce(cardinality(dietary_tags), 0) > 0) as with_dietary
from venues;"""
    columns = ",\n  ".join(f"{c} text" for c in OUT_COLUMNS)
    return f"""-- Generated by scripts/enrich_from_open_data.py{' --overwrite' if overwrite else ''}. Run from the repo root:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v commit=0 -f data/open_data_enrichment/apply_enrichment.sql  # dry run
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v commit=1 -f data/open_data_enrichment/apply_enrichment.sql  # apply
-- Mode: {'overwrite non-empty values' if overwrite else 'fill empty values only'}; dietary_tags are merged.
-- hygiene_grade is never touched. Per-field provenance stays in the CSV (*_source, *_licence);
-- venues has no provenance column yet. Licences and attribution: data/open_data_enrichment/README.md.
\\set ON_ERROR_STOP on
set statement_timeout = 0;
begin;

do $$
declare missing text;
begin
  select string_agg(c, ', ') into missing
  from unnest(array['operating_hours', 'website_url', 'contact_phone', 'cuisine_tags', 'dietary_tags']) as c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'venues' and column_name = c
  );
  if missing is not null then
    raise exception 'venues is missing column(s): % (apply migration 20261018130000_venue_contact_links.sql first)', missing;
  end if;
end $$;

create temp table enrich (
  {columns}
) on commit drop;

\\copy enrich from '{csv_rel}' with (format csv, header true)

\\echo 'before:'
{counts}

update venues v set
  operating_hours = {fill('operating_hours')},
  website_url = nullif({fill('website_url')}, ''),
  contact_phone = nullif({fill('contact_phone')}, ''),
  cuisine_tags = {cuisine},
  dietary_tags = case when coalesce(e.dietary_tags, '') = '' then v.dietary_tags else
    array(select distinct t from unnest(coalesce(v.dietary_tags, '{{}}') || e.dietary_tags::text[]) as t order by t) end,
  updated_at = now()
from (
  select venue_id, coalesce(operating_hours, '') as operating_hours, coalesce(website_url, '') as website_url,
    coalesce(contact_phone, '') as contact_phone, coalesce(cuisine_tags, '') as cuisine_tags,
    coalesce(dietary_tags, '') as dietary_tags
  from enrich
) e
where v.id = e.venue_id;

select count(*) as enrichment_rows,
  (select count(*) from enrich e where not exists (select 1 from venues v where v.id = e.venue_id)) as unknown_venue_ids
from enrich;

\\echo 'after:'
{counts}

\\if :commit
commit;
\\else
rollback;
\\endif
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--sources", default="osm,datagov,onemap")
    parser.add_argument("--priority", default=",".join(DEFAULT_PRIORITY),
                        help="field-fill priority when several sources offer a value")
    parser.add_argument("--venues", type=Path, default=Path("data/catalog_load/venues.csv"))
    parser.add_argument("--out", type=Path, default=Path("data/open_data_enrichment"))
    parser.add_argument("--cache", type=Path, default=CACHE_DIR)
    parser.add_argument("--overwrite", action="store_true", help="replace non-empty venue values")
    parser.add_argument("--limit", type=int, default=0, help="process at most N records per source")
    parser.add_argument("--offline", action="store_true", help="use cached responses only")
    parser.add_argument("--name-threshold", type=float, default=0.85)
    parser.add_argument("--near-threshold", type=float, default=0.75)
    parser.add_argument("--max-distance-m", type=float, default=40.0)
    parser.add_argument("--overture-min-confidence", type=float, default=0.5)
    parser.add_argument("--onemap-max", type=int, default=300, help="max postal codes to geocode-check")
    args = parser.parse_args(argv)

    known = {"osm", "datagov", "onemap", "overture", "foursquare"}
    sources = {s.strip() for s in args.sources.split(",") if s.strip()}
    if sources - known:
        parser.error(f"unknown source(s): {', '.join(sorted(sources - known))}")
    priority = [s.strip() for s in args.priority.split(",") if s.strip()]
    priority += [s for s in DEFAULT_PRIORITY if s not in priority]

    args.out.mkdir(parents=True, exist_ok=True)
    venues = load_venues(args.venues)
    vocab = cuisine_vocabulary(venues)
    matcher = Matcher(venues, args.name_threshold, args.near_threshold, args.max_distance_m)
    http = Http(args.cache, args.offline)
    log: list[str] = []
    run_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary: dict[str, Any] = {
        "generated_at": run_at, "venues_in_catalog": len(venues), "overwrite": args.overwrite,
        "priority": priority,
        "thresholds": {"postal_name": args.name_threshold, "distance_name": args.near_threshold,
                       "max_distance_m": args.max_distance_m},
        "sources": {}, "licences": {},
    }
    candidates: dict[str, dict[str, tuple[Match, SourceRecord, dict[str, str]]]] = {}
    unmatched: list[dict[str, Any]] = []

    def collect(name: str, records: list[SourceRecord], licence: str, extra: dict[str, Any]) -> None:
        if args.limit:
            records = records[: args.limit]
        best: dict[str, tuple[Match, SourceRecord]] = {}
        methods: dict[str, int] = {}
        for rec in records:
            match = matcher.match(rec) if rec.name else None
            if not match:
                if name == "osm":
                    tags = rec.tags
                    unmatched.append({
                        "osm_id": rec.source_id, "name": rec.name,
                        "category": tags.get("amenity") or tags.get("shop", ""), "lat": rec.lat, "lng": rec.lng,
                        "postal_code": rec.postal_code, "housenumber": tags.get("addr:housenumber", ""),
                        "street": tags.get("addr:street", ""), "unit": tags.get("addr:unit", ""),
                        "opening_hours": tags.get("opening_hours", ""), "cuisine": tags.get("cuisine", ""),
                        "website": rec.fields.get("website_url", ""), "phone": rec.fields.get("contact_phone", ""),
                        "source": "osm", "licence": OSM_LICENCE,
                    })
                continue
            methods[match.method] = methods.get(match.method, 0) + 1
            prev = best.get(match.venue.id)
            if prev is None or match.confidence > prev[0].confidence:
                best[match.venue.id] = (match, rec)
        offered = {f: 0 for f in FIELDS}
        for venue_id, (match, rec) in best.items():
            fill = fill_values(rec.fields, match.venue, args.overwrite)
            if fill:
                candidates.setdefault(venue_id, {})[name] = (match, rec, fill)
                for key in fill:
                    offered[key] += 1
        summary["sources"][name] = {
            "records": len(records), "matched_records": sum(methods.values()), "matched_venues": len(best),
            "match_methods": methods, "unmatched_records": len(records) - sum(methods.values()),
            "fields_offered": offered, **extra,
        }
        summary["licences"][name] = licence

    if "datagov" in sources:
        records, fetched, dataset_ids = fetch_datagov(http, log)
        for rec in records:
            rec.licence, rec.fetched_at = DATAGOV_LICENCE, fetched
        if args.limit:
            records = records[: args.limit]
        catalog_grade = {}
        with args.venues.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                catalog_grade[row["id"]] = row.get("hygiene_grade", "")
        graded: dict[str, str] = {}
        for rec in records:
            match = matcher.match(rec)
            if match and match.method == "licence" and rec.tags.get("grade") in ("A", "B", "C", "D"):
                graded[match.venue.id] = rec.tags["grade"]
        collect("datagov", records, DATAGOV_LICENCE, {
            "datasets": dataset_ids, "dataset_last_updated": fetched,
            "note": "Licence list fills no venue columns today (it has no hours/web/phone/cuisine fields).",
            "hygiene_grade_info": {
                "note": "Informational only; hygiene_grade is never updated. The NEA list predates the 2019 "
                        "SFA transfer, so its grades are historical.",
                "venues_with_published_grade": len(graded),
                "venues_on_default_or_workbook_grade": len(venues) - len(graded),
                "published_grade_equals_catalog_grade": sum(1 for v, g in graded.items() if catalog_grade.get(v) == g),
            },
        })

    if "osm" in sources:
        records, fetched = fetch_osm(http, log)
        for rec in records:
            rec.fields = osm_fields(rec.tags, vocab)
            rec.licence, rec.fetched_at = OSM_LICENCE, fetched or run_at
        unconvertible = sum(1 for r in records if r.tags.get("opening_hours") and not r.fields["operating_hours"])
        collect("osm", records, OSM_LICENCE, {"osm_base_timestamp": fetched,
                                              "opening_hours_not_convertible": unconvertible})

    if "overture" in sources:
        records, release = fetch_overture(http, vocab, args.overture_min_confidence, log)
        collect("overture", records, OVERTURE_LICENCE, {"release": release,
                                                        "min_confidence": args.overture_min_confidence})

    if "foursquare" in sources:
        records, release = fetch_foursquare(http, vocab, log)
        collect("foursquare", records, FSQ_LICENCE, {"release": release})

    if "onemap" in sources:
        checks = onemap_geocode_checks(http, venues, args.limit or args.onemap_max, log)
        if checks:
            write_csv(args.out / "geocode_checks.csv", checks[0].keys(), checks)
        summary["sources"]["onemap"] = {
            "postal_codes_checked": len(checks),
            "flagged_over_250m": sum(1 for c in checks if c["flag"] == "check"),
            "planning_area": "skipped: OneMap planning-area API needs a token",
        }
        summary["licences"]["onemap"] = ONEMAP_LICENCE

    out_rows, won = merge_candidates(candidates, priority)
    summary["fields_filled"] = {f: sum(1 for r in out_rows if r.get(f)) for f in FIELDS}
    summary["fields_filled_by_source"] = {s: v for s, v in won.items() if any(v.values())}
    summary["venues_with_fill"] = len(out_rows)
    write_csv(args.out / "venue_enrichment.csv", OUT_COLUMNS, out_rows)
    write_csv(args.out / "unmatched_osm.csv", (
        "osm_id", "name", "category", "lat", "lng", "postal_code", "housenumber", "street", "unit",
        "opening_hours", "cuisine", "website", "phone", "source", "licence"), unmatched)
    csv_rel = (args.out / "venue_enrichment.csv").as_posix()
    (args.out / "apply_enrichment.sql").write_text(apply_sql(csv_rel, args.overwrite), encoding="utf-8")
    summary["http"] = {"requests": http.requests, "cache_hits": http.cache_hits}
    summary["log"] = log
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ("fields_filled", "fields_filled_by_source", "venues_with_fill", "log")},
                     indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
