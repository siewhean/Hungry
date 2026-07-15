import assert from "node:assert/strict";
import test from "node:test";

import { resolveClientIp } from "./clientIp.ts";

test("uses the real-IP fallback when forwarded-for is absent or invalid", () => {
  assert.equal(resolveClientIp(null, "203.0.113.7"), "203.0.113.7");
  assert.equal(resolveClientIp("scope:attacker", "2001:db8::1"), "2001:db8::1");
});

test("uses the first safe forwarded address and otherwise fails closed", () => {
  assert.equal(resolveClientIp("198.51.100.2, 10.0.0.1", "203.0.113.7"), "198.51.100.2");
  assert.equal(resolveClientIp("not-an-ip", "also-invalid"), "unknown");
});
