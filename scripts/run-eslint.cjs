#!/usr/bin/env node

const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const HOMEBREW_NODE = "/opt/homebrew/bin/node";

function selectNode() {
  if (
    process.platform === "darwin" &&
    process.execPath.includes("/Applications/Codex.app/") &&
    existsSync(HOMEBREW_NODE)
  ) {
    return HOMEBREW_NODE;
  }

  return process.execPath;
}

const eslintPackageJson = require.resolve("eslint/package.json");
const eslintBin = `${eslintPackageJson.replace(/package\.json$/, "")}bin/eslint.js`;
const result = spawnSync(selectNode(), [eslintBin, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
