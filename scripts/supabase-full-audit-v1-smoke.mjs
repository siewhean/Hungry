#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const REQUIRED_ENV = "HUNGRY_SUPABASE_SMOKE_REQUIRED";
const smokeSqlPath = "supabase/smoke/full_audit_v1_readiness.sql";

// Self-hosted Supabase: target the database explicitly instead of a CLI-linked cloud project.
const DB_URL_ENV = "SUPABASE_DB_URL";
const dbUrl = process.env[DB_URL_ENV]?.trim() ?? "";
const installedSupabaseCli =
  process.env.SUPABASE_CLI_COMMAND ||
  ["/opt/homebrew/bin/supabase", "/usr/local/bin/supabase"].find((candidate) =>
    existsSync(candidate),
  );
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["db", "query", "--db-url", dbUrl, "-f", smokeSqlPath, "-o", "table"];
const command = installedSupabaseCli || npxCommand;
const commandArgs = installedSupabaseCli ? args : ["--no-install", "supabase", ...args];

function isRequired() {
  return process.argv.includes("--require-network") || process.env[REQUIRED_ENV] === "1";
}

function runSupabaseQuery() {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code, signal) => {
      resolve({
        code: code ?? 1,
        signal,
        stdout,
        stderr,
      });
    });
  });
}

function isSkippableEnvironmentError(stderr) {
  const message = stderr.toLowerCase();
  return [
    "access token",
    "cannot find project ref",
    "connection refused",
    "eai_again",
    "enotfound",
    "failed to dial",
    "lookup api.supabase.com",
    "no such host",
    "not logged in",
    "not linked",
    "timed out",
  ].some((snippet) => message.includes(snippet));
}

function writeIfPresent(text, stream) {
  if (text.trim()) stream.write(text.endsWith("\n") ? text : `${text}\n`);
}

if (!dbUrl) {
  if (isRequired()) {
    console.error(
      `[supabase-full-audit-v1-smoke] ${DB_URL_ENV} is required (Postgres connection string for the target Supabase database).`,
    );
    process.exit(1);
  }
  console.log(
    `[supabase-full-audit-v1-smoke] skipped; ${DB_URL_ENV} is not set. Set ${REQUIRED_ENV}=1 to make this a hard failure.`,
  );
  process.exit(0);
}

const result = await runSupabaseQuery();

if (result.code !== 0) {
  if (!isRequired() && isSkippableEnvironmentError(result.stderr)) {
    console.log(
      `[supabase-full-audit-v1-smoke] skipped; target Supabase database is not reachable from this environment. Set ${REQUIRED_ENV}=1 to make this a hard failure.`,
    );
    process.exit(0);
  }

  writeIfPresent(result.stdout, process.stdout);
  writeIfPresent(result.stderr, process.stderr);
  process.exit(result.code);
}

if (result.stdout.trim()) {
  console.error("[supabase-full-audit-v1-smoke] readiness findings returned:");
  writeIfPresent(result.stdout, process.stderr);
  process.exit(1);
}

console.log("[supabase-full-audit-v1-smoke] passed; no readiness findings returned.");
