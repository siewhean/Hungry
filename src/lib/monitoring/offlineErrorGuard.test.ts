import assert from "node:assert/strict";
import test from "node:test";

import {
  installOfflineErrorGuard,
  isConnectionError,
  type ErrorUtilsLike,
} from "./offlineErrorGuard";

function fakeErrorUtils() {
  const calls: unknown[] = [];
  let handler = (error: unknown) => {
    calls.push(error);
  };
  const utils: ErrorUtilsLike = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next) => {
      handler = next as typeof handler;
    },
  };
  return { utils, calls, fire: (error: unknown) => handler(error) };
}

test("connection failures are recognised by name, message and cause", () => {
  assert.equal(isConnectionError(new TypeError("Network request failed")), true);
  const unavailable = new Error("The online catalog is temporarily unavailable.");
  unavailable.name = "CatalogUnavailableError";
  assert.equal(isConnectionError(unavailable), true);
  assert.equal(
    isConnectionError(new Error("wrapper", { cause: new Error("Failed to fetch") })),
    true,
  );
  assert.equal(isConnectionError(new TypeError("undefined is not a function")), false);
  assert.equal(isConnectionError(null), false);
});

test("the guard drops connection errors and keeps the default for anything else", () => {
  const { utils, calls, fire } = fakeErrorUtils();
  const reports: unknown[] = [];
  assert.equal(
    installOfflineErrorGuard(utils, (error) => reports.push(error)),
    true,
  );
  fire(new TypeError("Network request failed"));
  assert.equal(calls.length, 0, "an offline error does not reach the fatal handler");
  assert.equal(reports.length, 1, "but it is still reported");
  const bug = new TypeError("undefined is not a function");
  fire(bug);
  assert.deepEqual(calls, [bug]);
});

test("without ErrorUtils there is nothing to guard", () => {
  assert.equal(installOfflineErrorGuard(undefined), false);
});
