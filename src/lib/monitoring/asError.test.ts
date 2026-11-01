import assert from "node:assert/strict";
import test from "node:test";

import { asError } from "./asError";

test("a Supabase error object becomes an Error with its message and code", () => {
  const wrapped = asError({
    code: "42803",
    details: null,
    hint: null,
    message: "aggregate function calls cannot be nested",
  }) as Error & { code: string };
  assert.ok(wrapped instanceof Error);
  assert.equal(wrapped.message, "aggregate function calls cannot be nested (42803)");
  assert.equal(wrapped.code, "42803");
});

test("real Errors, strings and objects without a message pass through", () => {
  const real = new Error("boom");
  assert.equal(asError(real), real);
  assert.equal(asError("text"), "text");
  const odd = { code: 1 };
  assert.equal(asError(odd), odd);
  assert.equal(asError(null), null);
});
