import assert from "node:assert/strict";
import test from "node:test";

import { scrubEvent, scrubString } from "../../../supabase/functions/_shared/sentryScrub";

test("scrubString redacts tokens, JWTs, API keys, and emails", () => {
  // Joined at runtime so the fixture is not a JWT-shaped literal that secret scanners flag.
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "abcdefghijklmnop"].join(".");
  assert.equal(scrubString(`token ${jwt} end`), "token [jwt] end");
  assert.equal(
    scrubString("Authorization: Bearer abc123def456ghi"),
    "Authorization: Bearer [token]",
  );
  assert.equal(scrubString("key sk-ant-abcdefghijklmnopqrst"), "key [api-key]");
  assert.equal(scrubString("user sh@example.com failed"), "user [email] failed");
  assert.equal(scrubString("nothing sensitive"), "nothing sensitive");
});

test("scrubEvent drops request and user and cleans exception text", () => {
  const event = scrubEvent({
    request: { headers: { authorization: "Bearer abc123def456ghi" } },
    user: { email: "sh@example.com" },
    message: "failed for sh@example.com",
    extra: { detail: "Bearer abc123def456ghi", status: 500 },
    exception: { values: [{ value: "bad sh@example.com" }] },
  });
  assert.equal("request" in event, false);
  assert.equal("user" in event, false);
  assert.equal(event.message, "failed for [email]");
  assert.deepEqual(event.extra, { detail: "Bearer [token]", status: 500 });
  assert.equal(
    event.exception?.values?.[0]?.value,
    "bad sh@example.com".replace("sh@example.com", "[email]"),
  );
});
