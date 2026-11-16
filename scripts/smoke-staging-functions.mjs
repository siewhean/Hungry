// Calls each Edge Function on STAGING once and checks it is deployed and guarded.
//   node scripts/smoke-staging-functions.mjs [--require-tokens]
// Anonymous pass (always): every function must answer, and refuse a caller with no credentials.
// Authenticated pass (when the secret is in the environment): worker functions run once with
// {limit: 1}; guest-sessions creates one "smoke-..." guest session. --require-tokens turns a
// missing token into a failure. Refuses to run against production. See tasks/environment.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FUNCTIONS, PROD_REF, STAGING_REF } from "./staging-functions/manifest.mjs";

export const ANON_EXPECTED = {
  worker: [401],
  guest: [401, 403],
  user: [401],
  origin: [401, 403],
  webhook: [401, 500],
};

/** One result row: status is "pass", "fail" or "skip"; detail says why. */
export function judge(fn, step, status, expected, note = "") {
  if (status === 404) return { name: fn.name, step, status: "fail", detail: "not deployed (404)" };
  if (expected.includes(status)) return { name: fn.name, step, status: "pass", detail: `HTTP ${status}${note}` };
  const hint = status === 500 ? " (a secret is probably unset)" : status === 401 ? " (token wrong or unset)" : "";
  return { name: fn.name, step, status: "fail", detail: `HTTP ${status}, expected ${expected.join(" or ")}${hint}` };
}

export function resolveBase(env) {
  const url = (env.STAGING_SUPABASE_URL || `https://${STAGING_REF}.supabase.co`).replace(/\/+$/, "");
  if (url.includes(PROD_REF)) throw new Error("Refusing to smoke production. Use the staging project.");
  if (!url.includes(STAGING_REF)) throw new Error(`STAGING_SUPABASE_URL must be the staging project (${STAGING_REF}).`);
  return url;
}

export function readAnonKey(env, repoRoot) {
  if (env.STAGING_SUPABASE_ANON_KEY) return env.STAGING_SUPABASE_ANON_KEY;
  try {
    const text = fs.readFileSync(path.join(repoRoot, ".env.staging"), "utf8");
    return text.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function runSmoke({ env, fetchImpl = fetch, anonKey, requireTokens = false, timeoutMs = 20000 }) {
  const base = resolveBase(env);
  const origin = env.STAGING_SMOKE_ORIGIN || (env.GUEST_SESSION_ALLOWED_ORIGINS || "").split(",")[0].trim();
  const call = async (name, { headers = {}, body = {} } = {}) => {
    const response = await fetchImpl(`${base}/functions/v1/${name}`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${anonKey}`, ...headers },
      body: JSON.stringify(body),
    });
    return response.status;
  };

  const rows = [];
  for (const fn of FUNCTIONS) {
    try {
      rows.push(judge(fn, "anonymous call refused", await call(fn.name), ANON_EXPECTED[fn.guard]));
    } catch (error) {
      rows.push({ name: fn.name, step: "anonymous call refused", status: "fail", detail: `no answer (${error.message})` });
      continue;
    }
    if (!fn.tokenEnv) continue;
    const token = env[fn.tokenEnv];
    if (!token) {
      rows.push({
        name: fn.name,
        step: "authorised call",
        status: requireTokens ? "fail" : "skip",
        detail: `${fn.tokenEnv} not in the environment`,
      });
      continue;
    }
    try {
      if (fn.guard === "worker") {
        const status = await call(fn.name, { headers: { authorization: `Bearer ${token}` }, body: { limit: 1 } });
        rows.push(judge(fn, "authorised call", status, [200]));
      } else if (!origin) {
        rows.push({ name: fn.name, step: "authorised call", status: requireTokens ? "fail" : "skip", detail: "set STAGING_SMOKE_ORIGIN to an allowed origin" });
      } else {
        const status = await call(fn.name, {
          headers: { "x-guest-session-key": token, origin },
          body: { deviceId: `smoke-${Date.now()}` },
        });
        rows.push(judge(fn, "authorised call", status, [200, 201]));
      }
    } catch (error) {
      rows.push({ name: fn.name, step: "authorised call", status: "fail", detail: `no answer (${error.message})` });
    }
  }
  return rows;
}

export function formatRows(rows) {
  const mark = { pass: "PASS", fail: "FAIL", skip: "skip" };
  return rows.map((row) => `${mark[row.status]}  ${row.name.padEnd(26)} ${row.step.padEnd(24)} ${row.detail}`).join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const anonKey = readAnonKey(process.env, repoRoot);
  if (!anonKey) {
    console.error("No staging anon key: set STAGING_SUPABASE_ANON_KEY or keep it in .env.staging.");
    process.exit(2);
  }
  const rows = await runSmoke({ env: process.env, anonKey, requireTokens: process.argv.includes("--require-tokens") });
  console.log(formatRows(rows));
  const failedFunctions = new Set(rows.filter((row) => row.status === "fail").map((row) => row.name));
  console.log(`\n${FUNCTIONS.length - failedFunctions.size} of ${FUNCTIONS.length} functions ok.`);
  process.exit(failedFunctions.size === 0 ? 0 : 1);
}
