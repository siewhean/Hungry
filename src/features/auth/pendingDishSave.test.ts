import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail } from "@/types/domain";
import {
  clearPendingDishSave,
  flushPendingDishSave,
  forgetPendingDishSave,
  getPendingDishSaveIds,
  rememberPendingDishSave,
} from "./pendingDishSave";

const dish = { id: "dish-chicken-rice", name: "Chicken Rice" } as DishDetail;

function stubToggleAndServer(serverIds: string[]) {
  const calls: string[] = [];
  const originalAdd = useProfileStore.getState().addFavourites;
  useProfileStore.setState({
    addFavourites: async (targets) => {
      calls.push(...targets.map((target) => target.id));
      return [];
    },
  });
  const current = useProfileStore.getState().profile;
  useProfileStore.setState({ profile: { ...current, favouriteDishIds: [] } });
  const profileService = getHungryService().profile;
  const originalIds = profileService.getFavouriteDishIds;
  profileService.getFavouriteDishIds = async () => serverIds;
  return {
    calls,
    restore: () => {
      useProfileStore.setState({ addFavourites: originalAdd });
      profileService.getFavouriteDishIds = originalIds;
    },
  };
}

test("a guest's onboarding save survives the result screen unmounting and is saved once", async () => {
  const stub = stubToggleAndServer([]);
  try {
    // The result screen keeps the dish, then unmounts (reset to EmailVerification).
    rememberPendingDishSave(dish);
    // Verification and the result screen may both try to finish it; it saves once.
    await Promise.all([flushPendingDishSave(), flushPendingDishSave()]);
    assert.deepEqual(stub.calls, [dish.id]);
    assert.equal(useUIStore.getState().toast?.message, "Saved Chicken Rice");
    await flushPendingDishSave();
    assert.deepEqual(stub.calls, [dish.id]);
  } finally {
    stub.restore();
  }
});

test("a stale pending save is not attached to a later sign-in", async () => {
  const stub = stubToggleAndServer([]);
  try {
    rememberPendingDishSave(dish);
    await flushPendingDishSave(Date.now() + 2 * 24 * 60 * 60 * 1000);
    assert.deepEqual(stub.calls, []);
  } finally {
    stub.restore();
  }
});

test("a guest can take a dish back out, and backing out of sign-in drops every pending save", async () => {
  const stub = stubToggleAndServer([]);
  const laksa = { id: "dish-laksa", name: "Laksa" } as DishDetail;
  try {
    clearPendingDishSave();
    forgetPendingDishSave(dish.id);
    assert.deepEqual(getPendingDishSaveIds(), [], "nothing to forget");
    rememberPendingDishSave(dish);
    rememberPendingDishSave(laksa);
    rememberPendingDishSave(dish);
    assert.deepEqual(getPendingDishSaveIds(), [laksa.id, dish.id], "a repeat moves to the end");
    forgetPendingDishSave(laksa.id);
    assert.deepEqual(getPendingDishSaveIds(), [dish.id]);
    forgetPendingDishSave(dish.id);
    await flushPendingDishSave();
    assert.deepEqual(stub.calls, [], "an emptied list saves nothing");
    rememberPendingDishSave(dish);
    clearPendingDishSave();
    await flushPendingDishSave();
    assert.deepEqual(stub.calls, []);
  } finally {
    stub.restore();
  }
});

test("dishes that could not be saved are named in an error toast", async () => {
  const originalAdd = useProfileStore.getState().addFavourites;
  const profileService = getHungryService().profile;
  const originalIds = profileService.getFavouriteDishIds;
  profileService.getFavouriteDishIds = async () => [];
  useProfileStore.setState({ addFavourites: async (targets) => targets });
  const laksa = { id: "dish-laksa", name: "Laksa" } as DishDetail;
  try {
    rememberPendingDishSave(dish);
    rememberPendingDishSave(laksa);
    await flushPendingDishSave();
    assert.equal(
      useUIStore.getState().toast?.message,
      "Couldn't save 2 dishes. Try again from the dish.",
    );
    assert.equal(useUIStore.getState().toast?.tone, "error");
    rememberPendingDishSave(laksa);
    await flushPendingDishSave();
    assert.equal(
      useUIStore.getState().toast?.message,
      "Couldn't save Laksa. Try again from the dish.",
    );
  } finally {
    useProfileStore.setState({ addFavourites: originalAdd });
    profileService.getFavouriteDishIds = originalIds;
  }
});
