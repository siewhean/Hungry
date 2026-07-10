#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildEnrichmentArgs,
  parseReviewArgs,
  redactSecrets,
  resolveCredentials,
  runScheduledEnrichment,
} from "../run-scheduled-enrichment-review.mjs";


test("review command is dry-run, bounded, known-sources-only, and no-inserts", () => {
  const args = buildEnrichmentArgs({ mode: "review", limit: 10, workers: 2, outputDir: "/tmp/review" });
  assert.ok(args.includes("--dry-run"));
  assert.ok(args.includes("--known-sources-only"));
  assert.ok(args.includes("--no-inserts"));
  assert.ok(args.includes("--workers=2"));
  assert.equal(args.includes("--discover-sources"), false);
  assert.ok(args.some((arg) => arg.startsWith("--export-json=/tmp/review/")));
});

test("apply command enables existing-row writes without discovery or inserts", () => {
  const args = buildEnrichmentArgs({ mode: "apply", limit: 5, workers: 3, outputDir: "/tmp/apply" });
  assert.equal(args.includes("--dry-run"), false);
  assert.ok(args.includes("--known-sources-only"));
  assert.ok(args.includes("--no-inserts"));
  assert.ok(args.includes("--workers=3"));
  assert.equal(args.includes("--discover-sources"), false);
});

test("mode, limit, and worker bounds are enforced", () => {
  assert.equal(parseReviewArgs(["--apply"]).mode, "apply");
  assert.equal(parseReviewArgs([]).mode, "review");
  assert.throws(() => parseReviewArgs(["--limit=26"]), /integer from 1 to 25/);
  assert.throws(() => parseReviewArgs(["--mode=apply", "--limit=11"]), /apply mode --limit/);
  assert.throws(() => parseReviewArgs(["--workers=4"]), /integer from 1 to 3/);
  assert.throws(() => parseReviewArgs(["--mode=discover"]), /review or apply/);
});

test("credentials require a URL and a service-role secret", () => {
  assert.equal(resolveCredentials({}).missing.length, 2);
  assert.deepEqual(
    resolveCredentials({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
    }).missing,
    [],
  );
});

test("missing credentials still produce an auditable blocked artifact", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hungry-review-test-"));
  try {
    const result = await runScheduledEnrichment(
      { mode: "review", limit: 2, workers: 1, outputDir: directory },
      {},
    );
    assert.equal(result.exitCode, 2);
    assert.equal(result.summary.status, "blocked_missing_secrets");
    const artifact = JSON.parse(await fs.readFile(path.join(directory, "run-summary.json"), "utf8"));
    assert.equal(artifact.liveWritesPermitted, false);
    assert.equal(artifact.sourceDiscoveryPermitted, false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("apply mode is blocked unless the explicit write gate equals one", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hungry-apply-gate-test-"));
  try {
    const result = await runScheduledEnrichment(
      { mode: "apply", limit: 2, workers: 1, outputDir: directory },
      {
        HUNGRY_SUPABASE_IMPORT_URL: "https://example.supabase.co",
        HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY: "service-secret",
      },
    );
    assert.equal(result.exitCode, 2);
    assert.equal(result.summary.status, "blocked_write_gate");
    assert.equal(result.summary.liveWritesPermitted, false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("review mode runs without the write-enable secret and records review-ready", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hungry-review-success-test-"));
  let capturedArgs = [];
  const fakeRunner = async (_command, args) => {
    capturedArgs = args;
    return { code: 0, signal: null, stdout: "review complete", stderr: "" };
  };
  try {
    const result = await runScheduledEnrichment(
      { mode: "review", limit: 10, workers: 2, outputDir: directory },
      {
        HUNGRY_SUPABASE_IMPORT_URL: "https://example.supabase.co",
        HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY: "service-secret",
      },
      fakeRunner,
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.summary.status, "review_ready");
    assert.equal(result.summary.liveWritesPermitted, false);
    assert.ok(capturedArgs.includes("--dry-run"));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("enabled apply mode runs the bounded existing-row command and records completion", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hungry-apply-test-"));
  let capturedArgs = [];
  const fakeRunner = async (_command, args) => {
    capturedArgs = args;
    return { code: 0, signal: null, stdout: "updated existing rows", stderr: "" };
  };
  try {
    const result = await runScheduledEnrichment(
      { mode: "apply", limit: 5, workers: 2, outputDir: directory },
      {
        HUNGRY_SUPABASE_IMPORT_URL: "https://example.supabase.co",
        HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY: "service-secret",
        HUNGRY_ENABLE_SCHEDULED_ENRICHMENT_WRITES: "1",
      },
      fakeRunner,
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.summary.status, "apply_complete");
    assert.equal(result.summary.liveWritesPermitted, true);
    assert.equal(capturedArgs.includes("--dry-run"), false);
    assert.ok(capturedArgs.includes("--known-sources-only"));
    assert.ok(capturedArgs.includes("--no-inserts"));
    assert.ok(capturedArgs.includes("--workers=2"));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("artifact log redaction removes configured secrets", () => {
  assert.equal(redactSecrets("url=top-secret-value", ["top-secret-value"]), "url=[REDACTED]");
});
