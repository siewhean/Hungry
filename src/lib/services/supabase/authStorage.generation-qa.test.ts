import assert from "node:assert/strict";
import { test } from "node:test";
import { createGenerationAuthStorage, retireAuthStorage } from "./authStorage";

test("retired auth adapters cannot read, overwrite or erase a subsequent login", async () => {
  const key = "generation-qa-token";
  const first = createGenerationAuthStorage();
  await first.setItem(key, "earlier-account-token");
  await retireAuthStorage(key).cleanup;
  const next = createGenerationAuthStorage();
  await next.setItem(key, "current-account-token");
  await first.removeItem(key);
  await first.setItem(key, "late-earlier-refresh");
  assert.equal(await first.getItem(key), null);
  assert.equal(await next.getItem(key), "current-account-token");
  await retireAuthStorage(key).cleanup;
});

test("retirement captures only the old immutable token before a new login writes", async () => {
  const key = "captured-session-qa-token";
  const first = createGenerationAuthStorage();
  await first.setItem(key, JSON.stringify({ access_token: "synthetic-earlier-session" }));
  const retired = retireAuthStorage(key);
  const next = createGenerationAuthStorage();
  const newLogin = next.setItem(key, JSON.stringify({ access_token: "synthetic-current-session" }));
  await first.setItem(key, JSON.stringify({ access_token: "synthetic-late-refresh" }));
  assert.equal(await retired.retiredAccessToken, "synthetic-earlier-session");
  await retired.cleanup;
  await newLogin;
  assert.equal(JSON.parse((await next.getItem(key))!).access_token, "synthetic-current-session");
  await retireAuthStorage(key).cleanup;
});

test("malformed retired session cannot invent a revocation token or prevent purge", async () => {
  const key = "malformed-session-qa-token";
  const storage = createGenerationAuthStorage();
  await storage.setItem(key, "invalid-session-json");
  const retired = retireAuthStorage(key);
  assert.equal(await retired.retiredAccessToken, null);
  await retired.cleanup;
  assert.equal(await createGenerationAuthStorage().getItem(key), null);
});

test("strict secure deletion rejects read-back residue and blocks new writes until successful retry", async () => {
  const { __internal } = await import("./authStorage");
  const previousDisable = process.env.HUNGRY_DISABLE_SECURE_STORE;
  process.env.HUNGRY_DISABLE_SECURE_STORE = "0";
  const data = new Map<string, string>();
  let refuseDeletion = false;
  const secure = {
    getItemAsync: async (key: string) => data.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      data.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      if (!refuseDeletion) data.delete(key);
    },
  };
  __internal.setStorageAdaptersForTests(secure, null);
  const key = "secure-failure-qa-token";
  try {
    const retiredAdapter = createGenerationAuthStorage();
    await retiredAdapter.setItem(key, JSON.stringify({ access_token: "synthetic-secure-token" }));
    refuseDeletion = true;
    const retired = retireAuthStorage(key);
    assert.equal(await retired.retiredAccessToken, "synthetic-secure-token");
    await assert.rejects(retired.cleanup, /could not be removed/);
    assert.equal(await retiredAdapter.getItem(key), null);
    await assert.rejects(
      createGenerationAuthStorage().setItem(key, "blocked-new-login"),
      /cleanup must be retried|could not be removed/,
    );
    refuseDeletion = false;
    await retireAuthStorage(key).cleanup;
    const fresh = createGenerationAuthStorage();
    await fresh.setItem(key, "confirmed-new-login");
    assert.equal(await fresh.getItem(key), "confirmed-new-login");
    await retireAuthStorage(key).cleanup;
    assert.equal(data.size, 0);
  } finally {
    refuseDeletion = false;
    await retireAuthStorage(key).cleanup;
    __internal.setStorageAdaptersForTests(null, null);
    if (previousDisable === undefined) delete process.env.HUNGRY_DISABLE_SECURE_STORE;
    else process.env.HUNGRY_DISABLE_SECURE_STORE = previousDisable;
  }
});

