import assert from "node:assert/strict";
import test from "node:test";

import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import type { Session } from "@/lib/services/types";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";

// AUTH-3: sign-out waits up to 3 s for the push-token unbind before ending the Supabase session.
// A sign-in that lands in that wait must keep its new session.
function setup() {
  setMockServiceProvider();
  setConfiguredDataSource("supabase");
  useSessionStore.setState({
    hasHydrated: true,
    isAuthReady: true,
    isAuthenticated: true,
    authenticatedUserId: "user-1",
    signOutPending: false,
  });
  const service = getHungryService();
  const original = {
    getCurrentSession: service.auth.getCurrentSession,
    signOut: service.auth.signOut,
    unregisterPushToken: service.push.unregisterPushToken,
  };
  let releaseUnbind: () => void = () => undefined;
  let current: Partial<Session> | null = { userId: "user-1", accessToken: "old" };
  const calls = { signOut: 0 };
  service.push.unregisterPushToken = (() =>
    new Promise<void>((resolve) => {
      releaseUnbind = resolve;
    })) as typeof service.push.unregisterPushToken;
  service.auth.getCurrentSession = (async () => current as Session | null) as typeof service.auth.getCurrentSession;
  service.auth.signOut = (async () => {
    calls.signOut += 1;
    current = null;
  }) as typeof service.auth.signOut;
  return {
    calls,
    setCurrent: (next: Partial<Session> | null) => {
      current = next;
    },
    releaseUnbind: () => releaseUnbind(),
    restore: () => {
      Object.assign(service.auth, {
        getCurrentSession: original.getCurrentSession,
        signOut: original.signOut,
      });
      service.push.unregisterPushToken = original.unregisterPushToken;
      setMockServiceProvider();
      useSessionStore.setState({ isAuthenticated: false, signOutPending: false });
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("sign-out ends the old session once the push token is unbound", async () => {
  const fake = setup();
  try {
    useSessionStore.getState().signOut();
    await tick();
    fake.releaseUnbind();
    await tick();
    assert.equal(fake.calls.signOut, 1);
    assert.equal(useSessionStore.getState().signOutPending, false);
  } finally {
    fake.restore();
  }
});

test("a sign-in during the unbind wait keeps its new session", async () => {
  const fake = setup();
  try {
    useSessionStore.getState().signOut();
    await tick();
    // Another account signs in before the unbind settles.
    fake.setCurrent({ userId: "user-2", accessToken: "new" });
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-2" });
    fake.releaseUnbind();
    await tick();
    assert.equal(fake.calls.signOut, 0);
    assert.equal(useSessionStore.getState().isAuthenticated, true);
  } finally {
    fake.restore();
  }
});

test("the same account signing straight back in also keeps its new session", async () => {
  const fake = setup();
  try {
    useSessionStore.getState().signOut();
    await tick();
    fake.setCurrent({ userId: "user-1", accessToken: "new" });
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
    fake.releaseUnbind();
    await tick();
    assert.equal(fake.calls.signOut, 0);
  } finally {
    fake.restore();
  }
});
