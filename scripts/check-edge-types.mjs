#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = "supabase/functions";
const entries = readdirSync(directory, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith("_"))
  .map(entry => join(directory, entry.name, "index.ts"))
  .sort();
if (entries.length === 0) throw new Error("No Edge Function entrypoints found.");
const result = spawnSync("npx", ["--yes", "deno@2.9.6", "check", "--frozen", ...entries], {
  stdio: "inherit",
  shell: false,
});
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
