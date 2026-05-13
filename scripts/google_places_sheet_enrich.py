#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any


NULLISH_VALUES = {"", "-", "—", "N/A", "NA", "nil", "None", "none", "null"}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text in NULLISH_VALUES:
        return ""
    return text


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", clean_text(value)).strip()


def normalize_name(value: str) -> str:
    text = normalize_spaces(value).lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return normalize_spaces(text)


def normalize_postal(value: str) -> str:
    digits = re.sub(r"\D", "", clean_text(value))
    if not digits:
        return ""
    return digits[-6:] if len(digits) >= 6 else digits.zfill(6)


def similarity(left: str, right: str) -> float:
    left_clean = normalize_name(left)
    right_clean = normalize_name(right)
    if not left_clean or not right_clean:
        return 0.0
    if left_clean == right_clean:
        return 1.0
    if left_clean in right_clean or right_clean in left_clean:
        return 0.95
    return SequenceMatcher(a=left_clean, b=right_clean).ratio()


def contains_postal(haystack: str, postal: str) -> bool:
    if not postal:
        return False
    digits = re.sub(r"\D", "", haystack)
    return postal in digits


@dataclass(frozen=True)
class UsageCounters:
    search_text: int = 0
    get_place: int = 0
    get_photo_meta: int = 0
    backoff_429: int = 0


def http_json(
    url: str,
    api_key: str,
    method: str,
    body: dict[str, Any] | None,
    field_mask: str,
    timeout_s: int = 30,
    retry_429: int = 5,
) -> tuple[dict[str, Any], int, int]:
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=payload, method=method)
    request.add_header("Content-Type", "application/json; charset=utf-8")
    request.add_header("X-Goog-Api-Key", api_key)
    request.add_header("X-Goog-FieldMask", field_mask)

    attempts = 0
    backoffs = 0
    while True:
        attempts += 1
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:
                raw = response.read().decode("utf-8", errors="replace")
                return json.loads(raw) if raw else {}, attempts, backoffs
        except urllib.error.HTTPError as exc:
            status = getattr(exc, "code", None)
            raw = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
            if status == 429 and attempts <= retry_429:
                backoffs += 1
                sleep_s = min(30.0, 2.0 ** (attempts - 1)) + (0.1 * attempts)
                time.sleep(sleep_s)
                continue
            detail = raw.strip()[:500]
            raise RuntimeError(f"HTTP {status} for {url}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network error for {url}: {exc}") from exc


def build_text_query(name: str, address: str, postal: str) -> str:
    cleaned_name = clean_text(name)
    cleaned_address = clean_text(address)
    had_legal_suffix = bool(
        re.search(r"\b(pte\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|pte\.?)\b", cleaned_name, re.IGNORECASE)
    )
    stripped_name = normalize_spaces(
        re.sub(
            r"\b(pte\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|pte\.?)\b",
            " ",
            cleaned_name,
            flags=re.IGNORECASE,
        )
    )
    stripped_name = normalize_spaces(re.sub(r"\b(company|co\.?)\b", " ", stripped_name, flags=re.IGNORECASE))

    # For legal-entity strings, rely more on address + postal to avoid wrong-name matches.
    name_for_query = stripped_name
    if had_legal_suffix and len(normalize_name(stripped_name)) < 8:
        name_for_query = ""

    pieces = [name_for_query, cleaned_address]
    normalized_postal = normalize_postal(postal)
    if normalized_postal:
        pieces.append(f"Singapore {normalized_postal}")
    else:
        pieces.append("Singapore")
    return normalize_spaces(", ".join(piece for piece in pieces if piece))


def build_address_only_query(address: str, postal: str) -> str:
    cleaned_address = clean_text(address)
    pieces = [cleaned_address]
    normalized_postal = normalize_postal(postal)
    if normalized_postal:
        pieces.append(f"Singapore {normalized_postal}")
    else:
        pieces.append("Singapore")
    return normalize_spaces(", ".join(piece for piece in pieces if piece))


