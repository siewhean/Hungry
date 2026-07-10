import assert from "node:assert/strict";
import test from "node:test";
import { rankVenueCandidates, scoreVenueIdentity } from "./venue-identity.mjs";

test("accepts matching brand, outlet, and postal identity", () => {
  const result = scoreVenueIdentity({
    venue: { name: "The Soup Spoon (White Sands)", address: "1 Pasir Ris Central Street 3", postal_code: "518457" },
    candidate: {
      name: "The Soup Spoon - White Sands",
      address: "1 Pasir Ris Central Street 3 Singapore 518457",
      url: "https://food.grab.com/sg/en/restaurant/the-soup-spoon-white-sands-delivery/abc",
    },
  });
  assert.equal(result.band, "accept");
  assert.equal(result.signals.postal, 1);
  assert.equal(result.outletMatched, true);
});

test("rejects a same-brand wrong outlet with a postal mismatch", () => {
  const result = scoreVenueIdentity({
    venue: { name: "Starbucks (Compass One)", address: "1 Sengkang Square", postal_code: "545078" },
    candidate: {
      name: "Starbucks - VivoCity",
      address: "1 HarbourFront Walk Singapore 098585",
      url: "https://food.grab.com/sg/en/restaurant/starbucks-vivocity-delivery/abc",
    },
  });
  assert.equal(result.band, "reject");
  assert.ok(result.hardReasons.includes("postal_mismatch"));
  assert.ok(result.hardReasons.includes("outlet_qualifier_mismatch"));
});

test("ranks an exact outlet above a brand-only candidate", () => {
  const [best] = rankVenueCandidates(
    { name: "KFC (Bugis Junction)", address: "200 Victoria Street", postal_code: "188021" },
    [
      { name: "KFC Singapore", url: "https://foodpanda.sg/restaurant/kfc" },
      { name: "KFC Bugis Junction", address: "200 Victoria Street 188021", url: "https://foodpanda.sg/restaurant/kfc-bugis-junction" },
    ],
  );
  assert.match(best.candidate.url, /bugis-junction/);
  assert.equal(best.band, "accept");
});

test("keeps a name-only chain match out of the accept band", () => {
  const result = scoreVenueIdentity({
    venue: { name: "Starbucks" },
    candidate: { name: "Starbucks", url: "https://food.grab.com/sg/en/restaurant/starbucks-delivery/abc" },
  });
  assert.notEqual(result.band, "accept");
  assert.ok(result.hardReasons.includes("missing_outlet_evidence"));
});

test("accepts exact street-number and street-name evidence from a stored platform URL", () => {
  const result = scoreVenueIdentity({
    venue: {
      name: "STIRLING STEAKS",
      address: "Capitol Singapore, 13 Stamford Road, #B2-53",
      postal_code: "178905",
    },
    candidate: {
      name: "Stirling Steaks - 13 Stamford road",
      url: "https://food.grab.com/sg/en/restaurant/stirling-steaks-13-stamford-road-delivery/example",
    },
  });

  assert.equal(result.band, "accept");
  assert.equal(result.hardReasons.includes("missing_outlet_evidence"), false);
});
