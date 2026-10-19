#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const REQUIRED_ENV = "HUNGRY_SUPABASE_ADVISOR_REQUIRED";
const FAIL_ON_EXTERNAL_ENV = "HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL";
const IGNORE_LEAKED_PASSWORD_ENV = "HUNGRY_SUPABASE_ADVISOR_IGNORE_LEAKED_PASSWORD";
const npxCommand = process.env.SUPABASE_NPX_COMMAND || "npx";
const npxInstallArgs = process.env.SUPABASE_NPX_ALLOW_INSTALL === "1" ? [] : ["--no-install"];
const installedSupabaseCli =
  process.env.SUPABASE_CLI_COMMAND ||
  ["/opt/homebrew/bin/supabase", "/usr/local/bin/supabase"].find((candidate) =>
    existsSync(candidate),
  );
const args = ["db", "advisors", "--linked", "--type", "security", "--level", "warn", "-o", "json"];
const command = installedSupabaseCli || npxCommand;
const commandArgs = installedSupabaseCli ? args : [...npxInstallArgs, "supabase", ...args];

function isRequired() {
  return process.argv.includes("--require-network") || process.env[REQUIRED_ENV] === "1";
}

function shouldFailOnExternal() {
  return process.argv.includes("--fail-on-external") || process.env[FAIL_ON_EXTERNAL_ENV] === "1";
}

function shouldIgnoreLeakedPassword() {
  return (
    process.argv.includes("--ignore-leaked-password") ||
    process.env[IGNORE_LEAKED_PASSWORD_ENV] === "1"
  );
}

function runAdvisor() {
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
    "command not found",
    "eai_again",
    "enotfound",
    "failed to dial",
    "lookup api.supabase.com",
    "missing packages and no yes option",
    "no such host",
    "not logged in",
    "not linked",
    "npx canceled due to missing packages",
    "spawn npx enoent",
    "timed out",
  ].some((snippet) => message.includes(snippet));
}

function fail(message, details) {
  console.error(`[supabase-advisor-security-classifier] ${message}`);
  if (details?.trim()) console.error(details.trim());
  process.exit(1);
}

function externalReason(finding) {
  const metadata = finding.metadata || {};
  const detail = finding.detail || "";

  if (
    finding.name === "rls_disabled_in_public" &&
    metadata.schema === "public" &&
    metadata.name === "spatial_ref_sys"
  ) {
    return "Supabase/PostGIS-owned table; requires owner/support RLS action";
  }

  if (
    finding.name === "extension_in_public" &&
    metadata.schema === "public" &&
    metadata.name === "postgis"
  ) {
    return "existing PostGIS-in-public installation; requires support-assisted relocation";
  }

  if (
    (finding.name === "anon_security_definer_function_executable" ||
      finding.name === "authenticated_security_definer_function_executable") &&
    metadata.schema === "public" &&
    metadata.name === "st_estimatedextent" &&
    detail.includes("public.st_estimatedextent")
  ) {
    return "Supabase/PostGIS-owned SECURITY DEFINER function grant";
  }

  if (finding.name === "auth_leaked_password_protection") {
    return "Supabase Auth dashboard/Management API setting";
  }

  if (
    (finding.name === "anon_security_definer_function_executable" ||
      finding.name === "authenticated_security_definer_function_executable") &&
    metadata.schema === "public" &&
    ["release_reserved_order", "submit_payment_proof"].includes(metadata.name)
  ) {
    return "legacy linked Supabase payment RPC outside Hungry MVP repo scope; requires explicit owner-approved revoke/drop";
  }

  return null;
}

// SECURITY DEFINER RPCs that signed-in users are meant to call; each checks auth.uid() itself.
const INTENDED_AUTHENTICATED_RPCS = [
  "cancel_my_account_deletion",
  "catalog_raw_dish_detail",
  "catalog_raw_dishes_page",
  "catalog_raw_map_view",
  "catalog_raw_venue_detail",
  "catalog_raw_venue_menu_page",
  "catalog_raw_venues_page",
  "mark_notification_opened",
  // Called by the merchant dish write guards (security invoker); returns a public verified flag.
  "merchant_venue_is_verified",
  // Records today's app open for auth.uid() only (retention lifecycle).
  "record_app_open",
  "register_push_token",
  "unregister_push_token",
];

// SECURITY DEFINER RPCs signed-out visitors are meant to call; each returns only public rows.
const INTENDED_ANON_RPCS = ["get_public_merchant_profile", "get_public_portfolio"];

function intendedReason(finding) {
  const metadata = finding.metadata || {};
  if (
    finding.name === "authenticated_security_definer_function_executable" &&
    metadata.schema === "public" &&
    INTENDED_AUTHENTICATED_RPCS.includes(metadata.name)
  ) {
    return "intended authenticated RPC";
  }
  if (
    (finding.name === "anon_security_definer_function_executable" ||
      finding.name === "authenticated_security_definer_function_executable") &&
    metadata.schema === "public" &&
    INTENDED_ANON_RPCS.includes(metadata.name)
  ) {
    return "intended public read RPC";
  }
  return null;
}

function summarizeFinding(finding) {
  return `${finding.level || "UNKNOWN"} ${finding.name || "unknown"} ${finding.cache_key || ""}`.trim();
}

const result = await runAdvisor();

if (result.code !== 0) {
  if (!isRequired() && isSkippableEnvironmentError(result.stderr)) {
    console.log(
      `[supabase-advisor-security-classifier] skipped; linked Supabase Advisor is not reachable from this environment. Set ${REQUIRED_ENV}=1 to make this a hard failure.`,
    );
    process.exit(0);
  }

  fail("failed to fetch linked Supabase Security Advisor output.", result.stderr || result.stdout);
}

let findings;
try {
  findings = JSON.parse(result.stdout);
} catch (error) {
  fail("failed to parse linked Supabase Security Advisor JSON output.", String(error));
}

if (!Array.isArray(findings)) {
  fail("linked Supabase Security Advisor output was not an array.");
}

const classified = findings.map((finding) => ({
  finding,
  externalReason: externalReason(finding),
  intendedReason: intendedReason(finding),
}));
const unexpected = classified.filter((item) => !item.externalReason && !item.intendedReason);
const ignoredExternal = shouldIgnoreLeakedPassword()
  ? classified.filter((item) => item.finding.name === "auth_leaked_password_protection")
  : [];
const external = classified.filter(
  (item) => item.externalReason && !ignoredExternal.includes(item),
);

if (unexpected.length > 0) {
  console.error("[supabase-advisor-security-classifier] unexpected app-owned Advisor findings:");
  for (const item of unexpected) {
    console.error(`- ${summarizeFinding(item.finding)}`);
    if (item.finding.detail) console.error(`  ${item.finding.detail}`);
  }
  process.exit(1);
}

if (external.length === 0) {
  if (ignoredExternal.length > 0) {
    console.log(
      `[supabase-advisor-security-classifier] passed; ignored leaked-password protection findings: ${ignoredExternal.length}`,
    );
  } else {
    console.log("[supabase-advisor-security-classifier] passed; no Security Advisor findings.");
  }
  process.exit(0);
}

console.log(
  `[supabase-advisor-security-classifier] no unexpected app-owned findings. Known external findings remain: ${external.length}`,
);
for (const item of external) {
  console.log(`- ${summarizeFinding(item.finding)} — ${item.externalReason}`);
}
if (ignoredExternal.length > 0) {
  console.log(
    `[supabase-advisor-security-classifier] ignored leaked-password protection findings: ${ignoredExternal.length}`,
  );
}

if (shouldFailOnExternal()) {
  process.exit(1);
}
