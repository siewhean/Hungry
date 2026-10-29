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
  describeResultsSummary,
  effectiveSort,
  effectiveSortLabel,
  isTooShortQuery,
  mergeStallOutlets,
  normalizeQuery,
  parseFilterIds,
  ratingPillText,
  toggleFilterId,
  type StallRow,
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

const stallRow = (row: StallRow) => row;

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

test("typed filters add dietary flags and a price cap to the chips; the lower cap wins (SR4-2)", () => {
  const parsedOnly = buildBrowseRequest({
    query: "laksa",
    filters: [],
    sort: "relevance",
    coordinate,
    parsed: { dietary: ["halal", "pork_free"], maxPrice: 5 },
  });
  assert.deepEqual(parsedOnly.dietaryFlags, ["halal", "pork_free"]);
  assert.equal(parsedOnly.maxPrice, 5);
  // Halal typed and chosen is one flag, and the Under S$6 chip does not raise a typed S$5 cap.
  const both = buildBrowseRequest({
    query: "laksa",
    filters: ["Halal", "Under S$6"],
    sort: "relevance",
    coordinate,
    parsed: { dietary: ["halal"], maxPrice: 5 },
  });
  assert.deepEqual(both.dietaryFlags, ["halal"]);
  assert.equal(both.maxPrice, 5);
  const raised = buildBrowseRequest({
    query: "laksa",
    filters: ["Under S$6"],
    sort: "relevance",
    coordinate,
    parsed: { dietary: [], maxPrice: 9 },
  });
  assert.equal(raised.maxPrice, 6);
  // Filters alone (the whole query was "halal") still browse near the user.
  const filtersOnly = buildBrowseRequest({
    query: "",
    filters: [],
    sort: "relevance",
    coordinate,
    parsed: { dietary: ["halal"] },
  });
  assert.equal(filtersOnly.query, undefined);
  assert.equal(filtersOnly.radiusMeters, 3_000);
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

test("same-name stalls in other buildings stay separate cards (SEARCH-2)", () => {
  const merged = mergeStallOutlets([
    stall("v1", "Chicken Rice", "maxwell"),
    stall("v2", "Chicken Rice", "tiong-bahru"),
    stall("v3", "Drinks Stall", "maxwell"),
    stall("v4", "Drinks Stall", "maxwell"),
    stall("v5", "Chicken Rice (Halal)", "amoy"),
  ]);
  assert.deepEqual(
    merged.map((row) => [row.id, row.extraOutlets]),
    [
      ["v1", 0],
      ["v2", 0],
      ["v3", 0],
      ["v4", 0],
      ["v5", 0],
    ],
  );
});

test("a row repeated across pages merges into one card; a shared logo counts outlets (SEARCH-2)", () => {
  assert.deepEqual(
    mergeStallOutlets([stall("v1", "Ya Kun", "b1"), stall("v1", "Ya Kun", "b1")]).map((row) => [
      row.id,
      row.extraOutlets,
    ]),
    [["v1", 0]],
  );
  const logo = "https://project.supabase.co/storage/v1/object/public/logos/ya-kun.png";
  assert.deepEqual(
    mergeStallOutlets([
      { ...stall("v1", "Ya Kun (Bugis)", "b1"), logoUrl: logo },
      { ...stall("v2", "Ya Kun Raffles", "b2"), logoUrl: logo },
    ]).map((row) => [row.id, row.extraOutlets]),
    [["v1", 1]],
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
  assert.equal(
    cardAccessibilityLabel("stalls", stallRow({ ...stall("1", "Ya Kun", "b1"), extraOutlets: 1 })),
    "Ya Kun, Building b1, 3 dishes, 1 more outlet",
  );
  // SEARCH-10: a stall with a rated top dish reads it out.
  assert.equal(
    cardAccessibilityLabel(
      "stalls",
      stallRow({
        ...stall("1", "Ya Kun", "b1"),
        qualityRating: 4.4,
        qualityReviewCount: 30,
        extraOutlets: 0,
      }),
    ),
    "Ya Kun, Building b1, top dish 4.4 from 30 reviews, 3 dishes",
  );
});

test("the result count line is capped at 100 (search-M3)", () => {
  assert.equal(describeMatchCount(0, "dishes"), "No dishes");
  assert.equal(describeMatchCount(1, "stalls"), "1 stall");
  assert.equal(describeMatchCount(24, "dishes"), "24 dishes");
  assert.equal(describeMatchCount(100, "stalls"), "100+ stalls");
});

test("the sort control names the order the results are really in (SEARCH-X8)", () => {
  assert.equal(effectiveSortLabel("relevance", true), "Best match");
  assert.equal(effectiveSortLabel("relevance", false), "Nearest");
  assert.equal(effectiveSortLabel("relevance", false, true), "Top rated");
  assert.equal(effectiveSortLabel("price", false), "Price: low to high");
});

test("the summary names the place instead of a radius (SEARCH-X2, SEARCH-12)", () => {
  const base = { count: 24, mode: "stalls" as const, hasQuery: false, widened: false };
  assert.equal(describeResultsSummary(base), "24 stalls within 3 km");
  assert.equal(describeResultsSummary({ ...base, widened: true }), "24 stalls in Singapore");
  assert.equal(
    describeResultsSummary({ ...base, placeName: "Maxwell Food Centre" }),
    "24 stalls at Maxwell Food Centre",
  );
  assert.equal(describeResultsSummary({ ...base, hasQuery: true }), "24 stalls");
});

test("a share link keeps the place and the sort (SEARCH-5)", () => {
  const url = new URL(
    buildSearchShareUrl({
      query: "",
      filters: [],
      mode: "stalls",
      place: { id: "maxwell", name: "Maxwell Food Centre" },
      sort: "quality",
    }),
  );
  assert.equal(url.searchParams.get("place"), "maxwell");
  assert.equal(url.searchParams.get("placeName"), "Maxwell Food Centre");
  assert.equal(url.searchParams.get("sort"), "quality");
});

test("cards leave out what they do not know and read singular counts (search-M5)", () => {
  assert.equal(
    cardAccessibilityLabel(
      "dishes",
      dish({ buildingName: undefined, price: undefined, rating: 4, reviewCount: 1 }),
    ),
    "Laksa, Sungei Road Laksa, 4.0 from 1 review, 450 m",
  );
  assert.equal(
    cardAccessibilityLabel("dishes", dish({ distanceMeters: 2400, rating: undefined })),
    "Laksa, Sungei Road Laksa, Bugis Hawker Centre, S$5.00, 2.4 km",
  );
  assert.equal(
    cardAccessibilityLabel(
      "stalls",
      stallRow({
        ...stall("1", "Ya Kun", "b1"),
        menuCount: 1,
        extraOutlets: 2,
        distanceMeters: 80,
      }),
    ),
    "Ya Kun, Building b1, 1 dish, 2 more outlets, 80 m",
  );
  assert.equal(
    cardAccessibilityLabel(
      "stalls",
      stallRow({ ...stall("1", "Ya Kun", "b1"), menuCount: 0, extraOutlets: 0 }),
    ),
    "Ya Kun, Building b1",
  );
  const noBuilding = { ...stall("1", "Ya Kun", "b1"), buildingName: undefined };
  assert.equal(
    cardSubtitle("stalls", {
      ...noBuilding,
      representativeDish: { name: "Kaya toast" },
    } as CatalogRawVenueCard),
    "Kaya toast",
  );
  assert.equal(cardSubtitle("stalls", noBuilding), "");
  assert.equal(cardSubtitle("stalls", stall("1", "Ya Kun", "b1")), "Building b1");
});

test("a stall seen in a second building counts one more outlet only once", () => {
  const logo = "https://project.supabase.co/storage/v1/object/public/logos/ya-kun.png";
  const rows = mergeStallOutlets([
    { ...stall("v1", "Ya Kun", "b1"), logoUrl: logo },
    { ...stall("v2", "Ya Kun", "b2"), logoUrl: logo },
    { ...stall("v3", "Ya Kun", "b2"), logoUrl: logo },
    { ...stall("v4", "Ya Kun", "b1"), logoUrl: logo },
  ]);
  assert.deepEqual(
    rows.map((row) => [row.id, row.extraOutlets]),
    [["v1", 1]],
  );
});
