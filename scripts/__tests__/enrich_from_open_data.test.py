#!/usr/bin/env python3
"""Offline tests for scripts/enrich_from_open_data.py (no network)."""

from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import enrich_from_open_data as eod  # noqa: E402


def venue(vid, name, licence="", postal_code="", lat=None, lng=None, **values):
    base = {f: "" for f in eod.FIELDS}
    base.update(values)
    return eod.Venue(vid, name, licence, postal_code, lat, lng, base)


class NormalisationTest(unittest.TestCase):
    def test_name_normalisation_strips_legal_suffixes_and_punctuation(self):
        self.assertEqual(eod.normalize_name("001 Cafe Pte. Ltd."), "001 cafe")
        self.assertEqual(eod.normalize_name("Ah-Hock's Café & Bar (Tampines)"), "ah hock s cafe and bar")
        self.assertEqual(eod.name_similarity("Toast Box Pte Ltd", "Toast Box"), 1.0)
        self.assertLess(eod.name_similarity("Toast Box", "Ya Kun Kaya Toast"), 0.75)

    def test_phone_normalisation_to_e164(self):
        self.assertEqual(eod.normalize_phone("+65 6291 9727"), "+6562919727")
        self.assertEqual(eod.normalize_phone("6291-9727"), "+6562919727")
        self.assertEqual(eod.normalize_phone("(65) 9123 4567; +65 6000 0000"), "+6591234567")
        self.assertEqual(eod.normalize_phone("1800 123 4567"), "+6518001234567")
        self.assertEqual(eod.normalize_phone("+60 3 1234 5678"), "")
        self.assertEqual(eod.normalize_phone(""), "")

    def test_url_normalisation_to_https(self):
        self.assertEqual(eod.normalize_url("www.example.sg"), "https://www.example.sg/")
        self.assertEqual(eod.normalize_url("http://Example.com/menu?x=1"), "https://example.com/menu?x=1")
        self.assertEqual(eod.normalize_url("https://a.sg/;https://b.sg"), "https://a.sg/")
        self.assertEqual(eod.normalize_url("mailto:hi@example.com"), "")
        self.assertEqual(eod.normalize_url("not a url"), "")

    def test_cuisine_and_dietary_mapping(self):
        vocab = {"chinese", "coffee_shop", "noodle"}
        self.assertEqual(eod.map_cuisines("Chinese;noodles;coffee", vocab), ["chinese", "noodle", "coffee_shop"])
        self.assertEqual(eod.map_cuisines("bubble tea", vocab), ["bubble_tea"])
        tags = {"diet:halal": "yes", "diet:vegetarian": "only", "diet:vegan": "no"}
        self.assertEqual(eod.dietary_tags(tags), ["halal", "vegetarian"])


class OpeningHoursTest(unittest.TestCase):
    def test_simple_daily(self):
        self.assertEqual(eod.osm_hours_to_app("Mo-Su 11:00-22:00"), "Daily 11:00-22:00")
        self.assertEqual(eod.osm_hours_to_app("24/7"), "Daily 24 hours")

    def test_grouped_days_split_shifts_and_off_days(self):
        self.assertEqual(
            eod.osm_hours_to_app("Mo-Fr 11:00-14:30,17:30-22:00; Sa 10:00-23:00; Su off; PH off"),
            "Mon-Fri 11:00-14:30, 17:30-22:00; Sat 10:00-23:00",
        )

    def test_overnight_and_override(self):
        self.assertEqual(eod.osm_hours_to_app("Mo-Su 18:00-02:00; Mo off"), "Tue-Sun 18:00-02:00")
        self.assertEqual(eod.osm_hours_to_app("Tu-Su 17:00-26:00"), "Tue-Sun 17:00-02:00")

    def test_output_never_says_closed(self):
        self.assertNotIn("closed", eod.osm_hours_to_app("Mo-Sa 09:00-18:00; Su closed").lower())

    def test_unsupported_syntax_returns_empty(self):
        self.assertEqual(eod.osm_hours_to_app("Jan-Mar Mo-Fr 10:00-18:00"), "")
        self.assertEqual(eod.osm_hours_to_app('Mo-Fr 10:00-18:00 "by appointment"'), "")
        self.assertEqual(eod.osm_hours_to_app("sunrise-sunset"), "")
        self.assertEqual(eod.osm_hours_to_app(""), "")


