#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { loadProjectEnv } from "./load-project-env.mjs";

loadProjectEnv();

const required = process.env.HUNGRY_SENTRY_UNRESOLVED_REQUIRED === "1";
const authToken = process.env.SENTRY_AUTH_TOKEN_2 || process.env.SENTRY_AUTH_TOKEN || "";
const org = process.env.SENTRY_ORG || "hungry-3z";
const project = process.env.SENTRY_PROJECT || "react-native";

function skip(reason) {
  const message = `Sentry unresolved issue check skipped: ${reason}`;
  if (required) {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

if (!authToken) {
  skip("SENTRY_AUTH_TOKEN or SENTRY_AUTH_TOKEN_2 is not configured.");
}

const result = spawnSync(
  "npx",
  [
    "--yes",
    "sentry-cli",
    "issues",
    "list",
    "--org",
    org,
    "--project",
    project,
    "--query",
    "is:unresolved",
  ],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
    },
  },
);

if (result.error?.code === "ENOENT") {
  console.error("npx is not installed or not on PATH.");
  process.exit(1);
}
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "sentry-cli unresolved issue check failed\n");
  process.exit(result.status ?? 1);
}

const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();
if (/No issues found/i.test(combinedOutput)) {
  console.log("Sentry unresolved issue check passed: no unresolved issues found.");
  process.exit(0);
}

console.error("Sentry unresolved issue check failed: unresolved issues are present.");
process.stderr.write(`${combinedOutput}\n`);
process.exit(1);
