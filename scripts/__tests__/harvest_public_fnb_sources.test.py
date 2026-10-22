import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.harvest_public_fnb_sources import Fetcher, blocked_host, has_credential_query, normalized_host, parse_page


class PublicFnbHarvestTests(unittest.TestCase):
    def test_extracts_first_party_fields_and_menu_items_from_jsonld(self):
        html = '''<html><head><title>Test Cafe</title>
        <script type="application/ld+json">{
          "@context":"https://schema.org","@type":"Restaurant","name":"Test Cafe",
          "servesCuisine":["Singaporean"],"telephone":"+65 6000 0000",
          "address":{"@type":"PostalAddress","streetAddress":"1 Test Road","postalCode":"123456"},
          "openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":"Monday","opens":"09:00","closes":"17:00"}],
          "geo":{"@type":"GeoCoordinates","latitude":1.3,"longitude":103.8},
          "aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"20"},
          "hasMenu":{"@type":"Menu","url":"https://test.example/menu"},
          "hasMenuSection":{"@type":"MenuSection","hasMenuItem":[{"@type":"MenuItem","name":"Laksa","image":"/laksa.jpg","offers":{"@type":"Offer","price":"8.50","priceCurrency":"SGD"}}]}
        }</script></head><body></body></html>'''
        result = parse_page(html, "https://test.example/")
        fields = {item["field"]: item["value"] for item in result["proposals"]}
        self.assertEqual(fields["F&B Name"], "Test Cafe")
        self.assertIn('"opens": "09:00"', fields["Opening Hours / Closed Days"])
        self.assertEqual(fields["Postal Code"], "123456")
        self.assertEqual(fields["Rating / Review Count"], "4.5 / 20")
        self.assertEqual(result["menu_items"][0]["name"], "Laksa")
        self.assertEqual(result["menu_items"][0]["price"], "8.50")
        self.assertEqual(result["menu_items"][0]["image_url"], "https://test.example/laksa.jpg")

    def test_menu_item_without_image_does_not_create_image_candidate(self):
        html = '''<script type="application/ld+json">{
          "@context":"https://schema.org","@type":"MenuItem","name":"Plain Tea",
          "offers":{"@type":"Offer","price":"2.00"}
        }</script>'''
        result = parse_page(html, "https://test.example/menu")
        self.assertEqual(result["menu_items"][0]["name"], "Plain Tea")
        self.assertNotIn("image_url", result["menu_items"][0])
        self.assertEqual(result["image_candidates"], [])

    def test_blocks_google_and_delivery_platform_hosts(self):
        for host in ("maps.google.com", "google.com.sg", "food.grab.com", "www.foodpanda.sg", "eats.oddle.me", "deliveroo.com.sg", "api.mapbox.com", "www.onemap.gov.sg"):
            with self.subTest(host=host):
                self.assertTrue(blocked_host(host))
        self.assertFalse(blocked_host("example-restaurant.sg"))

    def test_blocks_credential_bearing_api_urls(self):
        self.assertTrue(has_credential_query("https://restaurant.example/menu?access_token=secret"))
        self.assertTrue(has_credential_query("https://restaurant.example/menu?key=secret"))
        self.assertFalse(has_credential_query("https://restaurant.example/menu?branch=orchard"))

    def test_network_is_blocked_without_reviewed_host_permission(self):
        fetcher = Fetcher(max_requests=10, delay=1, timeout=2, host_policy={})
        self.assertEqual(fetcher.can_fetch("https://merchant.example.com/menu"), (False, "host has no reviewed collection-permission entry"))
        with self.assertRaises(PermissionError):
            fetcher._request("https://api.mapbox.com/search?q=food")

    def test_host_policy_requires_explicit_free_official_or_open_source(self):
        from scripts.harvest_public_fnb_sources import load_host_policy
        import json
        import tempfile

        valid_entry = {
            "collection_permitted": True,
            "source_class": "official_website",
            "no_request_fee": True,
            "no_cost_basis": "Public HTML pages with no per-request fee.",
            "terms_or_license_url": "https://merchant.example.com/terms",
            "permission_basis": "Reviewed public-site collection terms.",
            "reviewed_at": "2026-10-19",
        }
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "policy.json"
            path.write_text(json.dumps({"hosts": {
                "merchant.example.com": valid_entry,
                "paid-api.example.com": {**valid_entry, "source_class": "paid_api"},
                "unknown-cost.example.com": {**valid_entry, "no_request_fee": False},
                "missing-basis.example.com": {**valid_entry, "no_cost_basis": ""},
            }}), encoding="utf-8")
            policy = load_host_policy(path)
        self.assertEqual(list(policy), ["merchant.example.com"])
        self.assertTrue(policy["merchant.example.com"]["no_request_fee"])

    def test_credential_query_is_blocked_before_network(self):
        policy = {"merchant.example.com": {"source_class": "official_website", "no_request_fee": True, "no_cost_basis": "Public HTML, no request fee", "terms_or_license_url": "https://merchant.example.com/terms", "permission_basis": "Reviewed", "reviewed_at": "2026-10-19"}}
        fetcher = Fetcher(max_requests=10, delay=1, timeout=2, host_policy=policy)
        with self.assertRaisesRegex(PermissionError, "credential-like query"):
            fetcher._request("https://merchant.example.com/menu?access_token=secret")

    def test_only_https_urls_are_accepted(self):
        self.assertEqual(normalized_host("https://www.example.sg/menu"), "www.example.sg")
        self.assertIsNone(normalized_host("http://example.sg/menu"))
        self.assertIsNone(normalized_host("file:///tmp/menu.html"))


if __name__ == "__main__":
    unittest.main()
