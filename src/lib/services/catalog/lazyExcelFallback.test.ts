import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type { CatalogPage, catalogRawService } from "@/lib/services/catalog";
import { createResilientCatalogReadService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

type CatalogReadService = typeof catalogRawService;

const nodeRequire = createRequire(import.meta.url ?? __filename);
const loadedFallback = () =>
  Object.keys(nodeRequire.cache ?? {}).some((path) => path.includes("catalog/excelFallback"));

test("the default Excel fallback is not loaded while the live catalog answers", async () => {
  const page = { items: [], releaseId: "release-uuid" } as unknown as CatalogPage<never>;
  const primary = {
    clearCache() {},
    async listDishes() {
      return page;
    },
  } as unknown as CatalogReadService;

  const previous = useSessionStore.getState();
  try {
    useSessionStore.setState({
      isAuthReady: true,
      isAuthenticated: true,
      authenticatedUserId: "00000000-0000-4000-8000-000000000001",
      authDataSource: "supabase",
    });
    const service = createResilientCatalogReadService(primary);
    service.clearCache();
    assert.equal(await service.listDishes({}), page);
    assert.equal(loadedFallback(), false, "excelFallback must stay unloaded on the live path");
  } finally {
    useSessionStore.setState(previous);
  }
});
