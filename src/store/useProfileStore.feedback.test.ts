import assert from "node:assert/strict";
import test from "node:test";

import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import {
  getDataRepository,
  resetServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { HungryService } from "@/lib/services/types";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";

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
  useSessionStore.setState((state) => ({ ...state, isAuthenticated: true }));

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

test("signed-out Supabase onboarding taste and dietary choices stay local until auth", async () => {
  let profileSyncCalls = 0;
  const supabaseProfileService = {
    profile: {
      updateProfile: async () => {
        profileSyncCalls += 1;
        throw new Error("signed-out profile update should not sync");
      },
      updateTasteVector: async () => {
        profileSyncCalls += 1;
        throw new Error("signed-out taste vector should not sync");
      },
      updateTasteProfile: async () => {
        profileSyncCalls += 1;
        throw new Error("signed-out taste profile should not sync");
      },
      updateDietaryPreferences: async () => {
        profileSyncCalls += 1;
        throw new Error("signed-out dietary preferences should not sync");
      },
    },
  } as unknown as HungryService;

  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: supabaseProfileService,
    similarityScore: () => 1,
  });

  try {
    useSessionStore.setState((state) => ({
      ...state,
      isAuthenticated: false,
      authenticatedUserId: null,
    }));
    useProfileStore.getState().clearProfile();
    const tasteVector = { sweet: 7, spicy: 6, sour: 4, salty: 6, rich: 8, aromatic: 7 };

    useProfileStore.getState().setTasteVector(tasteVector);
    useProfileStore.getState().setDietaryPreferences(["halal"]);
    await Promise.resolve();

    const profile = useProfileStore.getState().profile;
    assert.equal(profileSyncCalls, 0);
    assert.deepEqual(profile.tasteVector, tasteVector);
    assert.deepEqual(profile.dietaryPreferences, ["halal"]);
    assert.equal(profile.recommendationSignals?.signalCount, 1);
  } finally {
    resetServiceProvider();
  }
});

test("setFoodOpenness sets openness and the matching neophiliaIndex", () => {
  useProfileStore.getState().clearProfile();
  useProfileStore.getState().setFoodOpenness("adventurous", "onboarding");
  const { profile, tasteProfile } = useProfileStore.getState();
  assert.equal(profile.tasteProfile?.foodOpenness, "adventurous");
  assert.equal(profile.tasteProfile?.neophiliaIndex, 8);
  assert.equal(tasteProfile.foodOpenness, "adventurous");
});

test("Not for me hides the dish in local food history for 30 days", () => {
  const dish = getDataRepository().listPopularNearby()[0];
  assert.ok(dish);
  useProfileStore.getState().clearProfile();
  useProfileStore.getState().recordTasteInteraction({ type: "dismissed", surface: "decide", dish });
  const row = useProfileStore.getState().foodHistory.find((item) => item.dishId === dish.id);
  assert.ok(row?.dismissedUntil);
  assert.ok(Date.parse(row.dismissedUntil) > Date.now() + 29 * 24 * 60 * 60 * 1000);
  assert.equal(row.evidence, -4);
});
