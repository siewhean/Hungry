import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import ts from "typescript";
import type { PersistStorage } from "zustand/middleware";

const nodeRequire = createRequire(import.meta.url);
const oldValue = { state: { revision: 1 }, version: 0 };
const newValue = { state: { revision: 2 }, version: 0 };
function platformStorage() {
  const values = new Map<string, string>();
  const failures = { write: false, remove: false };
  return {
    values,
    failures,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      if (failures.write) throw new Error("storage write unavailable");
      values.set(key, value);
    },
    async removeItem(key: string) {
      if (failures.remove) throw new Error("storage deletion unavailable");
      values.delete(key);
    },
  };
}
function loadAdapter(
  kind: "persistStorage" | "secureStorage",
  asyncStorage: ReturnType<typeof platformStorage>,
  secureStorage?: ReturnType<typeof platformStorage>,
) {
  const module = { exports: {} as Record<string, PersistStorage<unknown>> };
  const js = ts.transpileModule(readFileSync(new URL(`./${kind}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    module,
    exports: module.exports,
    process: { env: {} },
    Promise,
    require: (name: string) => {
      if (name === "@react-native-async-storage/async-storage") return { default: asyncStorage };
      if (name === "expo-secure-store") {
        if (!secureStorage) throw new Error("SecureStore unavailable");
        return {
          getItemAsync: secureStorage.getItem,
          setItemAsync: secureStorage.setItem,
          deleteItemAsync: secureStorage.removeItem,
        };
      }
      return nodeRequire(name);
    },
  });
  return module.exports[
    kind === "secureStorage" ? "hungrySecurePersistStorage" : "hungryPersistStorage"
  ];
}

test("secure legacy migration preserves the only durable copy without SecureStore, including restart", async () => {
  const legacy = platformStorage();
  legacy.values.set("migration", JSON.stringify(oldValue));
  const first = loadAdapter("secureStorage", legacy);
  assert.deepEqual(await first.getItem("migration"), oldValue);
  assert.deepEqual(await first.getItem("migration"), oldValue);
  assert.ok(legacy.values.has("migration"));
  assert.deepEqual(await loadAdapter("secureStorage", legacy).getItem("migration"), oldValue);
});

test("secure migration retires legacy data only after a successful write", async () => {
  const legacy = platformStorage();
  const secure = platformStorage();
  legacy.values.set("migration", JSON.stringify(oldValue));
  secure.failures.write = true;
  const adapter = loadAdapter("secureStorage", legacy, secure);
  assert.deepEqual(await adapter.getItem("migration"), oldValue);
  assert.ok(legacy.values.has("migration"));
  secure.failures.write = false;
  assert.deepEqual(await adapter.getItem("migration"), oldValue);
  assert.equal(legacy.values.has("migration"), false);
  assert.equal(secure.values.get("migration"), JSON.stringify(oldValue));
});

test("secure fallback outranks stale primary across restart and synchronizes on recovery", async () => {
  const legacy = platformStorage();
  const secure = platformStorage();
  secure.values.set("fallback", JSON.stringify(oldValue));
  secure.failures.write = true;
  const adapter = loadAdapter("secureStorage", legacy, secure);
  await adapter.setItem("fallback", newValue);
  assert.deepEqual(await adapter.getItem("fallback"), newValue);
  assert.equal(secure.values.get("fallback"), JSON.stringify(oldValue));
  const restarted = loadAdapter("secureStorage", legacy, secure);
  assert.deepEqual(await restarted.getItem("fallback"), newValue);
  secure.failures.write = false;
  assert.deepEqual(await restarted.getItem("fallback"), newValue);
  assert.deepEqual(
    await loadAdapter("secureStorage", legacy, secure).getItem("fallback"),
    newValue,
  );
  assert.equal(legacy.values.has("hungry-secure-fallback-v1:fallback"), false);
});

test("healthy secure writes do not copy private values into fallback storage", async () => {
  const legacy = platformStorage();
  const secure = platformStorage();
  await loadAdapter("secureStorage", legacy, secure).setItem("healthy", newValue);
  assert.equal(legacy.values.size, 0);
  assert.equal(secure.values.get("healthy"), JSON.stringify(newValue));
});

test("app metadata fallback remains authoritative until durable writes recover", async () => {
  const primary = platformStorage();
  primary.values.set("fallback", JSON.stringify(oldValue));
  primary.failures.write = true;
  const adapter = loadAdapter("persistStorage", primary);
  await adapter.setItem("fallback", newValue);
  assert.deepEqual(await adapter.getItem("fallback"), newValue);
  assert.equal(primary.values.get("fallback"), JSON.stringify(oldValue));
  primary.failures.write = false;
  assert.deepEqual(await adapter.getItem("fallback"), newValue);
  assert.deepEqual(await loadAdapter("persistStorage", primary).getItem("fallback"), newValue);
});

test("failed deletion remains authoritative and does not resurrect a legacy copy", async () => {
  const primary = platformStorage();
  const legacy = platformStorage();
  primary.values.set("deleted", JSON.stringify(oldValue));
  legacy.values.set("deleted", JSON.stringify(oldValue));
  primary.failures.remove = true;
  legacy.failures.remove = true;
  const adapter = loadAdapter("persistStorage", primary, legacy);
  await adapter.removeItem?.("deleted");
  assert.equal(await adapter.getItem("deleted"), null);
  primary.failures.remove = false;
  assert.equal(await adapter.getItem("deleted"), null);
  legacy.failures.remove = false;
  assert.equal(await adapter.getItem("deleted"), null);
  assert.equal(await adapter.getItem("deleted"), null);
  assert.equal(legacy.values.has("deleted"), false);
});

test("secure deletion tombstone survives restart while the primary deletion fails", async () => {
  const fallback = platformStorage();
  const secure = platformStorage();
  secure.values.set("deleted", JSON.stringify(oldValue));
  secure.failures.remove = true;
  await loadAdapter("secureStorage", fallback, secure).removeItem?.("deleted");
  const restarted = loadAdapter("secureStorage", fallback, secure);
  assert.equal(await restarted.getItem("deleted"), null);
  secure.failures.remove = false;
  assert.equal(await restarted.getItem("deleted"), null);
  assert.equal(await loadAdapter("secureStorage", fallback, secure).getItem("deleted"), null);
});
