import assert from "node:assert/strict";
import test from "node:test";

import { CatalogNetworkError, CatalogRpcError } from "@/lib/services/catalog";
import { createResilientDiscoveryService } from "@/lib/services/serviceProvider";
import type { HungryService } from "@/lib/services/types";
import { excelService } from "@/lib/services/excel/excelService";
import { useSessionStore } from "@/store/useSessionStore";

type Discovery = HungryService["discovery"];
type Method = keyof Discovery;

// The reads that fall back to the bundled Excel catalog when the live one is unreachable.
const FALLBACK_METHODS = [
  "listBuildings",
  "countVenuesInArea",
  "getVenue",
  "listVenuesByBuilding",
  "getDish",
  "listDishesByVenue",
  "listPopularNearby",
  "listDiscoveryFeedByLocation",
  "searchVenuesByLocation",
  "searchDishes",
  "decideForMe",
] as const satisfies readonly Method[];

const SIGNED_IN = {
  isAuthReady: true,
  isAuthenticated: true,
  authenticatedUserId: "00000000-0000-4000-8000-000000000001",
  authDataSource: "supabase" as const,
};

/** Stubs `excelService.discovery[method]` for the test and restores it afterwards. */
function stubFallback(calls: string[]) {
  const target = excelService.discovery as unknown as Record<string, unknown>;
  const originals: Record<string, unknown> = {};
  for (const method of FALLBACK_METHODS) {
    originals[method] = target[method];
    target[method] = async () => {
      calls.push(method);
      return `excel:${method}`;
    };
  }
  return () => Object.assign(target, originals);
}

function primaryThat(behaviour: (method: string) => unknown, calls: string[]) {
  const primary: Record<string, unknown> = { untouched: "kept" };
  for (const method of FALLBACK_METHODS) {
    primary[method] = async () => {
      calls.push(method);
      return behaviour(method);
    };
  }
  return primary as unknown as Discovery;
}

test("every discovery read uses the live catalog while it answers", async () => {
  const previous = useSessionStore.getState();
  const primaryCalls: string[] = [];
  const fallbackCalls: string[] = [];
  const restore = stubFallback(fallbackCalls);
  try {
    useSessionStore.setState(SIGNED_IN);
    const service = createResilientDiscoveryService(
      primaryThat((method) => `live:${method}`, primaryCalls),
    );
    for (const method of FALLBACK_METHODS) {
      assert.equal(await (service[method] as unknown as () => Promise<string>)(), `live:${method}`);
    }
    assert.deepEqual(primaryCalls, [...FALLBACK_METHODS]);
    assert.deepEqual(fallbackCalls, []);
    assert.equal((service as unknown as Record<string, unknown>).untouched, "kept");
  } finally {
    restore();
    useSessionStore.setState(previous);
  }
});

test("every discovery read falls back to Excel when the live catalog is unreachable", async () => {
  const previous = useSessionStore.getState();
  const primaryCalls: string[] = [];
  const fallbackCalls: string[] = [];
  const restore = stubFallback(fallbackCalls);
  try {
    useSessionStore.setState(SIGNED_IN);
    const service = createResilientDiscoveryService(
      primaryThat(() => {
        throw new CatalogNetworkError();
      }, primaryCalls),
    );
    for (const method of FALLBACK_METHODS) {
      assert.equal(
        await (service[method] as unknown as () => Promise<string>)(),
        `excel:${method}`,
      );
    }
    assert.deepEqual(fallbackCalls, [...FALLBACK_METHODS]);
  } finally {
    restore();
    useSessionStore.setState(previous);
  }
});

test("a discovery failure that is not an outage is thrown, not hidden behind Excel", async () => {
  const previous = useSessionStore.getState();
  const fallbackCalls: string[] = [];
  const restore = stubFallback(fallbackCalls);
  try {
    useSessionStore.setState(SIGNED_IN);
    const service = createResilientDiscoveryService(
      primaryThat(() => {
        throw new CatalogRpcError("bad request");
      }, []),
    );
    await assert.rejects(
      (service.searchDishes as unknown as (query: string) => Promise<unknown>)("laksa"),
      /bad request/,
    );
    assert.deepEqual(fallbackCalls, []);
  } finally {
    restore();
    useSessionStore.setState(previous);
  }
});

test("the Excel fallback needs a signed-in session", async () => {
  const previous = useSessionStore.getState();
  const fallbackCalls: string[] = [];
  const restore = stubFallback(fallbackCalls);
  try {
    useSessionStore.setState({ ...SIGNED_IN, isAuthenticated: false, authenticatedUserId: null });
    const service = createResilientDiscoveryService(
      primaryThat(() => {
        throw new CatalogNetworkError();
      }, []),
    );
    await assert.rejects(service.listBuildings(), /Sign in with a valid Hungry account/);
    assert.deepEqual(fallbackCalls, []);
  } finally {
    restore();
    useSessionStore.setState(previous);
  }
});
