#!/usr/bin/env node
// Scheduler entrypoint for the process-account-deletions Edge Function (ACCDEL-01).
// Works on hosted or self-hosted Supabase without pg_cron: run it from host cron, e.g.
//   */15 * * * * node --env-file=/etc/hungry/account-deletion-worker.env \
//     /opt/hungry/scripts/run-account-deletion-worker.mjs >> /var/log/hungry/account-deletion.log 2>&1
//
// Env (values never printed):
//   ACCOUNT_DELETION_WORKER_TOKEN  required; must match the Edge Function secret.
//   ACCOUNT_DELETION_WORKER_URL    optional full function URL; otherwise derived from SUPABASE_URL.
//   SUPABASE_URL                   Supabase API base URL (Kong gateway on self-hosted).
//   ACCOUNT_DELETION_WORKER_LIMIT        requests per batch (1-25, default 5).
//   ACCOUNT_DELETION_WORKER_MAX_BATCHES  batches per run (default 5); stops early when the queue is empty.
//
// Exit codes: 0 = all claimed requests completed (or nothing queued), 1 = at least one
// request failed or the function call failed, 2 = missing configuration.

const FUNCTION_PATH = "/functions/v1/process-account-deletions";
const REQUEST_TIMEOUT_MS = 120_000;

function readPositiveInt(name, fallback, max) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function resolveFunctionUrl() {
  const explicit = process.env.ACCOUNT_DELETION_WORKER_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.SUPABASE_URL?.trim();
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}${FUNCTION_PATH}`;
}

function log(message, details = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...details }));
}

async function runBatch(url, token, limit) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = typeof body?.error === "string" ? body.error : `http_${response.status}`;
    throw new Error(`process-account-deletions returned ${response.status} (${error})`);
  }
  return {
    claimed: Number(body?.claimed ?? 0),
    results: Array.isArray(body?.results) ? body.results : [],
  };
}

async function main() {
  const token = process.env.ACCOUNT_DELETION_WORKER_TOKEN?.trim() ?? "";
  const url = resolveFunctionUrl();
  const missing = [
    ...(!token ? ["ACCOUNT_DELETION_WORKER_TOKEN"] : []),
    ...(!url ? ["ACCOUNT_DELETION_WORKER_URL or SUPABASE_URL"] : []),
  ];
  if (missing.length > 0) {
    log("account_deletion_worker_misconfigured", { missing });
    return 2;
  }

  const limit = readPositiveInt("ACCOUNT_DELETION_WORKER_LIMIT", 5, 25);
  const maxBatches = readPositiveInt("ACCOUNT_DELETION_WORKER_MAX_BATCHES", 5, 50);
  let completed = 0;
  let failed = 0;

  for (let batch = 1; batch <= maxBatches; batch += 1) {
    let outcome;
    try {
      outcome = await runBatch(url, token, limit);
    } catch (error) {
      log("account_deletion_worker_call_failed", {
        batch,
        error: error instanceof Error ? error.message : String(error),
      });
      return 1;
    }

    const batchFailures = outcome.results.filter((result) => result?.status !== "completed");
    completed += outcome.results.length - batchFailures.length;
    failed += batchFailures.length;
    // Log request ids only (no user ids) so cron logs stay low-sensitivity.
    for (const result of batchFailures) {
      log("account_deletion_request_failed", {
        requestId: result?.requestId ?? null,
        error: typeof result?.error === "string" ? result.error.slice(0, 300) : null,
      });
    }

    // Stop when the queue is drained or when failures appear (they will be retried
    // on the next scheduled run instead of being hammered within one run).
    if (outcome.claimed < limit || batchFailures.length > 0) break;
  }

  log("account_deletion_worker_finished", { completed, failed });
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    log("account_deletion_worker_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  },
);
