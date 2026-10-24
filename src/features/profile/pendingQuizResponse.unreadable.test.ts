import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { flushPendingQuizResponse } from "./pendingQuizResponse";

// Runs in its own process so the module has not read the device yet.
test("an unreadable device store means nothing is pending and nothing is written", async () => {
  const storage = hungryPersistStorage!;
  const originalGet = storage.getItem;
  storage.getItem = async () => {
    throw new Error("storage unavailable");
  };
  const service = getHungryService();
  const originalRecord = service.profile.recordQuizResponse;
  const writes: Record<string, unknown>[] = [];
  service.profile.recordQuizResponse = async (responses) => {
    writes.push(responses);
  };
  try {
    await flushPendingQuizResponse();
    assert.deepEqual(writes, []);
  } finally {
    storage.getItem = originalGet;
    service.profile.recordQuizResponse = originalRecord;
  }
});
