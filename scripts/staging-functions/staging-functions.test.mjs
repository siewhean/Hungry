import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { namesFromList } from "./check-secrets.mjs";
import {
  FUNCTIONS,
  PROD_REF,
  STAGING_REF,
  manifestProblems,
  missingSecrets,
  requiredSecretNames,
} from "./manifest.mjs";
import { ANON_EXPECTED, formatRows, resolveBase, runSmoke } from "../smoke-staging-functions.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("the manifest covers every function folder, every secret name and every verify_jwt setting", () => {
  assert.deepEqual(manifestProblems(repoRoot), []);
});

test("staging is not the production project", () => {
  assert.notEqual(STAGING_REF, PROD_REF);
});

test("missingSecrets reports only required names that are absent", () => {
  const required = requiredSecretNames();
  assert.deepEqual(missingSecrets(required), []);
  assert.deepEqual(missingSecrets(required.filter((name) => name !== "REPORT_DIGEST_TOKEN")), [
    "REPORT_DIGEST_TOKEN",
  ]);
  assert.ok(!required.includes("SENTRY_DSN"), "Sentry DSN is optional on staging");
});

test("namesFromList reads the CLI's JSON and rejects anything else", () => {
  assert.deepEqual(namesFromList('[{"name":"A","value":"x"},{"NAME":"B"}]'), ["A", "B"]);
  assert.throws(() => namesFromList("{}"));
});

test("resolveBase refuses production and unknown projects", () => {
  assert.equal(resolveBase({}), `https://${STAGING_REF}.supabase.co`);
  assert.throws(
    () => resolveBase({ STAGING_SUPABASE_URL: `https://${PROD_REF}.supabase.co` }),
    /production/,
  );
  assert.throws(
    () => resolveBase({ STAGING_SUPABASE_URL: "https://other.supabase.co" }),
    /staging project/,
  );
});

function fakeFetch(answer) {
  const calls = [];
  const impl = async (url, init) => {
    const name = url.split("/functions/v1/")[1];
    calls.push({ name, headers: init.headers, body: JSON.parse(init.body) });
    return { status: answer(name, init.headers) };
  };
  return { impl, calls };
}

const guardedAnswer = (name, headers) => {
  const fn = FUNCTIONS.find((item) => item.name === name);
  const token = headers["x-guest-session-key"] ?? headers.authorization.replace("Bearer ", "");
  if (fn.tokenEnv && token === `tok-${fn.tokenEnv}`) return fn.guard === "guest" ? 201 : 200;
  return ANON_EXPECTED[fn.guard][0];
};

test("a fully deployed, guarded staging passes every function", async () => {
  const { impl } = fakeFetch(guardedAnswer);
  const env = Object.fromEntries(
    FUNCTIONS.filter((fn) => fn.tokenEnv).map((fn) => [fn.tokenEnv, `tok-${fn.tokenEnv}`]),
  );
  const rows = await runSmoke({
    env: { ...env, STAGING_SMOKE_ORIGIN: "https://x.test" },
    fetchImpl: impl,
    anonKey: "anon",
    requireTokens: true,
  });
  assert.equal(rows.filter((row) => row.status === "fail").length, 0, formatRows(rows));
  assert.equal(
    rows.filter((row) => row.step === "anonymous call refused").length,
    FUNCTIONS.length,
  );
});

test("a function that is not deployed fails with 404", async () => {
  const { impl } = fakeFetch((name, headers) =>
    name === "tag-dishes" ? 404 : guardedAnswer(name, headers),
  );
  const rows = await runSmoke({ env: {}, fetchImpl: impl, anonKey: "anon" });
  const row = rows.find((item) => item.name === "tag-dishes" && item.status === "fail");
  assert.match(row.detail, /not deployed/);
});

test("a function that lets an anonymous caller in fails", async () => {
  const { impl } = fakeFetch((name, headers) =>
    name === "purge-orphan-media" ? 200 : guardedAnswer(name, headers),
  );
  const rows = await runSmoke({ env: {}, fetchImpl: impl, anonKey: "anon" });
  assert.ok(rows.some((row) => row.name === "purge-orphan-media" && row.status === "fail"));
});

test("missing tokens skip the authorised call, or fail with --require-tokens", async () => {
  const { impl } = fakeFetch(guardedAnswer);
  const lenient = await runSmoke({ env: {}, fetchImpl: impl, anonKey: "anon" });
  assert.ok(lenient.some((row) => row.status === "skip"));
  assert.equal(lenient.filter((row) => row.status === "fail").length, 0);
  const strict = await runSmoke({ env: {}, fetchImpl: impl, anonKey: "anon", requireTokens: true });
  assert.ok(
    strict.some((row) => row.status === "fail" && /not in the environment/.test(row.detail)),
  );
});

test("worker calls send the token and a one-item limit; guest calls send the key and an origin", async () => {
  const { impl, calls } = fakeFetch(guardedAnswer);
  await runSmoke({
    env: {
      ACCOUNT_DELETION_WORKER_TOKEN: "tok-ACCOUNT_DELETION_WORKER_TOKEN",
      GUEST_SESSION_API_KEY: "tok-GUEST_SESSION_API_KEY",
      GUEST_SESSION_ALLOWED_ORIGINS: "https://a.test,https://b.test",
    },
    fetchImpl: impl,
    anonKey: "anon",
  });
  const worker = calls.find(
    (call) => call.name === "process-account-deletions" && call.body.limit === 1,
  );
  assert.equal(worker.headers.authorization, "Bearer tok-ACCOUNT_DELETION_WORKER_TOKEN");
  const guest = calls.find(
    (call) => call.name === "guest-sessions" && call.headers["x-guest-session-key"],
  );
  assert.equal(guest.headers.origin, "https://a.test");
  assert.match(guest.body.deviceId, /^smoke-/);
});

test("a network failure is a failed row, not a crash", async () => {
  const rows = await runSmoke({
    env: {},
    anonKey: "anon",
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(rows.filter((row) => row.status === "fail").length, FUNCTIONS.length);
});
