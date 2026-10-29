import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMapCardDetail,
  formatMapCardDish,
  mapCardAccessibilityLabel,
  shortOpenLabel,
} from "./mapCardText";
import type { CatalogRawVenueCard } from "@/lib/services/catalog";

function card(overrides: Partial<CatalogRawVenueCard> = {}): CatalogRawVenueCard {
  return {
    id: "v1",
    buildingId: "b1",
    name: "Tian Tian",
    menuCount: 3,
    verificationStatus: "verified",
    menuRightsStatus: "licensed",
    mediaRightsStatus: "licensed",
    ...overrides,
  } as CatalogRawVenueCard;
}

test("MD-M6 the dish line is the dish the search matched, with its price", () => {
  const venue = card({
    representativeDish: { id: "d1", name: "Chicken Rice", price: 5.5 } as never,
  });
  assert.equal(formatMapCardDish(venue), "Chicken Rice · S$5.50");
  assert.equal(formatMapCardDish(venue, { name: "Laksa", price: 6 }), "Laksa · S$6.00");
  assert.equal(formatMapCardDish(venue, { name: "Laksa" }), "Laksa", "no price, no S$0.00");
});

test("MD-M8 a stall with no menu has no dish line, not '0 dishes'", () => {
  assert.equal(formatMapCardDish(card({ menuCount: 0 })), undefined);
  assert.equal(formatMapCardDish(card({ menuCount: 12 })), "12 dishes");
});

test("MD-M9 the detail line carries rating, open state, distance and building", () => {
  const venue = card({
    qualityRating: 4.62,
    qualityReviewCount: 23,
    distanceMeters: 450,
    buildingName: "Maxwell Food Centre",
  });
  assert.equal(
    formatMapCardDetail(venue, "Open"),
    "★ 4.6 (23) · Open · 450m · Maxwell Food Centre",
  );
  assert.equal(formatMapCardDetail(card({ distanceMeters: 1250 })), "1.3km");
  assert.equal(
    formatMapCardDetail(card({ qualityRating: 4.5, qualityReviewCount: 0 })),
    "",
    "a rating with no reviews behind it is not shown",
  );
});

test("MD-M9 open state is only said when the hours can be read", () => {
  assert.equal(shortOpenLabel({ status: "open" }), "Open");
  assert.equal(shortOpenLabel({ status: "closed", detail: "Opens 7am" }), "Closed");
  assert.equal(shortOpenLabel({ status: "unknown" }), undefined);
  assert.equal(shortOpenLabel(undefined), undefined);
});

test("MD-M11 a screen reader hears the stall, the dish and the detail", () => {
  const venue = card();
  assert.equal(
    mapCardAccessibilityLabel(venue, "Laksa · S$6.00", "★ 4.6 (23) · Open · 450m"),
    "Open Tian Tian. Laksa · S$6.00. ★ 4.6 (23) · Open · 450m",
  );
  assert.equal(mapCardAccessibilityLabel(venue, undefined, ""), "Open Tian Tian");
});
