import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { subscribePushTokenSync } from "@/lib/notifications/pushTokenSync";
import { useSessionStore } from "@/store/useSessionStore";

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  useSessionStore.setState({
    isAuthReady: true,
    isAuthenticated: false,
    authenticatedUserId: null,
  });
});

test("the push token is bound again after sign-out and sign-in", async () => {
  let registrations = 0;
  const stop = subscribePushTokenSync(async () => {
    registrations += 1;
  });
  try {
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
    assert.equal(registrations, 1, "first sign-in registers");

    useSessionStore.setState({ hasCompletedOnboarding: true });
    assert.equal(registrations, 1, "other session changes do not register again");

    // Sign-out unbinds the token on the server; the next sign-in must bind it again.
    useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
    assert.equal(registrations, 2);

    useSessionStore.setState({ authenticatedUserId: "user-2" });
    assert.equal(registrations, 3, "switching accounts binds the token to the new one");
  } finally {
    stop();
  }
});

test("a restored session registers only once auth is confirmed", async () => {
  useSessionStore.setState({
    isAuthReady: false,
    isAuthenticated: true,
    authenticatedUserId: "user-1",
  });
  let registrations = 0;
  const stop = subscribePushTokenSync(async () => {
    registrations += 1;
  });
  try {
    assert.equal(registrations, 0);
    useSessionStore.setState({ isAuthReady: true });
    assert.equal(registrations, 1);
  } finally {
    stop();
  }
});

test("a failed registration is reported and does not retry on every store change", async () => {
  const errors: unknown[] = [];
  let registrations = 0;
  const stop = subscribePushTokenSync(
    async () => {
      registrations += 1;
      throw new Error("offline");
    },
    (error) => errors.push(error),
  );
  try {
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
    await flush();
    useSessionStore.setState({ hasCompletedOnboarding: true });
    await flush();
    assert.equal(registrations, 1);
    assert.equal(errors.length, 1);
  } finally {
    stop();
  }
});

test("after unsubscribing, sign-ins no longer register", async () => {
  let registrations = 0;
  const stop = subscribePushTokenSync(async () => {
    registrations += 1;
  });
  stop();
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
  assert.equal(registrations, 0);
});
