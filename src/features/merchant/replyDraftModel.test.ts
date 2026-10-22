import assert from "node:assert/strict";
import test from "node:test";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { createMerchantReplyDraftModel } from "./replyDraftModel";

test("merchant reply drafts restore per account, survive composer close and reject delayed former-account writes", async () => {
  const saved = new Map<string, StorageValue<{ drafts: Record<string, string> }>>();
  const storage: PersistStorage<{ drafts: Record<string, string> }> = {
    getItem: async (key) => saved.get(key) ?? null,
    setItem: async (key, value) => {
      saved.set(key, value);
    },
    removeItem: async (key) => {
      saved.delete(key);
    },
  };
  const model = createMerchantReplyDraftModel(storage);
  await model.scope("account-a");
  assert.equal(model.write("account-a", "outlet-a:review-a", "Reply retained"), true);
  await model.scope("account-b");
  assert.equal(model.store.getState().drafts["outlet-a:review-a"], undefined);
  assert.equal(model.write("account-a", "outlet-a:review-a", "late old send completion"), false);
  await model.scope("account-a");
  assert.equal(model.store.getState().drafts["outlet-a:review-a"], "Reply retained");
  model.write("account-a", "outlet-a:review-a", "");
  await model.scope("account-b");
  await model.scope("account-a");
  assert.equal(model.store.getState().drafts["outlet-a:review-a"], "");
});
