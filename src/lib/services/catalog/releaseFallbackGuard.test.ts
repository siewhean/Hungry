// In a release bundle the Excel data is a stub. When the live catalog read fails, the fallback
// must answer with the retryable "unavailable" error WITHOUT loading excelFallback: loading it
// there throws inside Metro's module loader, which closes the app instead of raising an error
// the screens can catch.
import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

import { CatalogUnavailableError } from "@/lib/services/catalog";
import type { catalogRawService } from "@/lib/services/catalog";
import { createResilientCatalogReadService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

type CatalogReadService = typeof catalogRawService;
type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleInternals = Module as unknown as { _load: Loader };

test("a release bundle never loads the Excel fallback when the live read fails", async () => {
  const requested: string[] = [];
  const stub = new Proxy(
    {},
    { get: (_t, key) => (key === "__hungryReleaseStub" ? true : undefined) },
  );
  const original = moduleInternals._load;
  moduleInternals._load = function load(request, parent, isMain) {
    requested.push(request);
    // The Excel repositories come back as the release stub, as in a production bundle.
    if (request.includes("excel/repositories")) return stub;
    return original.call(this, request, parent, isMain);
  };

  const primary = {
    clearCache() {},
    async listVenues() {
      throw new CatalogUnavailableError(undefined, new TypeError("Network request failed"));
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
    await assert.rejects(() => service.listVenues({}), CatalogUnavailableError);
    assert.equal(
      requested.some((request) => request.includes("catalog/excelFallback")),
      false,
      "excelFallback must not be required when the Excel data is stubbed",
    );
  } finally {
    moduleInternals._load = original;
    useSessionStore.setState(previous);
  }
});
