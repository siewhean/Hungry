import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { timingSafeEqual } from "../../../supabase/functions/_shared/timingSafeEqual";

test("timingSafeEqual matches only identical secrets", () => {
  assert.equal(timingSafeEqual("worker-token", "worker-token"), true);
  assert.equal(timingSafeEqual("worker-token", "worker-tokem"), false);
  assert.equal(timingSafeEqual("worker", "worker-token"), false);
  assert.equal(timingSafeEqual("", "worker-token"), false);
  assert.equal(timingSafeEqual("", ""), true);
});

test("edge function worker and API key checks use the constant-time compare", () => {
  for (const name of [
    "process-account-deletions",
    "send-notifications",
    "tag-dishes",
    "guest-sessions",
  ]) {
    const source = fs.readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
    assert.match(source, /from "\.\.\/_shared\/timingSafeEqual\.ts"/, name);
    assert.match(source, /!timingSafeEqual\(/, name);
    assert.doesNotMatch(source, /!== (workerToken|configuredApiKey)/, name);
  }
});
