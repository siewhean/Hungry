import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { flushPendingQuizResponse, recordQuizResponse } from "./pendingQuizResponse";

// r2 onboarding-L12: queued guest answers survive a failed write, and a double flush inserts once.
test("a failed write keeps the queued quiz answers; the next flush saves them once", async () => {
  const service = getHungryService();
  const original = service.profile.recordQuizResponse;
  const writes: Record<string, unknown>[] = [];
  let failNext = true;
  service.profile.recordQuizResponse = async (responses) => {
    if (failNext) {
      failNext = false;
      throw new Error("offline");
    }
    writes.push(responses);
  };
  try {
    useSessionStore.setState({ isAuthenticated: false });
    recordQuizResponse(
      { answers: NEUTRAL_TASTE_VECTOR, flowMode: "onboarding" },
      NEUTRAL_TASTE_VECTOR,
    );

    // Offline sign-in: the write throws, nothing is lost.
    await flushPendingQuizResponse();
    assert.equal(writes.length, 0);

    // Two flushes at once (two sign-in paths) still write one row.
    await Promise.all([flushPendingQuizResponse(), flushPendingQuizResponse()]);
    assert.equal(writes.length, 1);

    // Cleared after a successful write: a later sign-in does not insert it again.
    await flushPendingQuizResponse();
    assert.equal(writes.length, 1);
  } finally {
    service.profile.recordQuizResponse = original;
  }
});

test("a signed-in quiz is written straight away and answers older than a week are dropped", async () => {
  const service = getHungryService();
  const original = service.profile.recordQuizResponse;
  const writes: Record<string, unknown>[] = [];
  service.profile.recordQuizResponse = async (responses) => {
    writes.push(responses);
  };
  try {
    useSessionStore.setState({ isAuthenticated: true });
    recordQuizResponse({ flowMode: "retake" }, NEUTRAL_TASTE_VECTOR);
    await Promise.resolve();
    assert.equal(writes.length, 1);

    useSessionStore.setState({ isAuthenticated: false });
    recordQuizResponse({ flowMode: "onboarding" }, NEUTRAL_TASTE_VECTOR);
    await flushPendingQuizResponse(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await flushPendingQuizResponse();
    assert.equal(writes.length, 1);
  } finally {
    service.profile.recordQuizResponse = original;
    useSessionStore.setState({ isAuthenticated: false });
  }
});
