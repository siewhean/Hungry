import assert from "node:assert/strict";
import test from "node:test";

import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "./useProfileStore";

test("toggleFavourite updates taste vector and recommendation signals", () => {
  const repository = getDataRepository();
  const dish = repository
    .listPopularNearby()
    .find(
      (candidate) => !useProfileStore.getState().profile.favouriteDishIds.includes(candidate.id),
    );

  assert.ok(dish, "Expected at least one candidate dish for favourite toggling");

  useProfileStore.getState().clearProfile();
  useProfileStore.getState().syncProfile(true);

  const before = useProfileStore.getState().profile;
  useProfileStore.getState().toggleFavourite(dish);
  const after = useProfileStore.getState().profile;

  assert.notDeepEqual(after.tasteVector, before.tasteVector);
  assert.equal(
    after.recommendationSignals?.signalCount,
    (before.recommendationSignals?.signalCount ?? 0) + 1,
  );
});

test("recordReviewEntry applies rating feedback and increments confidence signals", () => {
  const repository = getDataRepository();
  const dish = repository.listPopularNearby()[0];

  assert.ok(dish, "Expected a dish for review-entry signal test");

  useProfileStore.getState().clearProfile();
  useProfileStore.getState().syncProfile(true);

  const before = useProfileStore.getState().profile;
  useProfileStore.getState().recordReviewEntry(dish.id, {
    rating: 5,
    text: "Excellent",
    tags: ["Fragrant"],
  });
  const after = useProfileStore.getState().profile;

  assert.notDeepEqual(after.tasteVector, before.tasteVector);
  assert.equal(
    after.recommendationSignals?.signalCount,
    (before.recommendationSignals?.signalCount ?? 0) + 1,
  );
});
