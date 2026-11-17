import assert from "node:assert/strict";
import { test } from "node:test";
import { userProfile } from "@/lib/services/mock/data";
import { advanceAccountGeneration } from "@/lib/security/accountScope";
import { profilePersistStorage } from "./profilePersistStorage";
import { hungryPersistStorage } from "./persistStorage";
import { useSessionStore } from "./useSessionStore";
import { useProfileStore } from "./useProfileStore";

test("profile/session persistence hydrates without circular wait and isolates account partitions", async () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([useSessionStore.persist.rehydrate(), useProfileStore.persist.rehydrate()]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Profile/session hydration deadlocked")), 1500);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  assert.equal(useSessionStore.persist.hasHydrated(), true);
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: userProfile.id });
  await profilePersistStorage.setItem("unused", {
    state: { profile: structuredClone(userProfile) },
    version: 0,
  });
  assert.equal(
    (await profilePersistStorage.getItem("unused"))?.state &&
      ((await profilePersistStorage.getItem("unused"))!.state as { profile: typeof userProfile })
        .profile.id,
    userProfile.id,
  );
  advanceAccountGeneration();
  useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
  const guest = await profilePersistStorage.getItem("unused");
  assert.notEqual(
    (guest?.state as { profile?: typeof userProfile } | undefined)?.profile?.id,
    userProfile.id,
  );
});

test("a late profile storage read is discarded after subject generation changes", async () => {
  assert.ok(hungryPersistStorage);
  const original = hungryPersistStorage.getItem;
  let release!: (value: Awaited<ReturnType<typeof original>>) => void;
  let signal!: () => void;
  const started = new Promise<void>((resolve) => {
    signal = resolve;
  });
  hungryPersistStorage.getItem = async () => {
    signal();
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: userProfile.id });
  try {
    const pending = profilePersistStorage.getItem("unused");
    await started;
    advanceAccountGeneration();
    useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
    release({ state: { profile: structuredClone(userProfile) }, version: 0 });
    assert.equal(await pending, null);
  } finally {
    hungryPersistStorage.getItem = original;
  }
});

test("a guest profile read is discarded after first sign-in even without a generation change", async () => {
  assert.ok(hungryPersistStorage);
  const original = hungryPersistStorage.getItem;
  let release!: (value: Awaited<ReturnType<typeof original>>) => void;
  let signal!: () => void;
  const started = new Promise<void>((resolve) => {
    signal = resolve;
  });
  hungryPersistStorage.getItem = async () => {
    signal();
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
  try {
    const pending = profilePersistStorage.getItem("unused");
    await started;
    // First guest-to-account sign-in need not advance the account generation.
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: userProfile.id });
    release({ state: { profile: { ...userProfile, id: "guest-user" } }, version: 0 });
    assert.equal(await pending, null);
  } finally {
    hungryPersistStorage.getItem = original;
  }
});

test("guest alias migration rechecks identity after its final storage await", async () => {
  assert.ok(hungryPersistStorage);
  const originalGet = hungryPersistStorage.getItem;
  const originalRemove = hungryPersistStorage.removeItem;
  let release!: () => void;
  let signal!: () => void;
  const started = new Promise<void>((resolve) => {
    signal = resolve;
  });
  hungryPersistStorage.getItem = async () => ({
    state: { profile: { ...userProfile, id: "guest" } },
    version: 0,
  });
  hungryPersistStorage.removeItem = async () => {
    signal();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
  try {
    const pending = profilePersistStorage.getItem("unused");
    await started;
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: userProfile.id });
    release();
    assert.equal(await pending, null);
  } finally {
    hungryPersistStorage.getItem = originalGet;
    hungryPersistStorage.removeItem = originalRemove;
  }
});
