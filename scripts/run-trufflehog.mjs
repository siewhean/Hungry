#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const globalArgs = ["--no-update"];
const args = [
  ...globalArgs,
  "filesystem",
  "--only-verified",
  "--exclude-paths=scripts/trufflehog-exclude-paths.txt",
  ".",
];
const versionCheck = spawnSync("trufflehog", [...globalArgs, "--version"], { encoding: "utf8" });

if (versionCheck.error?.code === "ENOENT") {
  console.error(
    [
      "trufflehog is not installed or not on PATH.",
      "Install it locally with `brew install trufflehog`, then rerun `npm run security:trufflehog`.",
      "CI still runs the pinned TruffleHog GitHub Action in `.github/workflows/security.yml`.",
    ].join("\n"),
  );
  process.exit(1);
}

if (versionCheck.status !== 0) {
  process.stderr.write(versionCheck.stderr || versionCheck.stdout || "trufflehog check failed\n");
  process.exit(versionCheck.status ?? 1);
}

const result = spawnSync("trufflehog", args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
