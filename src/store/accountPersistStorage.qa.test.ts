import assert from "node:assert/strict";
import { test } from "node:test";
import { userProfile } from "@/lib/services/mock/data";
import { advanceAccountGeneration } from "@/lib/security/accountScope";
import { createAccountPersistStorage } from "./accountPersistStorage";
import { hungryPersistStorage } from "./persistStorage";
import { useSessionStore } from "./useSessionStore";

test("private cache partitions enforce subject metadata and retire global legacy state", async () => {
  await useSessionStore.persist.rehydrate();
  assert.ok(hungryPersistStorage);
  const base = "private-cache-qa";
  const storage = createAccountPersistStorage(base);
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: userProfile.id });
  await storage.setItem(base, { state: { title: userProfile.displayName }, version: 0 });
  advanceAccountGeneration();
  useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
  assert.equal(await storage.getItem(base), null);
  await hungryPersistStorage.setItem(`${base}:account:guest-user`, {
    state: { title: userProfile.displayName },
    version: 0,
    accountScope: userProfile.id,
  } as Parameters<typeof hungryPersistStorage.setItem>[1]);
  await hungryPersistStorage.setItem(base, {
    state: { title: userProfile.displayName },
    version: 0,
  });
  assert.equal(await storage.getItem(base), null);
  assert.equal(await hungryPersistStorage.getItem(base), null);
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: userProfile.id });
  assert.deepEqual((await storage.getItem(base))?.state, { title: userProfile.displayName });
});
