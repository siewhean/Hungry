import assert from "node:assert/strict";
import test from "node:test";

import { isNetworkOffline } from "./connectivity";

test("connectivity treats confirmed transport or internet loss as offline", () => {
  assert.equal(isNetworkOffline({ isConnected: false, isInternetReachable: true }), true);
  assert.equal(isNetworkOffline({ isConnected: true, isInternetReachable: false }), true);
});

test("connectivity waits for an unknown reachability probe before declaring offline", () => {
  assert.equal(isNetworkOffline({ isConnected: true, isInternetReachable: null }), false);
  assert.equal(isNetworkOffline({ isConnected: null, isInternetReachable: null }), false);
});
