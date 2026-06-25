#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";

const REQUIRED_ENV = "HUNGRY_SUPABASE_SMOKE_REQUIRED";
const smokeSqlPath = "supabase/smoke/canonical_food_business_staging.sql";
const queryArgs = ["db", "query", "--linked", "-f", smokeSqlPath, "-o", "table"];

function resolveSupabaseCommand() {
  const directCommand = process.platform === "win32" ? "supabase.cmd" : "supabase";
  const direct = spawnSync(directCommand, ["--version"], { stdio: "ignore" });
  if (direct.status === 0) {
    return { command: directCommand, args: queryArgs };
  }

  const homebrewCommand = "/opt/homebrew/bin/supabase";
  const homebrew = spawnSync(homebrewCommand, ["--version"], { stdio: "ignore" });
  if (homebrew.status === 0) {
    return { command: homebrewCommand, args: queryArgs };
  }

  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["--no-install", "supabase", ...queryArgs],
  };
}

function isRequired() {
  return process.argv.includes("--require-network") || process.env[REQUIRED_ENV] === "1";
}

function runSupabaseQuery() {
  return new Promise((resolve) => {
    const { command, args } = resolveSupabaseCommand();
    const child = spawn(command, args, {
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
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
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

const result = await runSupabaseQuery();

if (result.code !== 0) {
  if (!isRequired() && isSkippableEnvironmentError(result.stderr)) {
    console.log(
      `[supabase-canonical-food-business-staging-smoke] skipped; linked Supabase is not reachable from this environment. Set ${REQUIRED_ENV}=1 to make this a hard failure.`,
    );
    process.exit(0);
  }

  writeIfPresent(result.stdout, process.stdout);
  writeIfPresent(result.stderr, process.stderr);
  process.exit(result.code);
}

const findings = result.stdout
  .split(/\r?\n/)
  .filter((line) => /missing_|unexpected_|mismatch|invalid_|incomplete_/.test(line));

if (findings.length > 0) {
  console.error("[supabase-canonical-food-business-staging-smoke] findings returned:");
  writeIfPresent(result.stdout, process.stderr);
  process.exit(1);
}

if (!result.stdout.includes("canonical_food_business_staging_smoke_passed")) {
  console.error("[supabase-canonical-food-business-staging-smoke] pass marker missing:");
  writeIfPresent(result.stdout, process.stderr);
  process.exit(1);
}

console.log("[supabase-canonical-food-business-staging-smoke] passed.");
