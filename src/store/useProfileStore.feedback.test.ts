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

test("recordTasteInteraction applies search and result-click signals", () => {
  const repository = getDataRepository();
  const dish = repository.listPopularNearby()[0];

  assert.ok(dish, "Expected a dish for taste interaction test");

  useProfileStore.getState().clearProfile();
  useProfileStore.getState().syncProfile(true);

  const before = useProfileStore.getState().profile;
  const searchEvent = useProfileStore.getState().recordTasteInteraction({
    type: "search_query",
    surface: "search",
    query: dish.name,
  });
  const afterSearch = useProfileStore.getState().profile;
  const clickEvent = useProfileStore.getState().recordTasteInteraction({
    type: "dish_result_click",
    surface: "search",
    dish,
    query: dish.name,
    buttonId: "search_result",
  });
  const afterClick = useProfileStore.getState().profile;

  assert.equal(searchEvent?.applied, true);
  assert.equal(clickEvent?.applied, true);
  assert.notDeepEqual(afterSearch.tasteVector, before.tasteVector);
  assert.notDeepEqual(afterClick.tasteVector, afterSearch.tasteVector);
  assert.equal(
    afterClick.recommendationSignals?.signalCount,
    (before.recommendationSignals?.signalCount ?? 0) + 2,
  );
});

test("recordTasteInteraction caps repeated low-value clicks", () => {
  const repository = getDataRepository();
  const dish = repository.listPopularNearby()[0];

  assert.ok(dish, "Expected a dish for repeated-click cap test");

  useProfileStore.getState().clearProfile();
  useProfileStore.getState().syncProfile(true);

  const before = useProfileStore.getState().profile;
  for (let index = 0; index < 4; index += 1) {
    useProfileStore.getState().recordTasteInteraction({
      type: "food_button_click",
      surface: "home",
      dish,
      buttonId: "view_stall",
    });
  }

  const after = useProfileStore.getState().profile;
  const recentEvents = useProfileStore
    .getState()
    .tasteInteractionEvents.filter((event) => event.buttonId === "view_stall")
    .slice(0, 4);

  assert.deepEqual(
    recentEvents.map((event) => event.applied),
    [false, true, true, true],
  );
  assert.equal(recentEvents[0]?.reason, "capped");
  assert.deepEqual(recentEvents[0]?.userVectorBefore, recentEvents[0]?.userVectorAfter);
  assert.equal(
    after.recommendationSignals?.signalCount,
    (before.recommendationSignals?.signalCount ?? 0) + 3,
  );
});
