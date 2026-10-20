import assert from "node:assert/strict";
import test from "node:test";

import type { DishSummary, FoodOpenness, TasteVector } from "@/types/domain";
import {
  BUCKET_SHARES,
  OPENNESS_NEOPHILIA_INDEX,
  allocateByBuckets,
  assignBucket,
  bucketSlotsFor,
  buildLikedProfile,
  mixByFoodHistory,
  neophiliaToOpenness,
  resolveFoodOpenness,
} from "./exploration";
import { applyAffinityEvent, buildFoodHistory } from "./foodHistory";
import { runRecommendationPipeline } from "./tasteEngine";

const BASE: TasteVector = { sweet: 3, spicy: 3, sour: 3, salty: 6, rich: 6, aromatic: 6 };
const FAR: TasteVector = { sweet: 10, spicy: 0, sour: 10, salty: 0, rich: 0, aromatic: 0 };

function dish(
  id: string,
  options: Partial<DishSummary> & { foodTypeTag?: string } = {},
): DishSummary {
  return {
    id,
    venueId: options.venueId ?? `venue-${id}`,
    buildingId: "b1",
    venueName: id,
    unitNumber: "",
    floor: "",
    name: id,
    imageUrl: "",
    distanceMeters: 100,
    rating: 4,
    reviewCount: 1,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: BASE,
    dietaryFlags: [],
    ...options,
  };
}

const liked = dish("liked", { foodTypeTag: "Chicken Rice", venueId: "v-home" });
const historyRows = [
  applyAffinityEvent(undefined, {
    dishId: liked.id,
    signal: "favourite",
    foodType: liked.foodTypeTag,
    venueId: liked.venueId,
  }),
];
const history = buildFoodHistory(historyRows);
const likedProfile = buildLikedProfile([liked]);