def to_float(value: Any) -> float | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def estimate_usd_spend(counters: UsageCounters) -> dict[str, float]:
    # Conservative defaults (not authoritative pricing).
    # Goal: bound worst-case spend and keep CREDIT_SAFE ceiling logic.
    rates = {
        "SearchText": 0.02,
        "GetPlace": 0.02,
        "GetPhotoMeta": 0.01,
    }
    return {
        "SearchText": counters.search_text * rates["SearchText"],
        "GetPlace": counters.get_place * rates["GetPlace"],
        "GetPhotoMeta": counters.get_photo_meta * rates["GetPhotoMeta"],
        "Total": (
            counters.search_text * rates["SearchText"]
            + counters.get_place * rates["GetPlace"]
            + counters.get_photo_meta * rates["GetPhotoMeta"]
        ),
    }


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def score_candidate(
    input_name: str,
    input_normalized: str,
    input_address: str,
    input_postal: str,
    input_lat: float | None,
    input_lng: float | None,
    candidate: dict[str, Any],
) -> tuple[float, dict[str, Any]]:
    display = candidate.get("displayName", {}) or {}
    candidate_name = clean_text(display.get("text")) or clean_text(candidate.get("displayName"))
    candidate_address = clean_text(candidate.get("formattedAddress"))
    candidate_postal_hit = contains_postal(candidate_address, input_postal)

    name_target = input_normalized or input_name
    name_sim = similarity(name_target, candidate_name)
    addr_sim = similarity(input_address, candidate_address)

    score = (name_sim * 0.75) + (addr_sim * 0.25)
    if input_postal and candidate_postal_hit:
        score = min(1.0, score + 0.12)
    if input_postal and not candidate_postal_hit:
        score = score - 0.12

    distance_m = None
    if input_lat is not None and input_lng is not None:
        location = candidate.get("location") or {}
        try:
            cand_lat = float(location.get("latitude"))
            cand_lng = float(location.get("longitude"))
            distance_m = haversine_m(input_lat, input_lng, cand_lat, cand_lng)
        except Exception:
            distance_m = None
    return score, {
        "candidateName": candidate_name,
        "candidateAddress": candidate_address,
        "nameSim": name_sim,
        "addrSim": addr_sim,
        "postalHit": candidate_postal_hit,
        "distanceM": distance_m,
    }


