import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail } from "@/types/domain";
import { flushPendingDishSave } from "./pendingDishSave";

// Runs in its own process so the module has not read the device yet.
test("dishes a guest left on the device in an earlier launch are saved on sign-in; v1 is dropped", async () => {
  const storage = hungryPersistStorage!;
  const original = { getItem: storage.getItem, removeItem: storage.removeItem };
  const removed: string[] = [];
  const dish = { id: "dish-stored", name: "Char Kway Teow" } as DishDetail;
  storage.getItem = async () => ({ state: { dishes: [dish], savedAt: Date.now() }, version: 0 });
  storage.removeItem = async (key) => {
    removed.push(key);
  };
  const profileService = getHungryService().profile;
  const originalIds = profileService.getFavouriteDishIds;
  profileService.getFavouriteDishIds = async () => [];
  const originalAdd = useProfileStore.getState().addFavourites;
  const saved: string[] = [];
  useProfileStore.setState({
    addFavourites: async (targets) => {
      saved.push(...targets.map((target) => target.id));
      return [];
    },
  });
  try {
    await flushPendingDishSave();
    assert.deepEqual(saved, [dish.id]);
    assert.deepEqual(removed.sort(), [
      "hungry-pending-dish-save-v1",
      "hungry-pending-dish-save-v2",
    ]);
    await flushPendingDishSave();
    assert.deepEqual(saved, [dish.id], "saved once");
  } finally {
    Object.assign(storage, original);
    profileService.getFavouriteDishIds = originalIds;
    useProfileStore.setState({ addFavourites: originalAdd });
  }
});
