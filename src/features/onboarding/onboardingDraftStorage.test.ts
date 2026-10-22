import assert from "node:assert/strict";
import test from "node:test";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { userProfile } from "@/lib/services/mock/data";
import { createOnboardingDraftStorage } from "./onboardingDraftStorage";

type Draft = { subjectId: string; values: typeof userProfile.tasteVector; step: number };
type State = { draft: Draft | null };
const draft = (subjectId: string, step = 0): Draft => ({
  subjectId,
  values: { ...userProfile.tasteVector },
  step,
});
function storage() {
  const saved = new Map<string, StorageValue<State>>();
  const backing: PersistStorage<State> = {
    getItem: async (key) => saved.get(key) ?? null,
    setItem: async (key, value) => {
      saved.set(key, value);
    },
    removeItem: async (key) => {
      saved.delete(key);
    },
  };
  return { saved, backing };
}
test("onboarding owner partitions retain account A across B and memory clears; explicit reset removes only named owner", async () => {
  const { saved, backing } = storage();
  let subject = "account-a";
  const adapter = createOnboardingDraftStorage(backing, async () => subject);
  await adapter.storage.setItem("legacy", { state: { draft: draft(subject, 3) }, version: 0 });
  subject = "account-b";
  await adapter.storage.setItem("legacy", { state: { draft: null }, version: 0 });
  await adapter.storage.setItem("legacy", { state: { draft: draft(subject, 5) }, version: 0 });
  assert.equal((await adapter.load("account-a")).draft?.step, 3);
  assert.equal((await adapter.load("account-b")).draft?.step, 5);
  await adapter.remove("account-b");
  assert.equal((await adapter.load("account-b")).draft, null);
  assert.equal((await adapter.load("account-a")).draft?.step, 3);
  assert.equal(saved.size, 1);
});
test("legacy owner is migrated safely even if another account restores first", async () => {
  const { saved, backing } = storage();
  saved.set("hungry-onboarding-draft-v1", { state: { draft: draft("account-a", 4) }, version: 0 });
  const adapter = createOnboardingDraftStorage(backing, async () => "account-b");
  assert.equal(await adapter.storage.getItem("legacy"), null);
  assert.equal(saved.has("hungry-onboarding-draft-v1"), false);
  assert.equal((await adapter.load("account-a")).draft?.step, 4);
});
test("late onboarding reads cannot replace edits or a later account generation", async () => {
  const { backing } = storage();
  let resolve: ((value: StorageValue<State> | null) => void) | undefined;
  const delayed: PersistStorage<State> = {
    ...backing,
    getItem: () =>
      new Promise((done) => {
        resolve = done;
      }),
  };
  const adapter = createOnboardingDraftStorage(delayed, async () => "account-a");
  const reading = adapter.load("account-a");
  await Promise.resolve();
  await adapter.storage.setItem("legacy", { state: { draft: draft("account-a", 7) }, version: 0 });
  resolve?.({ state: { draft: draft("account-a", 1) }, version: 0 });
  assert.equal((await reading).current, false);
  const generationRead = adapter.load("account-a");
  await Promise.resolve();
  const { advanceAccountGeneration } = await import("@/lib/security/accountScope");
  advanceAccountGeneration();
  resolve?.({ state: { draft: draft("account-a", 2) }, version: 0 });
  assert.equal((await generationRead).current, false);
});

test("legacy guest owner is canonicalized and consumed guest deletion preserves adopted account", async () => {
  const { saved, backing } = storage();
  saved.set("hungry-onboarding-draft-v1", { state: { draft: draft("guest", 2) }, version: 0 });
  const adapter = createOnboardingDraftStorage(backing, async () => "guest-user");
  const restored = await adapter.storage.getItem("legacy");
  assert.equal(restored?.state.draft?.subjectId, "guest-user");
  await adapter.storage.setItem("legacy", {
    state: { draft: { ...restored!.state.draft!, subjectId: "account-a" } },
    version: 0,
  });
  await adapter.remove("guest-user");
  assert.equal((await adapter.load("guest-user")).draft, null);
  assert.equal((await adapter.load("account-a")).draft?.step, 2);
});
