import assert from "node:assert/strict";
import test from "node:test";

import type { RecommendationSlateRequest } from "@/lib/services/types";
import type { DishDetail, TasteVector } from "@/types/domain";

import {
  MORE_LIKE_THIS_RADIUS_METERS,
  loadMoreLikeThis,
  loadSimilarStalls,
  moreLikeThisRequest,
  pickMoreLikeThis,
  pickSimilarStalls,
} from "./moreLikeThis";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const SPICY: TasteVector = { ...NEUTRAL, spicy: 9, rich: 7 };
const POINT = { latitude: 1.3, longitude: 103.8 };

const dish = (
  id: string,
  venueId: string,
  name: string,
  tasteVector: TasteVector = SPICY,
  tasteConfidence = 0.3,
) => ({ id, venueId, name, tasteVector, tasteConfidence }) as unknown as DishDetail;

const LAKSA = dish("laksa", "v1", "Curry Laksa");

test("the lookup ranks by the dish's own taste around the stall, and skips unknown taste", () => {
  const request = moreLikeThisRequest(LAKSA, POINT, ["halal"]);
  assert.ok(request);
  assert.deepEqual(request.tasteProfile, SPICY);
  assert.equal(request.radiusMeters, MORE_LIKE_THIS_RADIUS_METERS);
  assert.deepEqual(request.excludeDishIds, ["laksa"]);
  assert.deepEqual(request.dietaryFlags, ["halal"]);
  assert.equal(moreLikeThisRequest(LAKSA, undefined), undefined);
  assert.equal(moreLikeThisRequest(dish("x", "v1", "Rice", NEUTRAL), POINT), undefined);
  assert.equal(moreLikeThisRequest(dish("x", "v1", "Rice", SPICY, 0), POINT), undefined);
});

test("More like this keeps one dish per other stall and never the same dish by name", () => {
  const picks = pickMoreLikeThis(
    [
      dish("own", "v1", "Mee Siam"),
      dish("copy", "v2", "Curry Laksa (Large)"),
      dish("a", "v3", "Mee Siam"),
      dish("b", "v3", "Mee Rebus"),
      dish("c", "v4", "Plain Rice", NEUTRAL),
      dish("d", "v5", "Nasi Lemak"),
      dish("e", "v6", "Mee Goreng"),
    ],
    LAKSA,
    { excludeDishIds: new Set(["e"]) },
  );
  assert.deepEqual(
    picks.map((p) => p.id),
    ["a", "d"],
  );
});

test("Similar stalls keep one dish per stall, leave out this stall, and stop at the limit", () => {
  const picks = pickSimilarStalls(
    [dish("a", "v1", "A"), dish("b", "v2", "B"), dish("c", "v2", "C"), dish("d", "v3", "D")],
    "v1",
    1,
  );
  assert.deepEqual(
    picks.map((p) => p.id),
    ["b"],
  );
});

test("loaders read one slate and pick from it", async () => {
  const requests: RecommendationSlateRequest[] = [];
  const service = {
    getSlate: async (request: RecommendationSlateRequest) => {
      requests.push(request);
      return {
        items: [dish("a", "v2", "Mee Siam"), dish("b", "v3", "Nasi Lemak")].map((d) => ({
          dish: d,
        })),
      } as never;
    },
  };
  const more = await loadMoreLikeThis(service, LAKSA, POINT);
  assert.deepEqual(
    more.map((d) => d.id),
    ["a", "b"],
  );
  const stalls = await loadSimilarStalls(service, dish("x", "v2", "Rojak"), POINT);
  assert.deepEqual(
    stalls.map((d) => d.id),
    ["b"],
  );
  assert.equal(requests.length, 2);
  assert.deepEqual(await loadMoreLikeThis(service, LAKSA, undefined), []);
  assert.equal(requests.length, 2);
});
