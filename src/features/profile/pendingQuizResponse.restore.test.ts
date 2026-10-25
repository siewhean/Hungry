import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { flushPendingQuizResponse } from "./pendingQuizResponse";

// Runs in its own process so the module has not read the device yet.
test("answers a guest left on the device in an earlier launch are written on sign-in", async () => {
  const storage = hungryPersistStorage!;
  const original = { getItem: storage.getItem, removeItem: storage.removeItem };
  const removed: string[] = [];
  const savedAt = Date.now() - 60_000;
  storage.getItem = async () => ({
    state: { responses: { flowMode: "onboarding" }, tasteVector: NEUTRAL_TASTE_VECTOR, savedAt },
    version: 0,
  });
  storage.removeItem = async (key) => {
    removed.push(key);
  };
  const service = getHungryService();
  const originalRecord = service.profile.recordQuizResponse;
  const writes: Record<string, unknown>[] = [];
  service.profile.recordQuizResponse = async (responses) => {
    writes.push(responses);
  };
  try {
    await flushPendingQuizResponse();
    assert.deepEqual(writes, [{ flowMode: "onboarding" }]);
    assert.deepEqual(removed, ["hungry-pending-quiz-response-v1"], "cleared after the write");
    await flushPendingQuizResponse();
    assert.equal(writes.length, 1, "not written twice");
  } finally {
    Object.assign(storage, original);
    service.profile.recordQuizResponse = originalRecord;
  }
});
