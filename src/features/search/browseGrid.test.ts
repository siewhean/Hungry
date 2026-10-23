import assert from "node:assert/strict";
import test from "node:test";

import { parseSearchDeepLinkQuery } from "@/app/navigation/linking";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";
import type { CatalogRawDishCard, CatalogRawVenueCard } from "@/lib/services/catalog";
import {
  buildBrowseRequest,
  buildSearchShareUrl,
  cardAccessibilityLabel,
  cardSubtitle,
  describeMatchCount,
  effectiveSort,
  isTooShortQuery,
  mergeStallOutlets,
  normalizeQuery,
  parseFilterIds,
  ratingPillText,
  toggleFilterId,
} from "./browseGrid";

const coordinate = { latitude: 1.28, longitude: 103.85 };

function stall(id: string, name: string, buildingId: string): CatalogRawVenueCard {
  return {
    id,
    buildingId,
    name,
    buildingName: `Building ${buildingId}`,
    menuCount: 3,
    verificationStatus: "raw",
    menuRightsStatus: "unverified",
    mediaRightsStatus: "unverified",
  };
}

function dish(overrides: Partial<CatalogRawDishCard> = {}): CatalogRawDishCard {
  return {
    id: "d1",
    venueId: "v1",
    buildingId: "b1",
    name: "Laksa",
    venueName: "Sungei Road Laksa",
    buildingName: "Bugis Hawker Centre",
    price: 5,
    distanceMeters: 450,
    rating: 4.5,
    reviewCount: 120,
    cuisineTags: [],
    dietaryFlags: [],
    sectionTags: [],
    verificationStatus: "raw",
    menuRightsStatus: "unverified",
    mediaRightsStatus: "unverified",
    ...overrides,
  };
}

test("filter chips combine, toggle off and clear with All (search-M3)", () => {
  assert.deepEqual(parseFilterIds("Halal,rice"), ["Halal", "Rice"]);
  let selected = toggleFilterId([], "Halal");
  selected = toggleFilterId(selected, "Under S$6");
  assert.deepEqual(selected, ["Halal", "Under S$6"]);
  assert.deepEqual(toggleFilterId(selected, "Halal"), ["Under S$6"]);
  assert.deepEqual(toggleFilterId(selected, "All"), []);
  assert.deepEqual(toggleFilterId(selected, "Spicy"), selected, "unknown ids change nothing");
});

test("only real chips are accepted from links; Local and Spicy fall away (search-L5)", () => {
  assert.deepEqual(parseFilterIds("Local"), []);
  assert.deepEqual(parseFilterIds("Spicy,Noodles"), ["Noodles"]);
  assert.deepEqual(parseSearchDeepLinkQuery("search?filter=Under%20S%246&mode=stalls"), {
    initialFilter: "Under S$6",
    browseMode: "stalls",
  });
  assert.deepEqual(parseSearchDeepLinkQuery("search?filter=Halal,Rice"), {
    initialFilter: "Halal,Rice",
  });
  assert.deepEqual(parseSearchDeepLinkQuery("search?filter=Local"), {});
});

test("a share link round-trips through the link parser (search-L5)", () => {
  const url = buildSearchShareUrl({
    query: "chicken rice",
    filters: ["Halal", "Under S$6"],
    mode: "stalls",
  });
  assert.match(url, /^https:\/\/usehungry\.com\/search\?/);
  const parsed = parseSearchDeepLinkQuery(url.slice(url.indexOf("search")));
  assert.deepEqual(parsed, {
    initialQuery: "chicken rice",
    initialFilter: "Halal,Under S$6",
    browseMode: "stalls",
  });
});

test("the request maps chips to RPC filters; Noodles and Rice use food keywords (search-M11)", () => {
  const request = buildBrowseRequest({
    query: "",
    filters: ["Halal", "Under S$6", "Japanese", "Noodles", "Rice"],
    sort: "relevance",
    coordinate,
  });
  assert.deepEqual(request.dietaryFlags, ["halal"]);
  assert.deepEqual(request.cuisineTags, ["japanese"]);
  assert.equal(request.maxPrice, 6);
  assert.ok(request.foodKeywords?.includes("noodle"));
  assert.ok(request.foodKeywords?.includes("rice"));
  assert.equal(request.radiusMeters, 3_000, "browsing without text is radius-bound");
  assert.equal(request.sort, "nearby", "best match needs text, so it falls back to nearest");
  assert.equal(request.query, undefined);
});

