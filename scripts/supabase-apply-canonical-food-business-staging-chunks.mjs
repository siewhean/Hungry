#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const defaultDir = "/tmp/hungry-canonical-food-business-staging-sql";
const chunkDir = resolve(process.argv[2] ?? defaultDir);
const command = process.platform === "win32" ? "npx.cmd" : "npx";

function runQuery(filePath, index, total) {
  return new Promise((resolveRun) => {
    console.log(`[canonical-food-business-staging] applying ${index}/${total}: ${filePath}`);
    const child = spawn(
      command,
      ["--no-install", "supabase", "db", "query", "--linked", "-f", filePath, "-o", "table"],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );
    child.on("error", (error) => {
      resolveRun({ code: 1, error });
    });
    child.on("close", (code) => {
      resolveRun({ code: code ?? 1 });
    });
  });
}

const entries = await readdir(chunkDir);
const sqlFiles = entries
  .filter((entry) => /^\d{4}_.+\.sql$/.test(entry))
  .sort()
  .map((entry) => resolve(chunkDir, entry));

if (sqlFiles.length === 0) {
  console.error(`[canonical-food-business-staging] no chunk SQL files found in ${chunkDir}`);
  process.exit(1);
}

for (const [index, filePath] of sqlFiles.entries()) {
  const result = await runQuery(filePath, index + 1, sqlFiles.length);
  if (result.code !== 0) {
    if (result.error) console.error(result.error.message);
    console.error(`[canonical-food-business-staging] failed at ${filePath}`);
    process.exit(result.code);
  }
}

console.log(`[canonical-food-business-staging] applied ${sqlFiles.length} chunk files.`);
