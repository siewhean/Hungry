import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogAccessError,
  CatalogAuthenticationRequiredError,
  CatalogAuthorizationError,
  CatalogConfigurationError,
  CatalogContractError,
  CatalogNetworkError,
  CatalogReleaseExpiredError,
  CatalogRpcError,
  CatalogSessionInvalidError,
  CatalogUnavailableError,
  classifyCatalogAccessError,
  isCatalogAuthenticationError,
  isCatalogFallbackEligibleError,
} from "./index";

const cases: [string, unknown, new (...args: never[]) => CatalogAccessError][] = [
  ["missing configuration", new Error("Supabase is not configured"), CatalogConfigurationError],
  ["config message", { message: "missing configuration: url" }, CatalogConfigurationError],
  ["401", { status: 401, message: "nope" }, CatalogSessionInvalidError],
  ["PGRST301", { code: "PGRST301", message: "x" }, CatalogSessionInvalidError],
  ["jwt code", { code: "bad_jwt", message: "x" }, CatalogSessionInvalidError],
  ["jwt expired", { message: "JWT expired" }, CatalogSessionInvalidError],
  ["invalid claim", { message: "invalid claim: missing sub" }, CatalogSessionInvalidError],
  ["refresh token", { message: "Invalid Refresh Token" }, CatalogSessionInvalidError],
  ["session not found", { message: "session_not_found" }, CatalogSessionInvalidError],
  ["403", { status: 403, message: "x" }, CatalogAuthorizationError],
  ["42501", { code: "42501", message: "x" }, CatalogAuthorizationError],
  ["rls", { message: "new row violates row-level security" }, CatalogAuthorizationError],
  ["not authorized", { message: "User not authorized" }, CatalogAuthorizationError],
  ["not authorised", { message: "not authorised" }, CatalogAuthorizationError],
  ["forbidden", { message: "Forbidden" }, CatalogAuthorizationError],
  ["503", { status: 503, message: "x" }, CatalogNetworkError],
  ["statement timeout", { code: "57014", message: "x" }, CatalogNetworkError],
  ["econnreset", { code: "ECONNRESET", message: "x" }, CatalogNetworkError],
  ["abort", { name: "AbortError", message: "x" }, CatalogNetworkError],
  ["timeout code", { code: "request_timeout", message: "x" }, CatalogNetworkError],
  ["failed to fetch", new Error("Failed to fetch"), CatalogNetworkError],
  ["fetch failed", { message: "fetch failed" }, CatalogNetworkError],
  ["timed out", { message: "Request timed out" }, CatalogNetworkError],
  ["timeout word", { message: "gateway timeout" }, CatalogNetworkError],
  ["aborted", { message: "The operation was aborted" }, CatalogNetworkError],
  ["socket", { message: "socket hang up" }, CatalogNetworkError],
  ["connection", { message: "connection reset by peer" }, CatalogNetworkError],
  ["22023", { code: "22023", message: "x" }, CatalogReleaseExpiredError],
  ["release gone", { message: "catalog release unavailable" }, CatalogReleaseExpiredError],
  ["cursor release", { message: "catalog cursor release mismatch" }, CatalogReleaseExpiredError],
  ["syntax", new SyntaxError("Unexpected token"), CatalogContractError],
  ["type", new TypeError("x is undefined"), CatalogContractError],
  ["400", { status: 400, message: "x" }, CatalogContractError],
  ["409", { status: 409, message: "x" }, CatalogContractError],
  ["422", { status: 422, message: "x" }, CatalogContractError],
  ["pgrst", { code: "PGRST202", message: "x" }, CatalogContractError],
  ["22P02", { code: "22P02", message: "x" }, CatalogContractError],
  ["failed to parse", { message: "failed to parse filter" }, CatalogContractError],
  ["parse error", { message: "JSON parse error" }, CatalogContractError],
  ["schema cache", { message: "not in the schema cache" }, CatalogContractError],
  ["missing function", { message: "function get_x() does not exist" }, CatalogContractError],
];

test("catalog failures are classified by status, code and message", () => {
  for (const [label, error, expected] of cases) {
    const classified = classifyCatalogAccessError(error, "rpc");
    assert.ok(classified instanceof expected, `${label} -> ${expected.name}`);
  }
});

test("an opaque failure is kept as it is, and a classified one passes through", () => {
  const opaque = { message: "something odd" };
  assert.equal(classifyCatalogAccessError(opaque, "session"), opaque);
  assert.equal(classifyCatalogAccessError(undefined, "session"), undefined);
  assert.equal(classifyCatalogAccessError("plain text", "rpc"), "plain text");
  const already = new CatalogUnavailableError();
  assert.equal(classifyCatalogAccessError(already, "rpc"), already);
});

test("only network and unavailable failures may fall back to the bundled catalog", () => {
  assert.equal(isCatalogFallbackEligibleError(new CatalogNetworkError()), true);
  assert.equal(isCatalogFallbackEligibleError(new CatalogUnavailableError()), true);
  for (const error of [
    new CatalogRpcError(),
    new CatalogContractError(),
    new CatalogAuthorizationError(),
    new CatalogConfigurationError(),
    new CatalogReleaseExpiredError(),
    new Error("plain"),
  ]) {
    assert.equal(isCatalogFallbackEligibleError(error), false, error.name);
  }
  assert.equal(isCatalogAuthenticationError(new CatalogAuthenticationRequiredError()), true);
  assert.equal(isCatalogAuthenticationError(new CatalogSessionInvalidError()), true);
  assert.equal(isCatalogAuthenticationError(new CatalogAuthorizationError()), false);
  const generic = new CatalogAccessError("x");
  assert.equal(generic.kind, "unavailable");
  assert.equal(generic.fallbackEligible, false);
  assert.equal(new CatalogRpcError("x", { code: "1" }).cause instanceof Object, true);
});
