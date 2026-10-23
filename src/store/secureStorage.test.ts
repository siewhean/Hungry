// The secure-storage ladder: SecureStore first, then localStorage (local web only), then the
// legacy AsyncStorage (migrated into SecureStore on read), then memory. Tokens must not land in
// a weaker store than the best one that works.

import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

type Fake = Map<string, string>;

const secureValues: Fake = new Map();
const legacyValues: Fake = new Map();
const calls: string[] = [];
let secureBroken = false;

const fakeSecureStore = {
  getItemAsync: async (key: string) => {
    calls.push(`secure.get:${key}`);
    if (secureBroken) throw new Error("keychain locked");
    return secureValues.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    calls.push(`secure.set:${key}`);
    if (secureBroken) throw new Error("keychain locked");
    secureValues.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    calls.push(`secure.delete:${key}`);
    if (secureBroken) throw new Error("keychain locked");
    secureValues.delete(key);
  },
};

const fakeAsyncStorage = {
  default: {
    getItem: async (key: string) => legacyValues.get(key) ?? null,
    setItem: async (key: string, value: string) => void legacyValues.set(key, value),
    removeItem: async (key: string) => void legacyValues.delete(key),
  },
};

const moduleInternals = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = moduleInternals._load;
moduleInternals._load = function load(request: string, ...rest: unknown[]) {
  if (request === "expo-secure-store") return fakeSecureStore;
  if (request === "@react-native-async-storage/async-storage") return fakeAsyncStorage;
  return originalLoad.call(this, request, ...rest);
};

delete process.env.HUNGRY_DISABLE_SECURE_STORE;
delete process.env.HUNGRY_DISABLE_ASYNC_STORAGE;

let storage: NonNullable<typeof import("./secureStorage").hungrySecurePersistStorage>;

before(async () => {
  storage = (await import("./secureStorage")).hungrySecurePersistStorage!;
});

beforeEach(() => {
  secureValues.clear();
  legacyValues.clear();
  calls.length = 0;
  secureBroken = false;
});

const KEY = "hungry-session-test";
const read = async () => (await storage.getItem(KEY)) as { state: unknown } | null;

test("values are written to SecureStore and read back as JSON", async () => {
  await storage.setItem(KEY, { state: { token: "abc" }, version: 1 });
  assert.ok(secureValues.has(KEY));
  assert.deepEqual(await read(), { state: { token: "abc" }, version: 1 });
  assert.equal(legacyValues.size, 0, "a working keychain means nothing is written to AsyncStorage");
});

test("a legacy AsyncStorage value is migrated into SecureStore and removed from AsyncStorage", async () => {
  legacyValues.set(KEY, JSON.stringify({ state: { token: "old" }, version: 0 }));
  assert.deepEqual(await read(), { state: { token: "old" }, version: 0 });
  assert.ok(secureValues.has(KEY), "migrated to SecureStore");
  assert.equal(legacyValues.has(KEY), false, "removed from the weaker store");
});

test("when SecureStore throws, writes fall back and reads still find the value", async () => {
  secureBroken = true;
  await storage.setItem(KEY, { state: { token: "fallback" }, version: 1 });
  assert.deepEqual(await read(), { state: { token: "fallback" }, version: 1 });
  assert.equal(secureValues.size, 0);
});

test("removeItem clears the value from SecureStore and the fallbacks", async () => {
  await storage.setItem(KEY, { state: {}, version: 1 });
  legacyValues.set(KEY, JSON.stringify({ state: {}, version: 1 }));
  await storage.removeItem(KEY);
  assert.equal(secureValues.has(KEY), false);
  assert.equal(await storage.getItem(KEY), null);
});

test("an unknown key reads as null", async () => {
  assert.equal(await storage.getItem("never-written"), null);
});
