import assert from "node:assert/strict";
import test from "node:test";

import { CatalogNetworkError, CatalogRpcError } from "@/lib/services/catalog";
import { createResilientDiscoveryService } from "@/lib/services/serviceProvider";
import { CatalogReadError } from "@/lib/services/catalogReads";
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
  "searchVenuesByLocation",
  "searchDishes",
  "decideForMe",
] as const satisfies readonly Method[];

const STRICT_METHODS = [
  "listDiscoveryFeedByLocation",
  "getDishDetail",
  "getStallHeader",
  "getStallLegacyMenuPage",
] as const satisfies readonly Method[];

const DISCOVERY_METHODS = [...FALLBACK_METHODS, ...STRICT_METHODS] as const;

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
  for (const method of DISCOVERY_METHODS) {
    originals[method] = target[method];
    target[method] = async () => {
      calls.push(method);
      return `excel:${method}`;
    };
  }
  return () => {
    for (const method of DISCOVERY_METHODS) {
      if (originals[method] === undefined) delete target[method];
      else target[method] = originals[method];
    }
  };
}

function primaryThat(behaviour: (method: string) => unknown, calls: string[]) {
  const primary: Record<string, unknown> = { untouched: "kept" };
  for (const method of DISCOVERY_METHODS) {
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
    for (const method of DISCOVERY_METHODS) {
      assert.equal(await (service[method] as unknown as () => Promise<string>)(), `live:${method}`);
    }
    assert.deepEqual(primaryCalls, [...DISCOVERY_METHODS]);
    assert.deepEqual(fallbackCalls, []);
    assert.equal((service as unknown as Record<string, unknown>).untouched, "kept");
  } finally {
    restore();
    useSessionStore.setState(previous);
  }
});

test("legacy discovery reads fall back to Excel when the live catalog is unreachable", async () => {
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

test("strict catalog reads preserve outage and rate-limit errors without reading Excel", async () => {
  const previous = useSessionStore.getState();
  const fallbackCalls: string[] = [];
  const restore = stubFallback(fallbackCalls);
  try {
    useSessionStore.setState(SIGNED_IN);
    for (const failure of [
      new CatalogNetworkError(),
      new CatalogReadError("statement timeout", "timeout", 504, "57014"),
      new CatalogReadError("rate limited", "rate-limit", 429, "PT429"),
    ]) {
      const primaryCalls: string[] = [];
      const service = createResilientDiscoveryService(
        primaryThat(() => {
          throw failure;
        }, primaryCalls),
      );
      for (const method of STRICT_METHODS) {
        await assert.rejects(
          service[method]?.("fixture" as never) as Promise<unknown>,
          (error: unknown) => error === failure,
        );
      }
      assert.deepEqual(primaryCalls, [...STRICT_METHODS]);
    }
    assert.deepEqual(fallbackCalls, []);
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