test("an in-flight secure write settles before capture and purge, then queued new login runs once", async () => {
  const { __internal } = await import("./authStorage");
  const previousDisable = process.env.HUNGRY_DISABLE_SECURE_STORE;
  process.env.HUNGRY_DISABLE_SECURE_STORE = "0";
  const data = new Map<string, string>();
  let releaseWrite!: () => void;
  let signalStarted!: () => void;
  const writeStarted = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  let shouldPause = true;
  let currentTokenWrites = 0;
  const secure = {
    getItemAsync: async (key: string) => data.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      if (shouldPause) {
        shouldPause = false;
        signalStarted();
        await gate;
      }
      if (value.includes("synthetic-new-queued-session")) currentTokenWrites++;
      data.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      data.delete(key);
    },
  };
  __internal.setStorageAdaptersForTests(secure, null);
  const key = "queued-secure-qa-token";
  try {
    const old = createGenerationAuthStorage();
    const write = old.setItem(
      key,
      JSON.stringify({ access_token: "synthetic-old-inflight-session" }),
    );
    await writeStarted;
    const retired = retireAuthStorage(key);
    const current = createGenerationAuthStorage();
    const login = current.setItem(
      key,
      JSON.stringify({ access_token: "synthetic-new-queued-session" }),
    );
    releaseWrite();
    await write;
    assert.equal(await retired.retiredAccessToken, "synthetic-old-inflight-session");
    await retired.cleanup;
    await login;
    assert.equal(currentTokenWrites, 1);
    assert.equal(
      JSON.parse((await current.getItem(key))!).access_token,
      "synthetic-new-queued-session",
    );
    await old.removeItem(key);
    assert.ok(await current.getItem(key));
  } finally {
    releaseWrite();
    await retireAuthStorage(key).cleanup;
    __internal.setStorageAdaptersForTests(null, null);
    if (previousDisable === undefined) delete process.env.HUNGRY_DISABLE_SECURE_STORE;
    else process.env.HUNGRY_DISABLE_SECURE_STORE = previousDisable;
  }
});

test("a persisted retirement marker prevents cold-start-equivalent stale credential restoration", async () => {
  const { __internal } = await import("./authStorage");
  const previousDisable = process.env.HUNGRY_DISABLE_SECURE_STORE;
  process.env.HUNGRY_DISABLE_SECURE_STORE = "0";
  const key = "cold-marker-qa-token";
  const marker = "hungry-auth-retirement-v1";
  // Seed exactly the persisted state a new process would find after failed purge;
  // no retireAuthStorage call establishes a process-local blocked flag here.
  const data = new Map([
    [key, JSON.stringify({ access_token: "synthetic-retired-cold-token" })],
    [marker, JSON.stringify([key])],
  ]);
  let refuseDeletion = true;
  __internal.setStorageAdaptersForTests(
    {
      getItemAsync: async (name) => data.get(name) ?? null,
      setItemAsync: async (name, value) => {
        data.set(name, value);
      },
      deleteItemAsync: async (name) => {
        if (!refuseDeletion) data.delete(name);
      },
    },
    null,
  );
  try {
    const coldAdapter = createGenerationAuthStorage();
    await assert.rejects(coldAdapter.getItem(key), /could not be removed/);
    await assert.rejects(
      coldAdapter.setItem(key, "new-login-before-purge"),
      /could not be removed/,
    );
    refuseDeletion = false;
    assert.equal(await coldAdapter.getItem(key), null);
    assert.equal(data.has(key), false);
    assert.equal(data.has(marker), false);
    await coldAdapter.setItem(key, "new-login-after-purge");
    assert.equal(await coldAdapter.getItem(key), "new-login-after-purge");
    data.set(marker, "malformed-retirement-marker");
    await assert.rejects(coldAdapter.getItem(key), /recovery is required/);
    await assert.rejects(coldAdapter.setItem(key, "must-stay-blocked"), /recovery is required/);
  } finally {
    refuseDeletion = false;
    await retireAuthStorage(key).cleanup;
    __internal.setStorageAdaptersForTests(null, null);
    if (previousDisable === undefined) delete process.env.HUNGRY_DISABLE_SECURE_STORE;
    else process.env.HUNGRY_DISABLE_SECURE_STORE = previousDisable;
  }
});
