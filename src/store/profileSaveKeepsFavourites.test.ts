import assert from "node:assert/strict";
import test from "node:test";

import { userProfile } from "@/lib/services/mock/data";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";

// R1 regression: saving Edit Profile replaced the whole profile with the backend copy.
// In mock mode favourite toggles never reach the backend, so favourites were wiped.
test("saving profile edits keeps locally saved favourites (mock backend)", async () => {
  const before = useProfileStore.getState();
  // Mock sign-in seeds the backend copy (no favourites) for the same user id as the store.
  await getHungryService().auth.signInWithGoogle();
  useSessionStore.setState({ isAuthenticated: true, isAuthReady: true });
  useProfileStore.setState({
    profile: {
      ...userProfile,
      favouriteDishIds: [],
      stats: { ...userProfile.stats, favouritesCount: 0 },
    },
  });
  try {
    const toggled = await useProfileStore
      .getState()
      .toggleFavourite({ id: "dish-r1", venueId: "venue-r1" });
    assert.equal(toggled.status, "saved");
    assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, ["dish-r1"]);

    const saved = await getHungryService().profile.updateProfile({
      displayName: "Renamed Diner",
      dietaryPreferences: useProfileStore.getState().profile.dietaryPreferences,
    });
    useProfileStore.getState().applySavedProfileEdits(saved);

    const after = useProfileStore.getState().profile;
    assert.equal(after.displayName, "Renamed Diner");
    assert.deepEqual(after.favouriteDishIds, ["dish-r1"]);
    assert.equal(after.stats.favouritesCount, 1);
  } finally {
    useProfileStore.setState({ profile: before.profile });
    useSessionStore.setState({ isAuthenticated: false });
    await getHungryService().auth.signOut();
  }
});

test("a save result for a different account is ignored", () => {
  const before = useProfileStore.getState().profile;
  try {
    useProfileStore.getState().applySavedProfileEdits({
      ...before,
      id: "someone-else",
      displayName: "Other",
    });
    assert.equal(useProfileStore.getState().profile.displayName, before.displayName);
  } finally {
    useProfileStore.setState({ profile: before });
  }
});
