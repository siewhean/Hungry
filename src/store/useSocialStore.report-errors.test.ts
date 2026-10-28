// Follow and withdraw failures are reported (once each) as well as rolled back (R4 PROF4-19).

import assert from "node:assert/strict";
import test from "node:test";

import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore } from "@/store/useSocialStore";

const PRIVATE_USER_ID = "user-emma";

function reset() {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useSessionStore.setState({ isAuthenticated: true });
  useSocialStore.getState().clearAccountScopedState();
}

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 100 && !check(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(check(), "timed out waiting for store state");
}

/** reportError logs to the console in development builds; this reads that log. */
function captureReports() {
  const reported: { store?: string; action?: string }[] = [];
  const originalConsoleError = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[2] as { action?: string });
  };
  return {
    reported,
    restore() {
      console.error = originalConsoleError;
      globals.__DEV__ = previousDev;
    },
  };
}

test("a follow the server refuses is rolled back and reported once", async () => {
  reset();
  const social = getHungryService().social;
  const originalFollow = social.followUser;
  const capture = captureReports();
  try {
    social.followUser = async () => {
      throw new Error("offline");
    };
    useSocialStore.getState().toggleFollow(PRIVATE_USER_ID, { isPrivate: true });
    await waitFor(() => capture.reported.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(
      capture.reported.filter((r) => r.action === "sync_follow_state").map((r) => r.store),
      ["social"],
    );
    assert.equal(Boolean(useSocialStore.getState().requestedUserIds[PRIVATE_USER_ID]), false);
  } finally {
    social.followUser = originalFollow;
    capture.restore();
    reset();
  }
});

test("a withdrawal the server refuses is put back and reported once", async () => {
  reset();
  const social = getHungryService().social;
  const originalCancel = social.cancelFollowRequest;
  const capture = captureReports();
  try {
    useSocialStore.getState().setFollowRequested(PRIVATE_USER_ID, true);
    social.cancelFollowRequest = async () => {
      throw new Error("offline");
    };
    useSocialStore.getState().toggleFollow(PRIVATE_USER_ID);
    await waitFor(() => Boolean(useSocialStore.getState().requestedUserIds[PRIVATE_USER_ID]));
    assert.deepEqual(
      capture.reported.filter((r) => r.action === "cancel_follow_request").map((r) => r.store),
      ["social"],
    );
  } finally {
    social.cancelFollowRequest = originalCancel;
    capture.restore();
    reset();
  }
});