test("bucket shares sum to the slate size for every openness", () => {
  for (const openness of Object.keys(BUCKET_SHARES) as FoodOpenness[]) {
    const shares = BUCKET_SHARES[openness];
    assert.ok(Math.abs(Object.values(shares).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    for (const limit of [1, 5, 7, 20]) {
      const slots = bucketSlotsFor(openness, limit);
      assert.equal(
        Object.values(slots).reduce((a, b) => a + b, 0),
        limit,
      );
    }
  }
  assert.deepEqual(bucketSlotsFor("favourites", 20), {
    repeat: 8,
    same_type: 7,
    similar: 4,
    new: 1,
  });
  assert.deepEqual(bucketSlotsFor("mix", 20), { repeat: 4, same_type: 6, similar: 6, new: 4 });
  assert.deepEqual(bucketSlotsFor("adventurous", 20), {
    repeat: 2,
    same_type: 4,
    similar: 8,
    new: 6,
  });
});

test("openness maps to neophiliaIndex and back; foodOpenness wins over the index", () => {
  for (const openness of Object.keys(OPENNESS_NEOPHILIA_INDEX) as FoodOpenness[]) {
    assert.equal(neophiliaToOpenness(OPENNESS_NEOPHILIA_INDEX[openness]), openness);
  }
  assert.equal(
    resolveFoodOpenness({ neophiliaIndex: 9, foodOpenness: "favourites" }),
    "favourites",
  );
  assert.equal(resolveFoodOpenness({ neophiliaIndex: 9 }), "adventurous");
  assert.equal(resolveFoodOpenness(undefined), "mix");
});

test("assignBucket: repeat, same food elsewhere, similar flavour, new", () => {
  assert.equal(assignBucket(liked, history, likedProfile), "repeat");
  assert.equal(
    assignBucket(dish("other-cr", { foodTypeTag: "chicken rice" }), history, likedProfile),
    "same_type",
  );
  // Same food at the same stall is not another vendor to compare.
  assert.equal(
    assignBucket(
      dish("same-stall", { foodTypeTag: "chicken rice", venueId: "v-home" }),
      history,
      likedProfile,
    ),
    "similar",
  );
  assert.equal(
    assignBucket(dish("close", { foodTypeTag: "laksa" }), history, likedProfile),
    "similar",
  );
  assert.equal(
    assignBucket(dish("far", { foodTypeTag: "laksa", tasteVector: FAR }), history, likedProfile),
    "new",
  );
  // An untagged (neutral) dish has no flavour signal, so it is not "similar".
  assert.equal(
    assignBucket(
      dish("neutral", {
        tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
      }),
      history,
      likedProfile,
    ),
    "new",
  );
});

function pool() {
  const items: DishSummary[] = [liked];
  for (let index = 0; index < 10; index += 1) {
    items.push(
      dish(`same-${index}`, { foodTypeTag: index % 2 ? "chicken rice" : `roast-${index}` }),
    );
    items.push(dish(`new-${index}`, { foodTypeTag: `new-${index}`, tasteVector: FAR }));
  }
  return items;
}

test("favourites gets more familiar food than adventurous; dismissed dishes never show", () => {
  const likedTypes = ["chicken rice", "laksa", "char kway teow", "nasi lemak"];
  const likedDishes = likedTypes.map((type, index) =>
    dish(`liked-${index}`, { foodTypeTag: type, venueId: `home-${index}` }),
  );
  const rows = likedDishes.map((item) =>
    applyAffinityEvent(undefined, {
      dishId: item.id,
      signal: "favourite",
      foodType: item.foodTypeTag,
      venueId: item.venueId,
    }),
  );
  const richHistory = buildFoodHistory(rows);
  const profile = buildLikedProfile(likedDishes);
  const items: DishSummary[] = [...likedDishes];
  for (let index = 0; index < 15; index += 1) {
    items.push(dish(`same-${index}`, { foodTypeTag: likedTypes[index % 4] }));
    items.push(dish(`similar-${index}`, { foodTypeTag: `other-${index}` }));
    items.push(dish(`new-${index}`, { foodTypeTag: `new-${index}`, tasteVector: FAR }));
  }
  const ranked = items.map((item) => ({ dish: item }));
  const count = (openness: FoodOpenness) =>
    allocateByBuckets(ranked, { openness, history: richHistory, liked: profile }).reduce<
      Record<string, number>
    >((counts, item) => ({ ...counts, [item.bucket]: (counts[item.bucket] ?? 0) + 1 }), {});
  const favourites = count("favourites");
  const adventurous = count("adventurous");
  assert.equal(favourites.new, 1);
  assert.equal(adventurous.new, 6);
  assert.ok(
    (favourites.repeat ?? 0) + (favourites.same_type ?? 0) >
      (adventurous.repeat ?? 0) + (adventurous.same_type ?? 0),
  );
  // Food type cap: at most 3 dishes of one food type in a slate.
  const slate = allocateByBuckets(ranked, {
    openness: "favourites",
    history: richHistory,
    liked: profile,
  });
  for (const type of likedTypes) {
    assert.ok(slate.filter((item) => item.dish.foodTypeTag === type).length <= 3, type);
  }

  const dismissed = buildFoodHistory([
    ...rows,
    applyAffinityEvent(undefined, { dishId: "new-0", signal: "dismissed" }),
  ]);
  const hidden = allocateByBuckets(ranked, {
    openness: "adventurous",
    history: dismissed,
    liked: profile,
  });
  assert.ok(!hidden.some((item) => item.dish.id === "new-0"));
});

test("interleave never bunches more than 3 familiar dishes in any 5", () => {
  const items: DishSummary[] = [];
  const rows = [];
  for (let index = 0; index < 12; index += 1) {
    const repeat = dish(`r-${index}`, { foodTypeTag: `t-${index}` });
    items.push(repeat, dish(`n-${index}`, { foodTypeTag: `n-${index}`, tasteVector: FAR }));
    rows.push(
      applyAffinityEvent(undefined, {
        dishId: repeat.id,
        signal: "favourite",
        foodType: repeat.foodTypeTag,
        venueId: repeat.venueId,
      }),
    );
  }
  const slate = allocateByBuckets(
    items.map((item) => ({ dish: item })),
    { openness: "favourites", history: buildFoodHistory(rows), liked: buildLikedProfile([]) },
  );
  for (let start = 0; start + 5 <= slate.length; start += 1) {
    const repeats = slate.slice(start, start + 5).filter((item) => item.bucket === "repeat").length;
    assert.ok(repeats <= 3, `window at ${start} has ${repeats} repeats`);
  }
});

test("mixByFoodHistory keeps every dish and only drops dismissals", () => {
  const items = pool();
  const mixed = mixByFoodHistory(items, {
    history,
    openness: "mix",
    lookup: (dishId) => items.find((item) => item.id === dishId),
  });
  assert.equal(mixed.length, items.length);
  assert.deepEqual(new Set(mixed.map((item) => item.id)), new Set(items.map((item) => item.id)));
  assert.equal(
    mixByFoodHistory(items, { history: undefined, openness: "mix", lookup: () => undefined }),
    items,
  );
});

test("pipeline: no history keeps the legacy result; with history results carry buckets", () => {
  const items = pool();
  const ctx = {
    userVector: BASE,
    dietaryFlags: [],
    neophiliaIndex: 5,
    radiusMeters: Number.MAX_SAFE_INTEGER,
  };
  const legacy = runRecommendationPipeline(items, ctx);
  const emptyHistory = runRecommendationPipeline(items, { ...ctx, history: buildFoodHistory([]) });
  assert.deepEqual(emptyHistory, legacy);
  assert.ok(legacy.every((result) => result.bucket === undefined));

  // Each dish leads on its own taste axis so diversification (2 per axis) keeps them all.
  const axes: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];
  const spread = axes.map((axis, index) =>
    dish(index === 0 ? liked.id : `axis-${axis}`, {
      foodTypeTag: index === 0 ? liked.foodTypeTag : index === 1 ? "chicken rice" : `type-${axis}`,
      venueId: index === 0 ? liked.venueId : `v-${axis}`,
      tasteVector: { ...BASE, sweet: 3, salty: 4, rich: 4, aromatic: 4, [axis]: 7 },
    }),
  );
  const personalised = runRecommendationPipeline(spread, {
    ...ctx,
    history,
    openness: "favourites",
  });
  assert.equal(personalised.length, spread.length);
  assert.ok(personalised.every((result) => result.bucket));
  assert.equal(personalised.find((result) => result.dishId === liked.id)?.bucket, "repeat");
  assert.equal(personalised.find((result) => result.dishId === "axis-spicy")?.bucket, "same_type");
  for (const result of personalised) {
    assert.equal(result.isSerendipitous, result.bucket === "new");
  }
});
