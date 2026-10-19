import assert from "node:assert/strict";
import test from "node:test";

import { merchantAccount } from "@/lib/services/mock/data";
import { isMerchantModeActive, useMerchantStore } from "./useMerchantStore";

const STORAGE_NAME = "hungry-merchant-v1";

async function writePersisted(state: Record<string, unknown>) {
  const storage = useMerchantStore.persist.getOptions().storage;
  assert.ok(storage);
  await storage.setItem(STORAGE_NAME, { state: state as never, version: 0 });
}

async function readPersisted(): Promise<Record<string, unknown> | undefined> {
  const storage = useMerchantStore.persist.getOptions().storage;
  assert.ok(storage);
  const value = await storage.getItem(STORAGE_NAME);
  return value?.state as Record<string, unknown> | undefined;
}

test.afterEach(async () => {
  useMerchantStore.getState().clearMerchant();
  await useMerchantStore.persist.getOptions().storage?.removeItem(STORAGE_NAME);
});

test("merchant mode persistence: a remembered mode waits for the account check, not active on launch", async () => {
  await writePersisted({ account: merchantAccount, merchantModeActive: true });
  await useMerchantStore.persist.rehydrate();

  const state = useMerchantStore.getState();
  assert.equal(state.merchantModeActive, false);
  assert.equal(state.merchantModeRestore, "checking");
  assert.equal(isMerchantModeActive(state), false);

  state.resolveMerchantModeRestore(true);
  assert.equal(useMerchantStore.getState().merchantModeRestore, "restore");
  assert.equal((await readPersisted())?.merchantModeActive, true);

  // The Merchant Centre gaining focus activates the mode and consumes the restore.
  useMerchantStore.getState().setMerchantModeActive(true);
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");
  assert.equal(isMerchantModeActive(useMerchantStore.getState()), true);
  assert.equal((await readPersisted())?.merchantModeActive, true);
});

test("merchant mode persistence: no merchant account clears the remembered mode", async () => {
  await writePersisted({ account: null, merchantModeActive: true });
  await useMerchantStore.persist.rehydrate();

  useMerchantStore.getState().resolveMerchantModeRestore(false);
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");
  assert.equal((await readPersisted())?.merchantModeActive, false);
});

test("merchant mode persistence: customer mode was remembered, so launch does not wait", async () => {
  await writePersisted({ account: merchantAccount, merchantModeActive: false });
  await useMerchantStore.persist.rehydrate();
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");

  // A late resolution never turns a settled launch into a restore.
  useMerchantStore.getState().resolveMerchantModeRestore(true);
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");
});

test("merchant mode persistence: switching to customer mode and signing out clear it", async () => {
  const store = useMerchantStore.getState();
  store.setAccount(merchantAccount);
  store.setMerchantModeActive(true);
  assert.equal((await readPersisted())?.merchantModeActive, true);

  useMerchantStore.getState().setMerchantModeActive(false);
  assert.equal((await readPersisted())?.merchantModeActive, false);

  useMerchantStore.getState().setMerchantModeActive(true);
  useMerchantStore.getState().clearMerchant();
  const persisted = await readPersisted();
  assert.equal(persisted?.merchantModeActive, false);
  assert.equal(persisted?.account, null);
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");
});
