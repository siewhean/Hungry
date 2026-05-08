#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

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

function runFlow(flowPath, appId) {
  if (!existsSync(resolve(process.cwd(), flowPath))) {
    fail(`missing flow ${flowPath}`);
  }

  const result = spawnSync("maestro", ["test", "-e", `APP_ID=${appId}`, flowPath], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(`${flowPath} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function main() {
  const target = process.argv[2] ?? "all";
  const requireMaestro =
    process.argv.includes("--require-maestro") || process.env.HUNGRY_MAESTRO_REQUIRED === "1";
  const flows = FLOW_MAP[target];

  if (!flows) {
    fail(`unknown target "${target}". Use one of: ${Object.keys(FLOW_MAP).join(", ")}`);
  }

  const appId = getAppId();
  if (!appId) {
    fail("could not determine native app id from HUNGRY_NATIVE_APP_ID or app.json");
  }

  if (!hasMaestro()) {
    const message = "skipped; Maestro CLI is not installed or not on PATH";
    if (requireMaestro) fail(message);
    console.log(`[maestro-smoke] ${message}`);
    return;
  }

  flows.forEach((flowPath) => runFlow(flowPath, appId));
}

main();
