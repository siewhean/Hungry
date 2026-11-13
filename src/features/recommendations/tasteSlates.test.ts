import assert from "node:assert/strict";
import test from "node:test";

import type { RankedRecommendation, RecommendationSlateRequest } from "@/lib/services/types";
import type { DishDetail, TasteVector } from "@/types/domain";

import {
  TASTE_SEARCH_RADIUS_METERS,
  WORTH_THE_TRIP_RADIUS_METERS,
  loadTasteSearch,
  loadWorthTheTrip,
  pickTasteSearch,
  pickWorthTheTrip,
} from "./tasteSlates";

const PALATE: TasteVector = { sweet: 4, spicy: 8, sour: 5, salty: 6, rich: 7, aromatic: 6 };
const TAGGED: TasteVector = { sweet: 3, spicy: 8, sour: 4, salty: 6, rich: 8, aromatic: 6 };
const POINT = { latitude: 1.3, longitude: 103.8 };

function item(
  id: string,
  venueId: string,
  options: { rating?: number; reviews?: number; confidence?: number; match?: number } = {},
): RankedRecommendation {
  const dish = {
    id,
    venueId,
    name: id,
    rating: options.rating ?? 0,
    reviewCount: options.reviews ?? 0,
    tasteVector: TAGGED,
    tasteConfidence: options.confidence ?? 0.3,
  } as unknown as DishDetail;
  return {
    dish,
    matchScore: 0,
    matchPercent: options.match ?? 70,
    matchReason: "",
    isSerendipitous: false,
  };
}

test("Worth the trip keeps well-reviewed or strongly matched dishes beyond the nearby stalls", () => {
  const picks = pickWorthTheTrip(
    [
      item("near", "v-near", { rating: 4.8, reviews: 20 }),
      item("reviewed", "v1", { rating: 4.5, reviews: 5 }),
      item("same-stall", "v1", { rating: 4.9, reviews: 9 }),
      item("thin", "v2", { rating: 4.9, reviews: 1 }),
      item("estimate-match", "v3", { match: 95 }),
      item("verified-match", "v4", { confidence: 0.9, match: 85 }),
    ],
    new Set(["v-near"]),
  );
  assert.deepEqual(
    picks.map((dish) => dish.id),
    ["reviewed", "verified-match"],
  );
});

test("search by taste keeps dishes that fit the palate, one per stall", () => {
  const picks = pickTasteSearch([
    item("a", "v1", { match: 90 }),
    item("b", "v1", { match: 88 }),
    item("c", "v2", { match: 40 }),
    item("d", "v3", { match: 65 }),
  ]);
  assert.deepEqual(
    picks.map((dish) => dish.id),
    ["a", "d"],
  );
});

test("loaders send the palate, radius and query to one slate read", async () => {
  const requests: RecommendationSlateRequest[] = [];
  const service = {
    getSlate: async (request: RecommendationSlateRequest) => {
      requests.push(request);
      return { surface: request.surface, generatedAt: "", items: [item("a", "v1", { match: 90 })] };
    },
  };
  assert.deepEqual(await loadWorthTheTrip(service, PALATE, POINT, new Set()), []);
  const search = await loadTasteSearch(service, PALATE, "laksa", POINT, ["halal"]);
  assert.deepEqual(
    search.map((dish) => dish.id),
    ["a"],
  );
  assert.equal(requests[0].radiusMeters, WORTH_THE_TRIP_RADIUS_METERS);
  assert.equal(requests[0].tasteProfile, PALATE);
  assert.equal(requests[0].liveOnly, true);
  assert.equal(requests[1].radiusMeters, TASTE_SEARCH_RADIUS_METERS);
  assert.equal(requests[1].query, "laksa");
  assert.deepEqual(requests[1].dietaryFlags, ["halal"]);
});
