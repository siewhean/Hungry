// Runs the component and screen render tests (`*.render.test.tsx`) in jsdom with
// react-native-web. They live apart from `npm test` because they swap `react-native` for
// react-native-web and stub the native modules (see src/test/renderPreload.cjs).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith(".render.test.tsx")) found.push(path.relative(repoRoot, full));
  }
  return found;
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : walk(path.join(repoRoot, "src")).sort();
const run = spawnSync(
  process.execPath,
  [
    "--require",
    "./src/test/render/dom.cjs",
    "--require",
    "./src/test/renderPreload.cjs",
    "--import",
    "tsx",
    "--test",
    ...files,
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      HUNGRY_DATA_SOURCE: "mock",
      HUNGRY_DISABLE_ASYNC_STORAGE: "1",
      HUNGRY_DISABLE_SECURE_STORE: "1",
      TSX_TSCONFIG_PATH: "tsconfig.render.json",
    },
  },
);
process.exit(run.status ?? 1);
