import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CatalogAuthenticationRequiredError,
  CatalogAuthorizationError,
  CatalogConfigurationError,
  CatalogContractError,
  CatalogNetworkError,
  CatalogRpcError,
  CatalogSessionInvalidError,
  CatalogUnavailableError,
  classifyCatalogAccessError,
  isCatalogAuthenticationError,
  isCatalogFallbackEligibleError,
} from "@/lib/services/catalog";
import {
  getCatalogRawService,
  resetServiceProvider,
  runAuthenticatedDiscoveryFallback,
  setExcelServiceProvider,
} from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("only availability errors are eligible for read-only Excel fallback", () => {
  assert.equal(isCatalogFallbackEligibleError(new CatalogNetworkError()), true);
  assert.equal(isCatalogFallbackEligibleError(new CatalogUnavailableError()), true);

  assert.equal(isCatalogFallbackEligibleError(new CatalogRpcError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogAuthenticationRequiredError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogSessionInvalidError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogAuthorizationError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogConfigurationError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogContractError()), false);
});

test("authentication and invalid-session errors are distinguishable from outages", () => {
  assert.equal(isCatalogAuthenticationError(new CatalogAuthenticationRequiredError()), true);
  assert.equal(isCatalogAuthenticationError(new CatalogSessionInvalidError()), true);
  assert.equal(isCatalogAuthenticationError(new CatalogNetworkError()), false);
  assert.equal(isCatalogAuthenticationError(new CatalogConfigurationError()), false);
});

test("catalog error classification only marks explicit transient failures fallback-eligible", () => {
  const invalidJwt = Object.assign(new Error("JWT expired"), { status: 401 });
  const rlsDenied = Object.assign(new Error("new row violates row-level security policy"), {
    status: 403,
  });
  const invalidRequest = Object.assign(new Error("invalid request"), { status: 400 });
  const serviceUnavailable = Object.assign(new Error("service unavailable"), { status: 503 });

  assert.ok(classifyCatalogAccessError(invalidJwt, "rpc") instanceof CatalogSessionInvalidError);
  assert.ok(classifyCatalogAccessError(rlsDenied, "rpc") instanceof CatalogAuthorizationError);
  assert.ok(classifyCatalogAccessError(invalidRequest, "rpc") instanceof CatalogContractError);
  assert.ok(classifyCatalogAccessError(serviceUnavailable, "rpc") instanceof CatalogNetworkError);
  assert.equal(
    isCatalogFallbackEligibleError(classifyCatalogAccessError(serviceUnavailable, "rpc")),
    true,
  );
});

test("unknown discovery exceptions propagate instead of switching to Excel", async () => {
  const unknown = new Error("unexpected invariant violation");
  let fallbackCalled = false;

  await assert.rejects(
    runAuthenticatedDiscoveryFallback(
      async () => {
        throw unknown;
      },
      async () => {
        fallbackCalled = true;
        return "excel";
      },
    ),
    (error: unknown) => error === unknown,
  );
  assert.equal(fallbackCalled, false);
});

test("a successful discovery no-result is authoritative and does not switch to Excel", async () => {
  let fallbackCalled = false;

  const result = await runAuthenticatedDiscoveryFallback(
    async () => undefined,
    async () => {
      fallbackCalled = true;
      return "excel";
    },
  );

  assert.equal(result, undefined);
  assert.equal(fallbackCalled, false);
});

test("RLS failures preserve a valid session and do not switch to Excel", async () => {
  const previousSession = useSessionStore.getState();
  let fallbackCalled = false;
  try {
    useSessionStore.setState({
      isAuthReady: true,
      isAuthenticated: true,
      authenticatedUserId: "00000000-0000-4000-8000-000000000001",
      authDataSource: "supabase",
    });

    await assert.rejects(
      runAuthenticatedDiscoveryFallback(
        async () => {
          throw Object.assign(new Error("permission denied for relation catalog_dish_cards"), {
            status: 403,
            code: "42501",
          });
        },
        async () => {
          fallbackCalled = true;
          return "excel";
        },
      ),
      (error: unknown) => error instanceof CatalogAuthorizationError,
    );

    assert.equal(fallbackCalled, false);
    assert.equal(useSessionStore.getState().isAuthenticated, true);
  } finally {
    useSessionStore.setState(previousSession);
  }
});

