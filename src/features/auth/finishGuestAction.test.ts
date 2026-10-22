import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail } from "@/types/domain";
import { saveDishAfterSignIn } from "./finishGuestAction";

const dish = { id: "dish-already-saved" } as DishDetail;

function stubToggle() {
  const calls: string[] = [];
  const original = useProfileStore.getState().toggleFavourite;
  useProfileStore.setState({ toggleFavourite: (target) => void calls.push(target.id) });
  return { calls, restore: () => useProfileStore.setState({ toggleFavourite: original }) };
}

function stubServerFavourites(result: () => Promise<string[]>) {
  const profileService = getHungryService().profile;
  const original = profileService.getFavouriteDishIds;
  profileService.getFavouriteDishIds = result;
  return () => {
    profileService.getFavouriteDishIds = original;
  };
}

function clearLocalFavourites() {
  // Right after sign-in the account's favourites have not loaded locally yet.
  const current = useProfileStore.getState().profile;
  useProfileStore.setState({ profile: { ...current, favouriteDishIds: [] } });
}

test("finishing a guest save never toggles off a dish the account already saved", async () => {
  clearLocalFavourites();
  const toggle = stubToggle();
  const restoreService = stubServerFavourites(async () => [dish.id]);
  try {
    await saveDishAfterSignIn(dish);
    assert.deepEqual(toggle.calls, []);
  } finally {
    restoreService();
    toggle.restore();
  }
});

test("finishing a guest save adds the dish when the account does not have it", async () => {
  clearLocalFavourites();
  const toggle = stubToggle();
  const restoreService = stubServerFavourites(async () => []);
  try {
    await saveDishAfterSignIn(dish);
    assert.deepEqual(toggle.calls, [dish.id]);
  } finally {
    restoreService();
    toggle.restore();
  }
});

test("finishing a guest save does nothing when the account's saves cannot be read", async () => {
  clearLocalFavourites();
  const toggle = stubToggle();
  const restoreService = stubServerFavourites(() => Promise.reject(new Error("offline")));
  try {
    await saveDishAfterSignIn(dish);
    assert.deepEqual(toggle.calls, []);
  } finally {
    restoreService();
    toggle.restore();
  }
});
