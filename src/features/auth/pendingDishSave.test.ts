import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail } from "@/types/domain";
import { flushPendingDishSave, rememberPendingDishSave } from "./pendingDishSave";

const dish = { id: "dish-chicken-rice", name: "Chicken Rice" } as DishDetail;

function stubToggleAndServer(serverIds: string[]) {
  const calls: string[] = [];
  const originalToggle = useProfileStore.getState().toggleFavourite;
  useProfileStore.setState({
    toggleFavourite: async (target) => {
      calls.push(target.id);
      return { status: "saved" };
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
      useProfileStore.setState({ toggleFavourite: originalToggle });
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
