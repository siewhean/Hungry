import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGrabDirectoryCandidates,
  matchGrabCandidates,
  nameSimilarity,
  normalizeGrabUrl,
} from "./lib/grab-directory-discovery.mjs";

test("extracts nested Grab candidates with postal evidence", () => {
  const payload = { props: { merchants: [{ merchantName: "Acme Noodles", fullAddress: "1 Test Road Singapore 123456", merchantUrl: "https://food.grab.com/sg/en/restaurant/acme?utm_source=test" }] } };
  assert.deepEqual(extractGrabDirectoryCandidates(payload), [{
    name: "Acme Noodles",
    address: "1 Test Road Singapore 123456",
    postalCode: "123456",
    url: "https://food.grab.com/sg/en/restaurant/acme",
    source: "grab_directory_payload",
  }]);
});

test("approves only exact-postal, high-confidence, unambiguous venue matches", () => {
  const venues = [
    { id: "v1", name: "Acme Noodles - Test Mall", address: "1 Test Road 123456", postal_code: "123456", menu_source_url: null },
    { id: "v2", name: "Acme Noodles", address: "2 Other Road 654321", postal_code: "654321", menu_source_url: null },
  ];
  const candidates = [{ name: "Acme Noodles Test Mall", address: "1 Test Road 123456", postalCode: "123456", url: "https://food.grab.com/sg/en/restaurant/acme" }];
  const result = matchGrabCandidates(venues, candidates);
  assert.equal(result[0].status, "approved");
  assert.equal(result[1].status, "manual_review");
  assert.equal(result[1].reason, "postal_mismatch_or_missing");
});

test("rejects non-Grab hosts and gives related names a positive score", () => {
  assert.equal(normalizeGrabUrl("https://example.com/merchant"), null);
  assert.equal(normalizeGrabUrl("https://food.grab.com/sg/en/restaurants?search=acme"), null);
  assert.equal(normalizeGrabUrl("https://www.grab.com/sg/merchant/food/"), null);
  assert.ok(nameSimilarity("Acme Noodles", "Acme Noodles - Test Mall") >= 0.7);
});
