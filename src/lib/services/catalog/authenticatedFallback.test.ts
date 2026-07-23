import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CatalogAuthenticationRequiredError,
  CatalogConfigurationError,
  CatalogNetworkError,
  CatalogRpcError,
  CatalogSessionInvalidError,
  CatalogUnavailableError,
  isCatalogAuthenticationError,
  isCatalogFallbackEligibleError,
} from "@/lib/services/catalog";
import {
  getCatalogRawService,
  resetServiceProvider,
  setExcelServiceProvider,
} from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("only availability errors are eligible for read-only Excel fallback", () => {
  assert.equal(isCatalogFallbackEligibleError(new CatalogNetworkError()), true);
  assert.equal(isCatalogFallbackEligibleError(new CatalogRpcError()), true);
  assert.equal(isCatalogFallbackEligibleError(new CatalogUnavailableError()), true);

  assert.equal(isCatalogFallbackEligibleError(new CatalogAuthenticationRequiredError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogSessionInvalidError()), false);
  assert.equal(isCatalogFallbackEligibleError(new CatalogConfigurationError()), false);
});

test("authentication and invalid-session errors are distinguishable from outages", () => {
  assert.equal(isCatalogAuthenticationError(new CatalogAuthenticationRequiredError()), true);
  assert.equal(isCatalogAuthenticationError(new CatalogSessionInvalidError()), true);
  assert.equal(isCatalogAuthenticationError(new CatalogNetworkError()), false);
  assert.equal(isCatalogAuthenticationError(new CatalogConfigurationError()), false);
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
    /async getDish\(id, releaseId\) \{[\s\S]*?isExcelFallbackRelease\(releaseId\)[\s\S]*?requireAuthenticatedCatalogFallbackSession\(\)[\s\S]*?fallback\.getDish\(id, releaseId\)/,
  );
  assert.match(
    provider,
    /async getVenue\(id, releaseId\) \{[\s\S]*?isExcelFallbackRelease\(releaseId\)[\s\S]*?requireAuthenticatedCatalogFallbackSession\(\)[\s\S]*?fallback\.getVenue\(id, releaseId\)/,
  );
  assert.match(
    provider,
    /async listVenueMenu\(venueId, request = \{\}\) \{[\s\S]*?isExcelFallbackRelease\(request\.releaseId\)[\s\S]*?requireAuthenticatedCatalogFallbackSession\(\)[\s\S]*?fallback\.listVenueMenu\(venueId, request\)/,
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
