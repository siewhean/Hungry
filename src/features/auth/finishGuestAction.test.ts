import assert from "node:assert/strict";
import test from "node:test";

import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useDishLikeStore } from "@/store/useDishLikeStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail } from "@/types/domain";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import {
  likeDishAfterSignIn,
  markDishTriedAfterSignIn,
  saveDishAfterSignIn,
  saveStallAfterSignIn,
} from "./finishGuestAction";

const dish = { id: "dish-already-saved" } as DishDetail;

function stubToggle() {
  const calls: string[] = [];
  const original = useProfileStore.getState().toggleFavourite;
  useProfileStore.setState({
    toggleFavourite: async (target) => {
      calls.push(target.id);
      return { status: "saved" };
    },
  });
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

test("a guest's Tried tap is finished after sign-in (DISH-X4)", async () => {
  const calls: [string, boolean][] = [];
  const original = useProfileStore.getState().setDishTried;
  useProfileStore.setState({
    setDishTried: async (dishId, tried) => {
      calls.push([dishId, tried]);
      return true;
    },
  });
  try {
    assert.equal(await markDishTriedAfterSignIn("dish-pending-tried"), true);
    assert.deepEqual(calls, [["dish-pending-tried", true]]);
  } finally {
    useProfileStore.setState({ setDishTried: original });
  }
});

test("a guest's Like is finished after sign-in and never toggles an existing like off (DISH-X4)", () => {
  const userId = useProfileStore.getState().profile.id;
  useDishLikeStore.setState({ likedDishIdsByUser: {} });
  likeDishAfterSignIn("dish-pending-like");
  assert.equal(useDishLikeStore.getState().isLiked(userId, "dish-pending-like"), true);
  likeDishAfterSignIn("dish-pending-like");
  assert.equal(useDishLikeStore.getState().isLiked(userId, "dish-pending-like"), true);
});

function stubStallWrites(serverSaved: string[]) {
  const repo = getDataRepository();
  const originalList = repo.listStallInteractions;
  const originalUpsert = repo.upsertStallInteraction;
  const writes: { stallId: string; isSaved?: boolean }[] = [];
  repo.listStallInteractions = async (userId) =>
    serverSaved.map((stallId) => ({
      userId,
      stallId,
      isSaved: true,
      isTried: false,
      isReviewed: false,
    }));
  repo.upsertStallInteraction = async (_userId, stallId, patch) => {
    writes.push({ stallId, isSaved: patch.isSaved });
    return null;
  };
  useStallInteractionStore.getState()._reset();
  return {
    writes,
    restore: () => {
      repo.listStallInteractions = originalList;
      repo.upsertStallInteraction = originalUpsert;
      useStallInteractionStore.getState()._reset();
    },
  };
}

test("finishing a guest stall save saves the stall once", async () => {
  const stub = stubStallWrites([]);
  try {
    assert.equal(await saveStallAfterSignIn("stall-new"), true);
    assert.deepEqual(stub.writes, [{ stallId: "stall-new", isSaved: true }]);
    assert.equal(useStallInteractionStore.getState().interactions["stall-new"]?.isSaved, true);
  } finally {
    stub.restore();
  }
});

test("finishing a guest stall save never un-saves a stall the account already saved", async () => {
  const stub = stubStallWrites(["stall-saved"]);
  try {
    assert.equal(await saveStallAfterSignIn("stall-saved"), true);
    assert.deepEqual(stub.writes, []);
    assert.equal(useStallInteractionStore.getState().interactions["stall-saved"]?.isSaved, true);
  } finally {
    stub.restore();
  }
});
