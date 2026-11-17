import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "zustand/vanilla";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { accountDraftPersistence } from "../accountDraftPersistence";

test("drafts stay scoped to the owner and restore after switching back", async () => {
  const saved = new Map<string, StorageValue<{ text: string }>>();
  const storage: PersistStorage<{ text: string }> = {
    getItem: async (key) => saved.get(key) ?? null,
    setItem: async (key, value) => {
      saved.set(key, value);
    },
    removeItem: async (key) => {
      saved.delete(key);
    },
  };
  const store = createStore(() => ({ text: "" }));
  const scope = accountDraftPersistence(store, "draft", (state) => state, { text: "" }, storage);
  await scope("owner-a");
  store.setState({ text: "private draft" });
  await scope("owner-b");
  assert.equal(store.getState().text, "");
  store.setState({ text: "another draft" });
  await scope("owner-a");
  assert.equal(store.getState().text, "private draft");
  await scope(null);
  assert.equal(store.getState().text, "");
});

test("late hydration cannot replace another account or newly edited work", async () => {
  let resolve: (value: StorageValue<{ text: string }>) => void = () => {};
  const storage: PersistStorage<{ text: string }> = {
    getItem: () =>
      new Promise((done) => {
        resolve = done;
      }),
    setItem: async () => {},
    removeItem: async () => {},
  };
  const store = createStore(() => ({ text: "" }));
  const scope = accountDraftPersistence(store, "draft", (state) => state, { text: "" }, storage);
  const loading = scope("owner-a");
  await Promise.resolve();
  store.setState({ text: "new edit" });
  resolve({ state: { text: "old stored draft" }, version: 2 });
  await loading;
  assert.equal(store.getState().text, "new edit");
  const oldLoad = scope("owner-b");
  await Promise.resolve();
  await scope(null);
  resolve({ state: { text: "wrong account" }, version: 2 });
  await oldLoad;
  assert.equal(store.getState().text, "");
});
