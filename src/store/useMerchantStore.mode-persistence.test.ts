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

test("merchant mode persistence: a launch that skips the restore route forgets the remembered mode", async () => {
  await writePersisted({ account: merchantAccount, merchantModeActive: true });
  await useMerchantStore.persist.rehydrate();
  assert.equal(useMerchantStore.getState().merchantModeRestore, "checking");

  // Deep link / notification launch or onboarding: dismissed while the account check is pending.
  useMerchantStore.getState().dismissMerchantModeRestore();
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");
  assert.equal((await readPersisted())?.merchantModeActive, false);

  // The late account check cannot bring it back.
  useMerchantStore.getState().resolveMerchantModeRestore(true);
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");

  // Dismissed after the check resolved to a restore, too.
  await writePersisted({ account: merchantAccount, merchantModeActive: true });
  await useMerchantStore.persist.rehydrate();
  useMerchantStore.getState().resolveMerchantModeRestore(true);
  useMerchantStore.getState().dismissMerchantModeRestore();
  assert.equal(useMerchantStore.getState().merchantModeRestore, "none");
  assert.equal((await readPersisted())?.merchantModeActive, false);
});

test("merchant mode persistence: clearing before the async rehydrate lands keeps the store cleared", async () => {
  await writePersisted({ account: merchantAccount, merchantModeActive: true });
  const storage = useMerchantStore.persist.getOptions().storage;
  assert.ok(storage);
  let releaseRead: () => void = () => undefined;
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  // AsyncStorage has already read the previous user's state; the answer arrives after the clear.
  const previousUserState = await storage.getItem(STORAGE_NAME);
  useMerchantStore.persist.setOptions({
    storage: {
      ...storage,
      getItem: async () => {
        await readGate;
        return previousUserState;
      },
    },
  });

  try {
    const hydration = useMerchantStore.persist.rehydrate();
    // Account switch / sign-out at launch, before AsyncStorage has answered.
    useMerchantStore.getState().clearMerchant();
    releaseRead();
    await hydration;

    const state = useMerchantStore.getState();
    assert.equal(state.account, null);
    assert.equal(state.merchantModeRestore, "none");
    assert.equal(state.merchantModeActive, false);
  } finally {
    useMerchantStore.persist.setOptions({ storage });
  }
});
