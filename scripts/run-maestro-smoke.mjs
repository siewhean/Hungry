#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_METRO_STATUS_URLS = ["http://127.0.0.1:8081/status", "http://localhost:8081/status"];
const DEFAULT_METRO_URL = "exp://localhost:8081";
const METRO_STATUS_TIMEOUT_MS = 1500;

const FLOW_MAP = {
  "ios-chat": [".maestro/ios-chat-smoke.yaml"],
  "ios-media": [".maestro/ios-media-picker-permission.yaml"],
  ios: [".maestro/ios-chat-smoke.yaml", ".maestro/ios-media-picker-permission.yaml"],
  all: [".maestro/ios-chat-smoke.yaml", ".maestro/ios-media-picker-permission.yaml"],
};

function fail(message) {
  throw new Error(`[maestro-smoke] ${message}`);
}

function getAppId() {
  if (process.env.HUNGRY_NATIVE_APP_ID?.trim()) {
    return process.env.HUNGRY_NATIVE_APP_ID.trim();
  }

  const appJson = JSON.parse(readFileSync(resolve(process.cwd(), "app.json"), "utf8"));
  return appJson.expo?.ios?.bundleIdentifier ?? appJson.expo?.android?.package ?? "";
}

function hasMaestro() {
  const result = spawnSync("maestro", ["--version"], { encoding: "utf8" });
  return result.status === 0;
}

async function isMetroReady() {
  const statusUrls = process.env.HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL?.trim()
    ? [process.env.HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL.trim()]
    : DEFAULT_METRO_STATUS_URLS;

  for (const statusUrl of statusUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METRO_STATUS_TIMEOUT_MS);

    try {
      const response = await fetch(statusUrl, { signal: controller.signal });
      const body = await response.text();
      if (response.ok && body.includes("packager-status:running")) {
        return true;
      }
    } catch {
      // Try the next loopback form before failing the smoke preflight.
    } finally {
      clearTimeout(timeout);
    }
  }

  return false;
}

function getMetroUrl() {
  return process.env.HUNGRY_NATIVE_SMOKE_METRO_URL?.trim() || DEFAULT_METRO_URL;
}

function materializeFlow(flowPath, metroUrl) {
  const sourcePath = resolve(process.cwd(), flowPath);
  const tempDir = mkdtempSync(resolve(tmpdir(), "hungry-maestro-flow-"));
  const tempFlowPath = resolve(tempDir, flowPath.replace(/[\\/]/g, "-"));
  const content = readFileSync(sourcePath, "utf8").replaceAll("${METRO_URL}", metroUrl);
  writeFileSync(tempFlowPath, content);
  return { tempDir, tempFlowPath };
}

function runFlow(flowPath, appId, metroUrl) {
  if (!existsSync(resolve(process.cwd(), flowPath))) {
    fail(`missing flow ${flowPath}`);
  }

  const { tempDir, tempFlowPath } = materializeFlow(flowPath, metroUrl);
  try {
    const result = spawnSync("maestro", ["test", "-e", `APP_ID=${appId}`, tempFlowPath], {
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.status !== 0) {
      fail(`${flowPath} failed with exit code ${result.status ?? "unknown"}`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const target = process.argv[2] ?? "all";
  const requireMaestro =
    process.argv.includes("--require-maestro") || process.env.HUNGRY_MAESTRO_REQUIRED === "1";
  const flows = FLOW_MAP[target];

  if (!flows) {
    fail(`unknown target "${target}". Use one of: ${Object.keys(FLOW_MAP).join(", ")}`);
  }

  const appId = getAppId();
  const metroUrl = getMetroUrl();
  if (!appId) {
    fail("could not determine native app id from HUNGRY_NATIVE_APP_ID or app.json");
  }

  if (!hasMaestro()) {
    const message = "skipped; Maestro CLI is not installed or not on PATH";
    if (requireMaestro) fail(message);
    console.log(`[maestro-smoke] ${message}`);
    return;
  }

  if (process.env.HUNGRY_NATIVE_SMOKE_SKIP_METRO_CHECK !== "1" && !(await isMetroReady())) {
    fail(
      "Metro is not reachable at http://127.0.0.1:8081/status or http://localhost:8081/status. Start `HUNGRY_METRO_USE_WATCHMAN=0 npm run start -- --host lan --port 8081` and pass the generated LAN URL through HUNGRY_NATIVE_SMOKE_METRO_URL plus HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL, or set HUNGRY_NATIVE_SMOKE_SKIP_METRO_CHECK=1 for non-Expo URL flows.",
    );
  }

  flows.forEach((flowPath) => runFlow(flowPath, appId, metroUrl));
}

await main();