def run_passes(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = clean_text(payload.get("api_key"))
    if not api_key:
        raise SystemExit("Missing api_key")

    credit_ceiling_usd = float(payload.get("credit_ceiling_usd", 250))
    credit_spend_so_far_usd = float(payload.get("credit_spend_so_far_usd", 0))
    max_requests_per_min = int(payload.get("rate_limit_per_min", 250))
    min_interval_s = 60.0 / max_requests_per_min if max_requests_per_min > 0 else 0.3
    enable_place_details = bool(payload.get("enable_place_details", True))
    enable_photo_metadata = bool(payload.get("enable_photo_metadata", True))
    enable_place_id_matching = bool(payload.get("enable_place_id_matching", True))
    max_search_text_per_run = int(payload.get("max_search_text_per_run", 200))
    max_details_per_run = int(payload.get("max_details_per_run", 60))
    max_photo_meta_per_run = int(payload.get("max_photo_meta_per_run", 80))

    start_row = int(payload.get("start_row", 2))
    rows = payload.get("rows") or []
    if not isinstance(rows, list):
        raise SystemExit("payload.rows must be a list")

    field_map = payload.get("field_map") or {}
    if not isinstance(field_map, dict):
        raise SystemExit("payload.field_map must be a dict")

    dedupe_keys_seen: dict[str, dict[str, Any]] = {}
    updates: list[dict[str, Any]] = []
    geo_diff_flagged_rows: list[dict[str, Any]] = []
    counters = UsageCounters()
    low_confidence_samples: list[dict[str, Any]] = []
    max_low_confidence_samples = int(payload.get("max_low_confidence_samples", 20))

    last_request_at = 0.0

    def throttle() -> None:
        nonlocal last_request_at
        now = time.monotonic()
        elapsed = now - last_request_at
        if elapsed < min_interval_s:
            time.sleep(min_interval_s - elapsed)
        last_request_at = time.monotonic()

    def add_update(row_index_0: int, col_letter: str, value: Any) -> None:
        updates.append(
            {
                "row": start_row + row_index_0,
                "col": col_letter,
                "value": "" if value is None else value,
            }
        )

    scanned = 0
    skipped_already = 0
    skipped_low_conf = 0
    dedupe_savings = 0
    enriched = 0
    enriched_details = 0
    enriched_photo_meta = 0
    stop_reason: str | None = None
    last_row_processed: int | None = None

    def maybe_fetch_place_details(row_index_0: int, place_id: str, row: dict[str, Any]) -> None:
        nonlocal counters, enriched_details
        if not enable_place_details:
            return
        if enriched_details >= max_details_per_run:
            return
        def read_field(field_header: str) -> str:
            return clean_text(row.get(field_header, ""))

        needed: list[str] = []
        if not read_field("Google Rating"):
            needed.append("rating")
        if not read_field("Google Review Count"):
            needed.append("userRatingCount")
        if not read_field("Google Opening Hours JSON"):
            needed.append("regularOpeningHours")
        if not read_field("Google Price Level"):
            needed.append("priceLevel")
        if not read_field("Google Website"):
            needed.append("websiteUri")
        if not needed:
            return

        throttle()
        response, _attempts, backoffs = http_json(
            url=f"https://places.googleapis.com/v1/places/{place_id}",
            api_key=api_key,
            method="GET",
            body=None,
            field_mask=",".join(needed),
        )
        if backoffs:
            counters = UsageCounters(
                search_text=counters.search_text,
                get_place=counters.get_place,
                get_photo_meta=counters.get_photo_meta,
                backoff_429=counters.backoff_429 + backoffs,
            )
        counters = UsageCounters(
            search_text=counters.search_text,
            get_place=counters.get_place + 1,
            get_photo_meta=counters.get_photo_meta,
            backoff_429=counters.backoff_429,
        )

        if "rating" in needed and response.get("rating") is not None and not read_field("Google Rating"):
            add_update(row_index_0, "AR", response.get("rating"))
        if "userRatingCount" in needed and response.get("userRatingCount") is not None and not read_field(
            "Google Review Count"
        ):
            add_update(row_index_0, "AS", response.get("userRatingCount"))
        if "priceLevel" in needed and response.get("priceLevel") is not None and not read_field("Google Price Level"):
            add_update(row_index_0, "AU", response.get("priceLevel"))
        if "websiteUri" in needed and response.get("websiteUri") and not read_field("Google Website"):
            add_update(row_index_0, "AV", response.get("websiteUri"))
        if "regularOpeningHours" in needed and response.get("regularOpeningHours") and not read_field(
            "Google Opening Hours JSON"
        ):
            add_update(row_index_0, "AT", json.dumps(response.get("regularOpeningHours"), ensure_ascii=False))

        enriched_details += 1

    def maybe_fetch_photo_metadata(row_index_0: int, place_id: str, row: dict[str, Any]) -> None:
        nonlocal counters, enriched_photo_meta
        if not enable_photo_metadata:
            return
        if enriched_photo_meta >= max_photo_meta_per_run:
            return

        image_url = clean_text(row.get(field_map.get("Image URL", "Image URL"), ""))
        existing_photo_meta = clean_text(row.get("Google Photo Metadata", ""))
        if image_url or existing_photo_meta:
            return

        throttle()
        response, _attempts, backoffs = http_json(
            url=f"https://places.googleapis.com/v1/places/{place_id}",
            api_key=api_key,
            method="GET",
            body=None,
            field_mask="photos",
        )
        if backoffs:
            counters = UsageCounters(
                search_text=counters.search_text,
                get_place=counters.get_place,
                get_photo_meta=counters.get_photo_meta,
                backoff_429=counters.backoff_429 + backoffs,
            )
        counters = UsageCounters(
            search_text=counters.search_text,
            get_place=counters.get_place,
            get_photo_meta=counters.get_photo_meta + 1,
            backoff_429=counters.backoff_429,
        )

        photos = response.get("photos") or []
        if photos and not existing_photo_meta:
            compact = []
            for photo in photos[:3]:
                compact.append(
                    {
                        "name": clean_text(photo.get("name")),
                        "widthPx": photo.get("widthPx"),
                        "heightPx": photo.get("heightPx"),
                        "googleMapsUri": clean_text(photo.get("googleMapsUri")),
                        "author": clean_text(((photo.get("authorAttributions") or [{}])[0] or {}).get("displayName")),
                    }
                )
            add_update(row_index_0, "AW", json.dumps(compact, ensure_ascii=False))
            add_update(row_index_0, "AX", time.strftime("%Y-%m-%d", time.gmtime()))
            enriched_photo_meta += 1

    for index, row in enumerate(rows):
        scanned += 1
        last_row_processed = start_row + index

        def get(field: str) -> str:
            return clean_text(row.get(field_map.get(field, field), ""))

        name = get("Stall / Restaurant Name")
        normalized = get("Business Name Normalized")
        address = get("Address")
        postal = get("Postal Code")
        lat = get("Latitude")
        lng = get("Longitude")

        place_id = get("Google Place ID")
        if place_id:
            skipped_already += 1
            current_spend = estimate_usd_spend(counters)["Total"] + credit_spend_so_far_usd
            if current_spend < credit_ceiling_usd:
                maybe_fetch_place_details(index, place_id, row)
            current_spend = estimate_usd_spend(counters)["Total"] + credit_spend_so_far_usd
            if current_spend < credit_ceiling_usd:
                maybe_fetch_photo_metadata(index, place_id, row)
            continue
        if not enable_place_id_matching:
            skipped_low_conf += 1
            if len(low_confidence_samples) < max_low_confidence_samples:
                low_confidence_samples.append(
                    {
                        "row": start_row + index,
                        "reason": "place_id_matching_disabled",
                    }
                )
            continue

        dedupe_key = "|".join(
            part
            for part in (
                normalize_name(normalized or name),
                normalize_postal(postal),
                normalize_name(address),
            )
            if part
        )
        if dedupe_key and dedupe_key in dedupe_keys_seen:
            prior = dedupe_keys_seen[dedupe_key]
            if prior.get("place_id"):
                # Reuse existing match to avoid repeat SearchText calls.
                dedupe_savings += 1
                add_update(index, "AK", prior["place_id"])
                if prior.get("display_name"):
                    add_update(index, "AL", prior["display_name"])
                if prior.get("formatted_address"):
                    add_update(index, "AM", prior["formatted_address"])
                if prior.get("geo_override"):
                    if prior.get("g_lat") is not None:
                        add_update(index, "AN", prior["g_lat"])
                    if prior.get("g_lng") is not None:
                        add_update(index, "AO", prior["g_lng"])
                    if prior.get("primary_type"):
                        add_update(index, "AP", prior["primary_type"])
                if prior.get("maps_uri"):
                    add_update(index, "AQ", prior["maps_uri"])
                enriched += 1
            continue

        # Spend guard (based on conservative estimates + already-spent hint).
        current_spend = estimate_usd_spend(counters)["Total"] + credit_spend_so_far_usd
        if current_spend >= credit_ceiling_usd:
            stop_reason = "credit_ceiling_reached"
            break
        if counters.search_text >= max_search_text_per_run:
            stop_reason = "max_search_text_per_run_reached"
            break

        text_query = build_text_query(name or normalized, address, postal)
        if not text_query:
            skipped_low_conf += 1
            if len(low_confidence_samples) < max_low_confidence_samples:
                low_confidence_samples.append(
                    {
                        "row": start_row + index,
                        "reason": "missing_text_query",
                        "name": name,
                        "normalized": normalized,
                        "address": address,
                        "postal": normalize_postal(postal),
                    }
                )
            continue

        lat_f = to_float(lat)
        lng_f = to_float(lng)

        def make_body(query: str) -> dict[str, Any]:
            body: dict[str, Any] = {"textQuery": query, "languageCode": "en", "regionCode": "sg"}
            if lat_f is not None and lng_f is not None:
                body["locationBias"] = {
                    "circle": {
                        "center": {"latitude": lat_f, "longitude": lng_f},
                        "radius": 350.0,
                    }
                }
                body["rankPreference"] = "DISTANCE"
            return body

        body = make_body(text_query)
        throttle()
        response, _attempts, backoffs = http_json(
            url="https://places.googleapis.com/v1/places:searchText",
            api_key=api_key,
            method="POST",
            body=body,
            field_mask="places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.googleMapsUri",
        )
        if backoffs:
            counters = UsageCounters(
                search_text=counters.search_text,
                get_place=counters.get_place,
                get_photo_meta=counters.get_photo_meta,
                backoff_429=counters.backoff_429 + backoffs,
            )
        counters = UsageCounters(
            search_text=counters.search_text + 1,
            get_place=counters.get_place,
            get_photo_meta=counters.get_photo_meta,
            backoff_429=counters.backoff_429,
        )

        candidates = response.get("places") or []
        if not candidates:
            # Fallback: try address-only query (often better for legal-entity names).
            if counters.search_text < max_search_text_per_run:
                address_only_query = build_address_only_query(address, postal)
                if address_only_query and address_only_query != text_query:
                    throttle()
                    response, _attempts, backoffs = http_json(
                        url="https://places.googleapis.com/v1/places:searchText",
                        api_key=api_key,
                        method="POST",
                        body=make_body(address_only_query),
                        field_mask="places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.googleMapsUri",
                    )
                    if backoffs:
                        counters = UsageCounters(
                            search_text=counters.search_text,
                            get_place=counters.get_place,
                            get_photo_meta=counters.get_photo_meta,
                            backoff_429=counters.backoff_429 + backoffs,
                        )
                    counters = UsageCounters(
                        search_text=counters.search_text + 1,
                        get_place=counters.get_place,
                        get_photo_meta=counters.get_photo_meta,
                        backoff_429=counters.backoff_429,
                    )
                    candidates = response.get("places") or []

        if not candidates:
            skipped_low_conf += 1
            if len(low_confidence_samples) < max_low_confidence_samples:
                low_confidence_samples.append(
                    {
                        "row": start_row + index,
                        "reason": "no_candidates",
                        "query": text_query,
                    }
                )
            continue

        best: dict[str, Any] | None = None
        best_score = -math.inf
        best_debug: dict[str, Any] = {}
        for candidate in candidates[:10]:
            score, debug = score_candidate(
                name,
                normalized,
                address,
                normalize_postal(postal),
                lat_f,
                lng_f,
                candidate,
            )
            if score > best_score:
                best_score = score
                best = candidate
                best_debug = debug

        # Confidence rules: require strong name similarity and (when postal exists) postal hit.
        postal_norm = normalize_postal(postal)
        if best is None:
            skipped_low_conf += 1
            continue
        reject_reason = ""
        postal_hit = bool(best_debug.get("postalHit"))
        name_sim = float(best_debug.get("nameSim", 0.0) or 0.0)
        addr_sim = float(best_debug.get("addrSim", 0.0) or 0.0)
        distance_m = best_debug.get("distanceM")

        accept_by_proximity = False
        if postal_norm and postal_hit and distance_m is not None:
            try:
                if float(distance_m) <= 250.0 and addr_sim >= 0.35 and name_sim >= 0.55:
                    accept_by_proximity = True
            except Exception:
                accept_by_proximity = False

        if postal_norm and not postal_hit:
            reject_reason = "postal_mismatch"
        elif not accept_by_proximity and name_sim < 0.84:
            reject_reason = "weak_name_similarity"
        elif not accept_by_proximity and best_score < 0.82:
            reject_reason = "low_score"
        if reject_reason:
            skipped_low_conf += 1
            if len(low_confidence_samples) < max_low_confidence_samples:
                low_confidence_samples.append(
                    {
                        "row": start_row + index,
                        "reason": reject_reason,
                        "query": text_query,
                        "bestScore": round(best_score, 4),
                        "best": {
                            "placeId": clean_text(best.get("id")),
                            "displayName": best_debug.get("candidateName"),
                            "formattedAddress": best_debug.get("candidateAddress"),
                            "primaryType": clean_text(best.get("primaryType")),
                            "googleMapsUri": clean_text(best.get("googleMapsUri")),
                        },
                        "debug": best_debug,
                    }
                )
            continue

        chosen_place_id = clean_text(best.get("id"))
        if not chosen_place_id:
            skipped_low_conf += 1
            continue

        display = best.get("displayName", {}) or {}
        display_name = clean_text(display.get("text")) or clean_text(best.get("displayName"))
        formatted_address = clean_text(best.get("formattedAddress"))
        location = best.get("location", {}) or {}
        g_lat = location.get("latitude")
        g_lng = location.get("longitude")
        primary_type = clean_text(best.get("primaryType"))
        maps_uri = clean_text(best.get("googleMapsUri"))
        geo_override = False
        geo_distance_m = None
        if lat_f is not None and lng_f is not None and g_lat is not None and g_lng is not None:
            try:
                geo_distance_m = haversine_m(lat_f, lng_f, float(g_lat), float(g_lng))
                geo_override = geo_distance_m >= 120.0
            except Exception:
                geo_distance_m = None
                geo_override = False

        add_update(index, "AK", chosen_place_id)
        add_update(index, "AL", display_name)
        add_update(index, "AM", formatted_address)
        if geo_override:
            if g_lat is not None:
                add_update(index, "AN", g_lat)
            if g_lng is not None:
                add_update(index, "AO", g_lng)
            add_update(index, "AP", primary_type)
            geo_diff_flagged_rows.append(
                {
                    "row": start_row + index,
                    "distanceM": round(float(geo_distance_m or 0.0), 2),
                    "existingLatitude": lat_f,
                    "existingLongitude": lng_f,
                    "googleLatitude": g_lat,
                    "googleLongitude": g_lng,
                }
            )
        add_update(index, "AQ", maps_uri)
        enriched += 1

        current_spend = estimate_usd_spend(counters)["Total"] + credit_spend_so_far_usd
        if current_spend < credit_ceiling_usd:
            maybe_fetch_place_details(index, chosen_place_id, row)
        current_spend = estimate_usd_spend(counters)["Total"] + credit_spend_so_far_usd
        if current_spend < credit_ceiling_usd:
            maybe_fetch_photo_metadata(index, chosen_place_id, row)

        if dedupe_key:
            dedupe_keys_seen[dedupe_key] = {
                "place_id": chosen_place_id,
                "display_name": display_name,
                "formatted_address": formatted_address,
                "g_lat": g_lat,
                "g_lng": g_lng,
                "primary_type": primary_type,
                "maps_uri": maps_uri,
                "geo_override": geo_override,
            }

    spend = estimate_usd_spend(counters)
    return {
        "start_row": start_row,
        "stop_reason": stop_reason,
        "last_row_processed": last_row_processed,
        "rows_scanned": scanned,
        "rows_enriched_place_id": enriched,
        "rows_enriched_place_details": enriched_details,
        "rows_enriched_photo_metadata": enriched_photo_meta,
        "rows_skipped_already_enriched": skipped_already,
        "rows_skipped_low_confidence": skipped_low_conf,
        "dedupe_savings": dedupe_savings,
        "updates": updates,
        "usage": {
            "SearchText": counters.search_text,
            "GetPlace": counters.get_place,
            "GetPhotoMeta": counters.get_photo_meta,
            "Backoff429Events": counters.backoff_429,
        },
        "estimated_spend_usd": spend,
        "low_confidence_samples": low_confidence_samples,
        "geo_diff_flagged_rows": geo_diff_flagged_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to JSON payload containing rows and config.")
    parser.add_argument("--output", required=True, help="Path to write JSON result containing updates.")
    args = parser.parse_args()

    payload = json.loads(open(args.input, "r", encoding="utf-8").read())
    result = run_passes(payload)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
