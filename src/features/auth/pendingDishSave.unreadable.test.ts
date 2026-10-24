import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { flushPendingDishSave } from "./pendingDishSave";

// Runs in its own process so the module has not read the device yet.
test("an unreadable or malformed stored save is ignored", async () => {
  const storage = hungryPersistStorage!;
  const originalGet = storage.getItem;
  storage.getItem = async () => {
    throw new Error("storage unavailable");
  };
  const profileService = getHungryService().profile;
  const originalIds = profileService.getFavouriteDishIds;
  let reads = 0;
  profileService.getFavouriteDishIds = async () => {
    reads += 1;
    return [];
  };
  try {
    await flushPendingDishSave();
    assert.equal(reads, 0, "nothing pending, nothing read or saved");
  } finally {
    storage.getItem = originalGet;
    profileService.getFavouriteDishIds = originalIds;
  }
});
