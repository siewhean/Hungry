// Typeahead and place search are best effort: an unavailable live catalog falls back to the
// Excel catalogue only for a signed-in session; a signed-out session or a non-availability
// error gives an empty list instead of throwing.
import assert from "node:assert/strict";
import test from "node:test";

import { CatalogUnavailableError } from "@/lib/services/catalog";
import type { catalogRawService } from "@/lib/services/catalog";
import { createResilientCatalogReadService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

type CatalogReadService = typeof catalogRawService;

const unavailable = () =>
  new CatalogUnavailableError(undefined, new TypeError("Network request failed"));

function services(primaryError: () => unknown) {
  const calls: string[] = [];
  const primary = {
    clearCache() {},
    async suggest() {
      throw primaryError();
    },
    async listPlaces() {
      throw primaryError();
    },
  } as unknown as CatalogReadService;
  const fallback = {
    clearCache() {},
    async suggest(prefix: string) {
      calls.push(`suggest:${prefix}`);
      return [{ id: "fallback-suggestion" }];
    },
    async listPlaces() {
      calls.push("listPlaces");
      return [{ id: "fallback-place" }];
    },
  } as unknown as CatalogReadService;
  return { service: createResilientCatalogReadService(primary, fallback), calls };
}

async function withSession(signedIn: boolean, run: () => Promise<void>) {
  const previous = useSessionStore.getState();
  try {
    useSessionStore.setState(
      signedIn
        ? {
            isAuthReady: true,
            isAuthenticated: true,
            authenticatedUserId: "00000000-0000-4000-8000-000000000001",
            authDataSource: "supabase",
          }
        : { isAuthReady: true, isAuthenticated: false, authenticatedUserId: null },
    );
    await run();
  } finally {
    useSessionStore.setState(previous);
  }
}

test("a signed-in session falls back when the live catalog is unavailable", async () => {
  await withSession(true, async () => {
    const { service, calls } = services(unavailable);
    assert.deepEqual(await service.suggest("ch"), [{ id: "fallback-suggestion" }]);
    assert.deepEqual(await service.listPlaces({} as never), [{ id: "fallback-place" }]);
    assert.deepEqual(calls, ["suggest:ch", "listPlaces"]);
  });
});

test("a signed-out session gets an empty list, not the fallback", async () => {
  await withSession(false, async () => {
    const { service, calls } = services(unavailable);
    assert.deepEqual(await service.suggest("ch"), []);
    assert.deepEqual(await service.listPlaces({} as never), []);
    assert.deepEqual(calls, []);
  });
});

test("an error that is not an availability failure gives an empty list", async () => {
  await withSession(true, async () => {
    const { service, calls } = services(() => new Error("bad request"));
    assert.deepEqual(await service.suggest("ch"), []);
    assert.deepEqual(calls, []);
  });
});
