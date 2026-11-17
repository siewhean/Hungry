#!/usr/bin/env node
/** Run a bounded scheduled enrichment review/apply batch and retain evidence. */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";


const MAX_LIMIT = 25;
const MAX_APPLY_LIMIT = 10;
const MAX_WORKERS = 3;


export function parseReviewArgs(argv) {
  const options = { mode: "review", limit: 10, workers: 2, outputDir: null };
  for (const arg of argv) {
    if (arg === "--help") options.help = true;
    else if (arg === "--apply") options.mode = "apply";
    else if (arg.startsWith("--mode=")) options.mode = arg.slice("--mode=".length);
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice("--limit=".length));
    else if (arg.startsWith("--workers=")) options.workers = Number(arg.slice("--workers=".length));
    else if (arg.startsWith("--output-dir=")) options.outputDir = arg.slice("--output-dir=".length);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!new Set(["review", "apply"]).has(options.mode)) {
    throw new Error("--mode must be review or apply");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT) {
    throw new Error(`--limit must be an integer from 1 to ${MAX_LIMIT}`);
  }
  if (options.mode === "apply" && options.limit > MAX_APPLY_LIMIT) {
    throw new Error(`apply mode --limit must be an integer from 1 to ${MAX_APPLY_LIMIT}`);
  }
  if (!Number.isInteger(options.workers) || options.workers < 1 || options.workers > MAX_WORKERS) {
    throw new Error(`--workers must be an integer from 1 to ${MAX_WORKERS}`);
  }
  return options;
}


export function resolveCredentials(env) {
  const supabaseUrl = env.HUNGRY_SUPABASE_IMPORT_URL || env.EXPO_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = env.HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    supabaseUrl,
    serviceRoleKey,
    missing: [
      ...(!supabaseUrl ? ["HUNGRY_SUPABASE_IMPORT_URL or EXPO_PUBLIC_SUPABASE_URL"] : []),
      ...(!serviceRoleKey ? ["HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY"] : []),
    ],
  };
}


export function buildEnrichmentArgs({ mode = "review", limit, workers = 2, outputDir }) {
  const args = [
    "scripts/auto-enrich-images.mjs",
    "--known-sources-only",
    "--no-inserts",
    "--skip-debug-captures",
    `--limit=${limit}`,
    `--workers=${workers}`,
    "--max-write-timeouts=2",
    `--checkpoint=${path.join(outputDir, "checkpoint.json")}`,
    "--reset-checkpoint",
    `--export-json=${path.join(outputDir, "scraper-results.json")}`,
  ];
  if (mode === "review") args.splice(1, 0, "--dry-run");
  return args;
}


export function redactSecrets(text, secrets) {
  let redacted = text;
  for (const secret of secrets.filter((value) => typeof value === "string" && value.length >= 8)) {
    redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}


function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}


async function writeSummary(outputDir, summary) {
  await fs.writeFile(path.join(outputDir, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}


async function runChild(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code: code ?? 1, signal, stdout, stderr }));
  });
}


export async function runScheduledEnrichment(options, env = process.env, childRunner = runChild) {
  const outputDir = path.resolve(
    options.outputDir || path.join("artifacts", "enrichment-review", timestampForPath()),
  );
  await fs.mkdir(outputDir, { recursive: true });
  const credentials = resolveCredentials(env);
  const applyRequested = options.mode === "apply";
  const writeGateEnabled = env.HUNGRY_ENABLE_SCHEDULED_ENRICHMENT_WRITES === "1";
  const startedAt = new Date().toISOString();
  const baseSummary = {
    schemaVersion: 1,
    mode: options.mode,
    dryRun: !applyRequested,
    knownSourcesOnly: true,
    sourceDiscoveryPermitted: false,
    liveWritesPermitted: applyRequested && writeGateEnabled,
    insertsPermitted: false,
    protectedEnvironmentRequiredForApply: true,
    writeEnableSecretPresent: writeGateEnabled,
    limit: options.limit,
    workers: options.workers,
    startedAt,
    githubRunId: env.GITHUB_RUN_ID || null,
    githubRunAttempt: env.GITHUB_RUN_ATTEMPT || null,
  };

  if (applyRequested && !writeGateEnabled) {
    const summary = {
      ...baseSummary,
      status: "blocked_write_gate",
      requiredWriteGate: "HUNGRY_ENABLE_SCHEDULED_ENRICHMENT_WRITES=1",
      finishedAt: new Date().toISOString(),
    };
    await writeSummary(outputDir, summary);
    return { exitCode: 2, outputDir, summary };
  }

  if (credentials.missing.length) {
    const summary = {
      ...baseSummary,
      status: "blocked_missing_secrets",
      missingSecrets: credentials.missing,
      finishedAt: new Date().toISOString(),
    };
    await writeSummary(outputDir, summary);
    return { exitCode: 2, outputDir, summary };
  }

  const enrichmentArgs = buildEnrichmentArgs({
    mode: options.mode,
    limit: options.limit,
    workers: options.workers,
    outputDir,
  });
  await writeSummary(outputDir, {
    ...baseSummary,
    status: "running",
    command: [process.execPath, ...enrichmentArgs],
  });

  const result = await childRunner(process.execPath, enrichmentArgs, {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    env: {
      ...env,
      HUNGRY_SUPABASE_IMPORT_URL: credentials.supabaseUrl,
      HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY: credentials.serviceRoleKey,
      PLAYWRIGHT_USER_DATA_DIR:
        env.PLAYWRIGHT_USER_DATA_DIR ||
        path.join(env.RUNNER_TEMP || os.tmpdir(), `hungry-enrichment-playwright-${env.GITHUB_RUN_ID || "local"}`),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const secrets = [credentials.supabaseUrl, credentials.serviceRoleKey];
  await fs.writeFile(path.join(outputDir, "stdout.log"), redactSecrets(result.stdout, secrets), "utf8");
  await fs.writeFile(path.join(outputDir, "stderr.log"), redactSecrets(result.stderr, secrets), "utf8");

  const summary = {
    ...baseSummary,
    status:
      result.code === 0
        ? applyRequested
          ? "apply_complete"
          : "review_ready"
        : "scraper_failed",
    command: [process.execPath, ...enrichmentArgs],
    exitCode: result.code,
    signal: result.signal,
    finishedAt: new Date().toISOString(),
    artifacts: {
      scraperResults: "scraper-results.json",
      checkpoint: "checkpoint.json",
      stdout: "stdout.log",
      stderr: "stderr.log",
    },
  };
  await writeSummary(outputDir, summary);
  return { exitCode: result.code, outputDir, summary };
}


async function main() {
  let options;
  try {
    options = parseReviewArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (options.help) {
    console.log("Usage: node scripts/run-scheduled-enrichment-review.mjs [--mode=review|apply] [--limit=10] [--workers=2] [--output-dir=PATH]");
    console.log("Apply mode additionally requires HUNGRY_ENABLE_SCHEDULED_ENRICHMENT_WRITES=1.");
    console.log("Both modes are permanently limited to known sources and existing dish rows.");
    return 0;
  }
  const result = await runScheduledEnrichment(options);
  console.log(`Scheduled enrichment status: ${result.summary.status}`);
  console.log(`Scheduled enrichment artifacts: ${result.outputDir}`);
  return result.exitCode;
}


const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = await main();
}