class MatchingTest(unittest.TestCase):
    def setUp(self):
        self.venues = [
            venue("v1", "001 Cafe Pte. Ltd.", "NE20B84L000", "529653", 1.3523360, 103.9419433),
            venue("v2", "Fish Soup Stall", "TPB0102003", "310210", 1.3402610, 103.8543958),
            venue("v3", "Kopi Corner", "X1", "123456", 1.3000000, 103.8000000, operating_hours="8am - 8pm"),
        ]
        self.matcher = eod.Matcher(self.venues, 0.85, 0.75, 40.0)

    def test_licence_tier(self):
        rec = eod.SourceRecord("datagov", "d:1", "Something Else", licence_no="ne20b84l000")
        match = self.matcher.match(rec)
        self.assertEqual((match.venue.id, match.method, match.confidence), ("v1", "licence", 1.0))

    def test_postal_name_tier(self):
        rec = eod.SourceRecord("osm", "node/1", "001 Cafe", postal_code="529653")
        match = self.matcher.match(rec)
        self.assertEqual((match.venue.id, match.method), ("v1", "postal_name"))

    def test_distance_name_tier(self):
        # ~22 m north of v2, no postcode, slightly different name.
        rec = eod.SourceRecord("osm", "node/2", "Fish Soup", lat=1.3404600, lng=103.8543958)
        match = self.matcher.match(rec)
        self.assertEqual((match.venue.id, match.method), ("v2", "distance_name"))
        self.assertLess(match.confidence, 1.0)

    def test_too_far_or_dissimilar_is_unmatched(self):
        far = eod.SourceRecord("osm", "node/3", "Fish Soup Stall", lat=1.3410000, lng=103.8543958)
        self.assertIsNone(self.matcher.match(far))
        wrong = eod.SourceRecord("osm", "node/4", "Pizza Palace", postal_code="310210", lat=1.3402610, lng=103.8543958)
        self.assertIsNone(self.matcher.match(wrong))

    def test_fill_skips_existing_values_unless_overwrite(self):
        rec = eod.SourceRecord("osm", "node/5", "Kopi Corner", tags={
            "opening_hours": "Mo-Su 07:00-21:00", "phone": "6123 4567", "diet:halal": "yes"})
        fill = eod.osm_fill(rec, self.venues[2], set(), overwrite=False)
        self.assertNotIn("operating_hours", fill)
        self.assertEqual(fill["contact_phone"], "+6561234567")
        self.assertEqual(fill["dietary_tags"], '{"halal"}')
        fill = eod.osm_fill(rec, self.venues[2], set(), overwrite=True)
        self.assertEqual(fill["operating_hours"], "Daily 07:00-21:00")


class OfflineRunTest(unittest.TestCase):
    def test_offline_run_with_cached_overpass_fixture(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            venues_csv = tmp / "venues.csv"
            with venues_csv.open("w", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["id", "name", "licence_no", "postal_code", "latitude", "longitude",
                                 "hygiene_grade", *eod.FIELDS])
                writer.writerow(["v1", "001 Cafe Pte. Ltd.", "NE1", "529653", "1.352336", "103.941943", "A",
                                 "", "", "", "{}", ""])
            fixture = {"osm3s": {"timestamp_osm_base": "2026-10-18T00:00:00Z"}, "elements": [
                {"type": "node", "id": 1, "lat": 1.352336, "lon": 103.941943, "tags": {
                    "name": "001 Cafe", "addr:postcode": "529653", "opening_hours": "Mo-Fr 08:00-20:00",
                    "website": "001cafe.sg", "cuisine": "coffee_shop"}},
                {"type": "node", "id": 2, "lat": 1.30, "lon": 103.80, "tags": {"name": "New Place", "amenity": "cafe"}},
            ]}
            http = eod.Http(tmp / "cache", offline=True)
            key = __import__("hashlib").sha256(("overpass|" + eod.overpass_query()).encode()).hexdigest()
            (tmp / "cache" / "overpass").mkdir(parents=True)
            (tmp / "cache" / "overpass" / f"{key}.bin").write_text(json.dumps(fixture))
            del http
            out = tmp / "out"
            rc = eod.main(["--sources", "osm", "--venues", str(venues_csv), "--out", str(out),
                           "--cache", str(tmp / "cache"), "--offline"])
            self.assertEqual(rc, 0)
            rows = list(csv.DictReader((out / "venue_enrichment.csv").open()))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["operating_hours"], "Mon-Fri 08:00-20:00")
            self.assertEqual(rows[0]["website_url"], "https://001cafe.sg/")
            self.assertEqual(rows[0]["match_method"], "postal_name")
            unmatched = list(csv.DictReader((out / "unmatched_osm.csv").open()))
            self.assertEqual([u["name"] for u in unmatched], ["New Place"])
            sql = (out / "apply_enrichment.sql").read_text()
            self.assertIn("\\if :commit", sql)
            self.assertNotIn("hygiene_grade =", sql)


