import assert from "node:assert/strict";
import Module from "node:module";
import test, { beforeEach } from "node:test";

import { __internal, supabaseAuthStorage } from "@/lib/services/supabase/authStorage";

// The adapter reads these on every call; the shared test script turns both stores off.
delete process.env.HUNGRY_DISABLE_SECURE_STORE;
delete process.env.HUNGRY_DISABLE_ASYNC_STORAGE;
delete process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE;

const secure = new Map<string, string>();
const plain = new Map<string, string>();
let secureWritesFail = false;

const fakeSecureStore = {
  AFTER_FIRST_UNLOCK: "after-first-unlock",
  getItemAsync: async (key: string) => secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (secureWritesFail) throw new Error("keychain unavailable");
    secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secure.delete(key);
  },
};

const fakeAsyncStorage = {
  default: {
    getItem: async (key: string) => plain.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      plain.set(key, value);
    },
    removeItem: async (key: string) => {
      plain.delete(key);
    },
  },
};

type ModuleLoad = (request: string, ...rest: unknown[]) => unknown;
const moduleInternals = Module as unknown as { _load: ModuleLoad };
const originalLoad = moduleInternals._load;
moduleInternals._load = function patchedLoad(request: string, ...rest: unknown[]) {
  if (request === "expo-secure-store") return fakeSecureStore;
  if (request === "@react-native-async-storage/async-storage") return fakeAsyncStorage;
  return originalLoad.call(this, request, ...rest);
};

const KEY = "sb-session";

function chunkKeysOf(name: string) {
  return [...secure.keys()].filter((key) => new RegExp(`^${name}\\.c\\d+$`).test(key));
}

beforeEach(() => {
  secure.clear();
  plain.clear();
  secureWritesFail = false;
  delete process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE;
});

test("a short session round-trips through the secure store and never touches plaintext", async () => {
  await supabaseAuthStorage.setItem(KEY, "token-json");
  assert.equal(await supabaseAuthStorage.getItem(KEY), "token-json");
  assert.equal(plain.size, 0);
  assert.ok(secure.has(__internal.metaKey(KEY)));
});

test("values larger than one keychain slot are chunked and rejoined exactly", async () => {
  const value = "x".repeat(__internal.CHUNK_SIZE * 2 + 123);
  await supabaseAuthStorage.setItem(KEY, value);

  const chunkKeys = chunkKeysOf(KEY);
  assert.equal(chunkKeys.length, 3);
  for (const key of chunkKeys) {
    assert.ok((secure.get(key) ?? "").length <= __internal.CHUNK_SIZE);
  }
  assert.equal(await supabaseAuthStorage.getItem(KEY), value);
});

test("rewriting with a shorter value leaves no stale chunks behind", async () => {
  await supabaseAuthStorage.setItem(KEY, "y".repeat(__internal.CHUNK_SIZE * 3));
  await supabaseAuthStorage.setItem(KEY, "short");

  const chunkKeys = chunkKeysOf(KEY);
  assert.equal(chunkKeys.length, 1);
  assert.equal(await supabaseAuthStorage.getItem(KEY), "short");
});

test("an empty string is stored and read back as empty, not as missing", async () => {
  await supabaseAuthStorage.setItem(KEY, "");
  assert.equal(await supabaseAuthStorage.getItem(KEY), "");
});

test("a lost chunk reads as signed out and the broken entry is cleaned up", async () => {
  await supabaseAuthStorage.setItem(KEY, "z".repeat(__internal.CHUNK_SIZE * 2));
  secure.delete(__internal.chunkKey(KEY, 1));

  assert.equal(await supabaseAuthStorage.getItem(KEY), null);
  assert.equal(secure.size, 0);
});

test("a truncated entry (length mismatch) is discarded rather than returned", async () => {
  await supabaseAuthStorage.setItem(KEY, "a".repeat(__internal.CHUNK_SIZE + 10));
  secure.set(__internal.chunkKey(KEY, 1), "a");

  assert.equal(await supabaseAuthStorage.getItem(KEY), null);
  assert.equal(secure.size, 0);
});

test("corrupt chunk metadata falls back to the single-key form", async () => {
  secure.set(__internal.metaKey(KEY), "not json");
  secure.set(KEY, "old-single-value");
  assert.equal(await supabaseAuthStorage.getItem(KEY), "old-single-value");
});

test("a pre-upgrade AsyncStorage session migrates into the secure store and is deleted", async () => {
  plain.set(KEY, "legacy-session");

  assert.equal(await supabaseAuthStorage.getItem(KEY), "legacy-session");
  assert.equal(plain.has(KEY), false);
  assert.equal(await supabaseAuthStorage.getItem(KEY), "legacy-session");
  assert.ok(secure.has(__internal.metaKey(KEY)));
});

test("when the keychain fails in production, tokens stay in memory and never hit plaintext", async () => {
  assert.equal(__internal.canUsePlaintextTokenFallback(), false);
  secureWritesFail = true;

  await supabaseAuthStorage.setItem(KEY, "volatile-session");
  assert.equal(plain.size, 0);
  assert.equal(secure.size, 0);
  assert.equal(await supabaseAuthStorage.getItem(KEY), "volatile-session");

  await supabaseAuthStorage.removeItem(KEY);
  assert.equal(await supabaseAuthStorage.getItem(KEY), null);
});

test("a failed multi-chunk write rolls back so no half-written session can be read", async () => {
  secureWritesFail = true;
  await supabaseAuthStorage.setItem(KEY, "q".repeat(__internal.CHUNK_SIZE * 2));
  secureWritesFail = false;

  const stored = [...secure.keys()];
  assert.deepEqual(stored, []);
});

test("production writes remove any plaintext copy; the insecure flag keeps a dev mirror", async () => {
  plain.set(KEY, "stale-plaintext");
  await supabaseAuthStorage.setItem(KEY, "fresh");
  assert.equal(plain.has(KEY), false);

  process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE = "1";
  assert.equal(__internal.canUsePlaintextTokenFallback(), true);
  await supabaseAuthStorage.setItem(KEY, "dev-session");
  assert.equal(plain.get(KEY), "dev-session");
});

test("with the insecure flag and a dead keychain the session persists in AsyncStorage", async () => {
  process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE = "1";
  secureWritesFail = true;

  await supabaseAuthStorage.setItem(KEY, "dev-fallback");
  assert.equal(plain.get(KEY), "dev-fallback");
  assert.equal(await supabaseAuthStorage.getItem(KEY), "dev-fallback");
});

test("removeItem clears the secure store, chunks and plaintext", async () => {
  await supabaseAuthStorage.setItem(KEY, "r".repeat(__internal.CHUNK_SIZE * 2));
  plain.set(KEY, "leftover");

  await supabaseAuthStorage.removeItem(KEY);
  assert.equal(secure.size, 0);
  assert.equal(plain.size, 0);
  assert.equal(await supabaseAuthStorage.getItem(KEY), null);
});
