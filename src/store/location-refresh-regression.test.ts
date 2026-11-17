import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { URL } from "node:url";
import ts from "typescript";
import { create } from "zustand";
import { buildings } from "@/lib/services/mock/data";
import type { useLocationStore } from "./useLocationStore";

test("CR-S09: a new grant releases the obsolete refresh slot without clearing a newer refresh", async () => {
  let finishObsolete!: (value: { coords: (typeof buildings)[number]["coordinate"] }) => void;
  let finishNewer!: (value: { coords: (typeof buildings)[number]["coordinate"] }) => void;
  let positions = 0;
  const coordinate = buildings[0].coordinate;
  const location = {
    Accuracy: { Balanced: 1 },
    requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
    getForegroundPermissionsAsync: async () => ({ status: "granted" }),
    getCurrentPositionAsync: () => {
      positions += 1;
      if (positions === 1)
        return new Promise((resolve) => {
          finishObsolete = resolve;
        });
      if (positions === 2) return Promise.resolve({ coords: coordinate });
      return new Promise((resolve) => {
        finishNewer = resolve;
      });
    },
  };
  const source = readFileSync(new URL("./useLocationStore.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => {
      if (name === "zustand") return { create };
      if (name === "zustand/middleware") return { persist: (initializer: unknown) => initializer };
      if (name === "expo-location") return location;
      if (name === "@/lib/analytics") return { trackAnalyticsEvent: () => undefined };
      if (name === "./persistStorage") return { hungryPersistStorage: undefined };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    Date,
  });
  const store = exports.useLocationStore as typeof useLocationStore;
  store.setState({ permission: "granted", lastLocationFixAt: 0 });
  const obsolete = store.getState().refreshLocation();
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(positions, 1);
  assert.equal(await store.getState().grantLocation(), true);
  store.setState({ lastLocationFixAt: 0 });
  const newer = store.getState().refreshLocation();
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(positions, 3);
  finishObsolete({ coords: coordinate });
  assert.equal(await obsolete, false);
  // Finishing the invalidated request must not release this current request.
  assert.equal(store.getState().refreshLocation(), newer);
  finishNewer({ coords: coordinate });
  assert.equal(await newer, true);
});