class MultiSourceTest(unittest.TestCase):
    VOCAB = {"chinese", "japanese", "coffee_shop"}

    def test_overture_row_conversion(self):
        row = {"id": "ov-1", "name": "Ah Seng Chicken Rice", "hierarchy": ["food_and_drink", "restaurant",
               "asian_restaurant", "chinese_restaurant"], "alternates": [], "categories_primary": "chinese_restaurant",
               "websites": ["http://www.facebook.com/ahseng", "ahseng.sg"], "phones": ["+6561234567"],
               "socials": [], "addresses": [{"postcode": "310210", "country": "SG"}], "confidence": 0.9,
               "sources": [{"license": "CDLA-Permissive-2.0"}], "lat": 1.34, "lng": 103.85}
        rec = eod.overture_row_to_record(row, self.VOCAB, "2026-09-23.1")
        self.assertEqual(rec.fields["website_url"], "https://ahseng.sg/")
        self.assertEqual(rec.fields["contact_phone"], "+6561234567")
        self.assertEqual(rec.fields["cuisine_tags"], '{"chinese"}')
        self.assertEqual(rec.postal_code, "310210")
        self.assertIn("CDLA-Permissive-2.0", rec.licence)
        self.assertIsNone(eod.overture_row_to_record({**row, "addresses": [{"country": "MY"}]}, self.VOCAB, "r"))

    def test_foursquare_row_conversion(self):
        row = {"fsq_place_id": "fsq-1", "name": "Sushi Go", "latitude": 1.3, "longitude": 103.8,
               "postcode": "238801", "country": "SG", "tel": "6333 4444", "website": "sushigo.sg",
               "fsq_category_labels": ["Dining and Drinking > Restaurant > Asian Restaurant > Japanese Restaurant"],
               "date_closed": None}
        rec = eod.fsq_row_to_record(row, self.VOCAB, "2026-10-01")
        self.assertEqual(rec.fields["cuisine_tags"], '{"japanese"}')
        self.assertEqual(rec.fields["contact_phone"], "+6563334444")
        self.assertEqual(rec.licence, eod.FSQ_LICENCE)
        self.assertIsNone(eod.fsq_row_to_record({**row, "date_closed": "2025-01-01"}, self.VOCAB, "r"))

    def test_priority_merge_and_provenance(self):
        v = venue("v1", "Ah Seng")
        def cand(src, fields):
            rec = eod.SourceRecord(src, f"{src}-1", "Ah Seng", licence=f"{src}-licence", fetched_at="t")
            return (eod.Match(v, "postal_name", 0.9), rec, fields)
        candidates = {"v1": {
            "foursquare": cand("foursquare", {"website_url": "https://fsq.sg/", "contact_phone": "+6560000001"}),
            "overture": cand("overture", {"website_url": "https://ov.sg/", "cuisine_tags": '{"chinese"}'}),
            "osm": cand("osm", {"website_url": "https://osm.sg/", "dietary_tags": '{"halal"}'}),
        }}
        rows, won = eod.merge_candidates(candidates, list(eod.DEFAULT_PRIORITY))
        row = rows[0]
        self.assertEqual((row["website_url"], row["website_url_source"]), ("https://osm.sg/", "osm"))
        self.assertEqual((row["cuisine_tags"], row["cuisine_source"]), ('{"chinese"}', "overture"))
        self.assertEqual((row["contact_phone"], row["contact_phone_source"]), ("+6560000001", "foursquare"))
        self.assertEqual(row["contact_phone_licence"], "foursquare-licence")
        self.assertEqual(row["dietary_source"], "osm")
        self.assertEqual(row["source"], "osm;overture;foursquare")
        rows, _ = eod.merge_candidates(candidates, ["foursquare", "overture", "osm", "datagov"])
        self.assertEqual(rows[0]["website_url_source"], "foursquare")

    def test_foursquare_skips_without_token(self):
        with tempfile.TemporaryDirectory() as tmp:
            saved = {k: eod.os.environ.pop(k) for k in eod.FSQ_TOKEN_ENV if k in eod.os.environ}
            try:
                log = []
                records, _ = eod.fetch_foursquare(eod.Http(Path(tmp), offline=True), set(), log)
            finally:
                eod.os.environ.update(saved)
            self.assertEqual(records, [])
            self.assertIn("gated", log[0])
            self.assertIn("HF_TOKEN", log[0])

    def test_offline_overture_from_cached_extract(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp) / "overture"
            cache.mkdir()
            (cache / "places-2026-09-23.1.json").write_text(json.dumps([
                {"id": "a", "name": "Kopi Place", "hierarchy": ["food_and_drink", "cafe"], "websites": None,
                 "phones": ["62223333"], "addresses": [{"country": "SG"}], "confidence": 0.8, "lat": 1.3, "lng": 103.8},
                {"id": "b", "name": "Low Conf", "hierarchy": ["food_and_drink"], "confidence": 0.2, "lat": 1.3, "lng": 103.8},
            ]))
            log = []
            records, release = eod.fetch_overture(eod.Http(Path(tmp), offline=True), set(), 0.5, log)
            self.assertEqual(release, "2026-09-23.1")
            self.assertEqual([r.source_id for r in records], ["a"])


if __name__ == "__main__":
    unittest.main()
