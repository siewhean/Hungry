#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const maxFileBytes = 25 * 1024 * 1024;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error?.code === "ENOENT") {
    console.error(`${command} is not installed or not on PATH.`);
    process.exit(1);
  }
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  return result;
}

const version = run("gitleaks", ["version"]);
if (version.status !== 0) {
  process.stderr.write(version.stderr || version.stdout || "gitleaks version check failed\n");
  process.exit(version.status ?? 1);
}

const trackedAndUnignored = run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
if (trackedAndUnignored.status !== 0) {
  process.stderr.write(trackedAndUnignored.stderr || "git ls-files failed\n");
  process.exit(trackedAndUnignored.status ?? 1);
}

const files = trackedAndUnignored.stdout.split("\0").filter(Boolean);
if (files.length === 0) {
  console.error("No tracked or unignored files were available for gitleaks scanning.");
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hungry-gitleaks-"));
let copiedFiles = 0;
let skippedLargeFiles = 0;

try {
  for (const relativeFile of files) {
    const sourcePath = path.join(repoRoot, relativeFile);
    let stat;
    try {
      stat = fs.lstatSync(sourcePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (stat.size > maxFileBytes) {
      skippedLargeFiles += 1;
      continue;
    }

    const targetPath = path.join(tempDir, relativeFile);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    copiedFiles += 1;
  }

  if (copiedFiles === 0) {
    console.error("No files were copied for gitleaks scanning.");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        copiedFiles,
        skippedLargeFiles,
        source: "git tracked plus unignored untracked files",
      },
      null,
      2,
    ),
  );

  const scan = spawnSync("gitleaks", ["dir", "--redact", "--no-banner", tempDir], {
    stdio: "inherit",
  });
  if (scan.error) {
    console.error(scan.error.message);
    process.exit(1);
  }
  process.exit(scan.status ?? 1);
} finally {
  fs.rmSync(tempDir, { force: true, recursive: true });
}