test("typed text searches everywhere, keeps the release only for next pages (search-M1)", () => {
  const first = buildBrowseRequest({
    query: "laksa",
    filters: [],
    sort: "relevance",
    coordinate,
    releaseId: "rel-1",
  });
  assert.equal(first.radiusMeters, undefined);
  assert.equal(first.sort, "relevance");
  assert.equal(first.releaseId, undefined);
  const next = buildBrowseRequest({
    query: "laksa",
    filters: [],
    sort: "price",
    coordinate,
    cursor: "abc",
    releaseId: "rel-1",
  });
  assert.equal(next.releaseId, "rel-1");
  assert.equal(next.sort, "price");
  assert.equal(effectiveSort("quality", false), "quality");
});

test("one-character queries are not searched and long ones are capped (search-M1, L2)", () => {
  assert.equal(isTooShortQuery("r"), true);
  assert.equal(isTooShortQuery(""), false);
  assert.equal(isTooShortQuery("ri"), false);
  assert.equal(normalizeQuery("x".repeat(200)).length, 80);
  assert.equal(normalizeQuery("  chicken   rice  "), "chicken rice");
});

test("the search sanitiser keeps real words and only drops markup (search-L1)", () => {
  assert.equal(sanitizeSearchQuery("Union Farm Chicken Rice"), "Union Farm Chicken Rice");
  assert.equal(sanitizeSearchQuery("select update exec"), "select update exec");
  assert.equal(sanitizeSearchQuery("Ah <b>Seng</b> Laksa"), "Ah Seng Laksa");
  assert.equal(sanitizeSearchQuery("<script>alert(1)</script>mee"), "alert(1)mee");
  assert.equal(sanitizeSearchQuery("a".repeat(300), 80).length, 80);
});

test("chain outlets and duplicate records merge into one stall card (search-M7)", () => {
  const merged = mergeStallOutlets([
    stall("1", "Ya Kun Kaya Toast (Bugis)", "b1"),
    stall("2", "Ah Seng Laksa", "b1"),
    stall("3", "Ya Kun Kaya Toast (Raffles)", "b2"),
    stall("4", "Ya Kun Kaya Toast - Orchard", "b3"),
    stall("5", "Ah Seng Laksa", "b1"),
    stall("6", "Ah Seng Laksa", "b9"),
  ]);
  assert.deepEqual(
    merged.map((row) => [row.id, row.extraOutlets]),
    [
      ["1", 2],
      ["2", 1],
    ],
    "the best-ranked card stays; the same building twice is a duplicate, not an outlet",
  );
});

test("dish cards read out stall, hawker centre, price, rating and distance (search-M5, M6)", () => {
  const card = dish();
  assert.equal(
    cardAccessibilityLabel("dishes", card),
    "Laksa, Sungei Road Laksa, Bugis Hawker Centre, S$5.00, 4.5 from 120 reviews, 450 m",
  );
  assert.equal(cardSubtitle("dishes", card), "Sungei Road Laksa · Bugis Hawker Centre");
  assert.equal(cardSubtitle("dishes", dish({ buildingName: undefined })), "Sungei Road Laksa");
  assert.equal(ratingPillText(4.5, 120), "4.5 (120)");
  assert.equal(ratingPillText(0, 0), undefined, "no rating, no pill");
  assert.equal(ratingPillText(4, 0), undefined, "a rating without reviews is not shown");
  const merged = mergeStallOutlets([stall("1", "Ya Kun", "b1"), stall("2", "Ya Kun", "b2")]);
  assert.equal(
    cardAccessibilityLabel("stalls", merged[0]),
    "Ya Kun, Building b1, 3 dishes, 1 more outlet",
  );
});

test("the result count line is capped at 100 (search-M3)", () => {
  assert.equal(describeMatchCount(0, "dishes"), "No dishes");
  assert.equal(describeMatchCount(1, "stalls"), "1 stall");
  assert.equal(describeMatchCount(24, "dishes"), "24 dishes");
  assert.equal(describeMatchCount(100, "stalls"), "100+ stalls");
});