test("authenticated timeout and network errors switch to the read-only Excel fallback", async () => {
  const previousSession = useSessionStore.getState();
  let fallbackCalled = false;
  try {
    useSessionStore.setState({
      isAuthReady: true,
      isAuthenticated: true,
      authenticatedUserId: "00000000-0000-4000-8000-000000000001",
      authDataSource: "supabase",
    });

    const result = await runAuthenticatedDiscoveryFallback(
      async () => {
        throw Object.assign(new Error("network request timed out"), { code: "ETIMEDOUT" });
      },
      async () => {
        fallbackCalled = true;
        return "excel";
      },
    );

    assert.equal(result, "excel");
    assert.equal(fallbackCalled, true);
  } finally {
    useSessionStore.setState(previousSession);
  }
});

test("the resilient service requires a real restored Supabase session before fallback", () => {
  const provider = read("src/lib/services/serviceProvider.ts");

  assert.match(provider, /state\.isAuthReady/);
  assert.match(provider, /state\.isAuthenticated/);
  assert.match(provider, /state\.authDataSource === "supabase"/);
  assert.match(provider, /UUID_PATTERN\.test\(state\.authenticatedUserId\)/);
  assert.match(provider, /requireAuthenticatedCatalogFallbackSession\(\)/);
  assert.match(provider, /isCatalogFallbackEligibleError/);
  assert.match(provider, /expireRejectedSession/);
  assert.doesNotMatch(provider, /if \(result !== undefined\)/);
});

test("a signed-out user cannot access the Excel catalog fallback", () => {
  const previousSession = useSessionStore.getState();
  const previousEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

  try {
    if (previousEnvironment === "production") delete process.env.EXPO_PUBLIC_APP_ENV;
    useSessionStore.setState({
      isAuthReady: true,
      isAuthenticated: false,
      authenticatedUserId: null,
      authDataSource: null,
    });
    resetServiceProvider();
    setExcelServiceProvider();

    assert.throws(
      () => getCatalogRawService(),
      (error: unknown) => error instanceof CatalogAuthenticationRequiredError,
    );
  } finally {
    useSessionStore.setState(previousSession);
    if (previousEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = previousEnvironment;
    resetServiceProvider();
  }
});

test("fallback detail and venue-menu requests remain on the originating Excel source", () => {
  const provider = read("src/lib/services/serviceProvider.ts");

  assert.match(
    provider,
    /async getDish\(id, releaseId\) \{[\s\S]*?isExcelFallbackRelease\(releaseId\)[\s\S]*?requireAuthenticatedCatalogFallbackSession\(\)[\s\S]*?getFallback\(\)\.getDish\(id, releaseId\)/,
  );
  assert.match(
    provider,
    /async getVenue\(id, releaseId\) \{[\s\S]*?isExcelFallbackRelease\(releaseId\)[\s\S]*?requireAuthenticatedCatalogFallbackSession\(\)[\s\S]*?getFallback\(\)\.getVenue\(id, releaseId\)/,
  );
  assert.match(
    provider,
    /async listVenueMenu\(venueId, request = \{\}\) \{[\s\S]*?runPagedCatalogRead\([\s\S]*?getFallback\(\)\.listVenueMenu\(venueId, request\)/,
  );
  assert.match(
    provider,
    /function runPagedCatalogRead[\s\S]*?isExcelFallbackRelease\(request\.releaseId\) \|\| isExcelCatalogCursor\(request\.cursor\)[\s\S]*?requireAuthenticatedCatalogFallbackSession\(\)[\s\S]*?return fallback\(\)/,
  );
});

test("successful empty online pages are not replaced by unrelated Excel records", () => {
  const provider = read("src/lib/services/serviceProvider.ts");

  assert.match(provider, /A successful empty result is authoritative/);
  assert.doesNotMatch(provider, /result\.items\.length\s*\|\|\s*result\.releaseId/);
  assert.doesNotMatch(provider, /hasItems\s*\|\|\s*result\.releaseId/);
});

test("the Excel adapter exposes only catalog read methods", () => {
  const fallback = read("src/lib/services/catalog/excelFallback.ts");

  for (const method of [
    "listDishes",
    "listVenues",
    "getDish",
    "getVenue",
    "listVenueMenu",
    "getMapViewport",
  ]) {
    assert.match(fallback, new RegExp(`async ${method}\\b`));
  }

  assert.doesNotMatch(
    fallback,
    /submitReview|postBite|toggleFavourite|followUser|createComment|updateProfile|addDish|editDish/,
  );
});
