// Runs the unit suite with coverage and enforces tests/coverage-baseline.json.
//
//   npm run test:coverage           run and check
//   npm run test:coverage:update    run and rewrite the baseline (only ever ratchets up)
//
// The check fails when
//   - total line, branch or function coverage drops below the baseline,
//   - a file that was already covered loses more than FILE_DROP_TOLERANCE points (or
//     FILE_DROP_TOLERANCE_LINES lines, for small files) of line coverage, or
//   - a file that is new to the report has less than NEW_FILE_MINIMUM percent line coverage.
// Together that means new logic ships with tests, and old logic cannot quietly lose them.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, "tests", "coverage-baseline.json");
const lcovPath = path.join(repoRoot, "coverage", "lcov.info");
const update = process.argv.includes("--update");

const GLOBAL_TOLERANCE = 0.3;
const FILE_DROP_TOLERANCE = 3;
// V8 sometimes reports a function's closing brace as uncovered, and which Node patch version does so
// differs between machines. A small file would fail the percentage rule over one such line.
const FILE_DROP_TOLERANCE_LINES = 3;
const NEW_FILE_MINIMUM = 70;

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith(".test.ts")) found.push(path.relative(repoRoot, full));
  }
  return found;
}

fs.mkdirSync(path.dirname(lcovPath), { recursive: true });
const testFiles = walk(path.join(repoRoot, "src")).sort();
const run = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include=src/**",
    "--test-coverage-exclude=src/**/*.test.ts",
    "--test-coverage-exclude=src/test/**",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=lcov",
    `--test-reporter-destination=${lcovPath}`,
    ...testFiles,
  ],
  {
    cwd: repoRoot,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      HUNGRY_DATA_SOURCE: "mock",
      HUNGRY_DISABLE_ASYNC_STORAGE: "1",
      HUNGRY_DISABLE_SECURE_STORE: "1",
      TSX_TSCONFIG_PATH: "tsconfig.test.json",
    },
  },
);
if (run.status !== 0) {
  console.error("\ntest:coverage: the test run failed, so coverage was not checked.");
  process.exit(run.status ?? 1);
}

const files = {};
const totals = { lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 };
let current = null;
for (const line of fs.readFileSync(lcovPath, "utf8").split("\n")) {
  if (line.startsWith("SF:")) {
    current = path.relative(repoRoot, line.slice(3).trim());
    files[current] = { lf: 0, lh: 0 };
  } else if (current && /^(LF|LH|BRF|BRH|FNF|FNH):/.test(line)) {
    const [key, value] = line.split(":");
    const number = Number(value);
    totals[key.toLowerCase()] += number;
    if (key === "LF") files[current].lf = number;
    if (key === "LH") files[current].lh = number;
  }
}

const pct = (hit, found) => (found === 0 ? 100 : Math.round((hit / found) * 1000) / 10);
const global = {
  lines: pct(totals.lh, totals.lf),
  branches: pct(totals.brh, totals.brf),
  functions: pct(totals.fnh, totals.fnf),
};
const filePct = Object.fromEntries(
  Object.entries(files).map(([file, { lf, lh }]) => [file, pct(lh, lf)]),
);

console.log(
  `\ncoverage: lines ${global.lines}%  branches ${global.branches}%  functions ${global.functions}%`,
);

const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
  : { global: { lines: 0, branches: 0, functions: 0 }, files: {} };

const failures = [];
for (const key of ["lines", "branches", "functions"]) {
  if (global[key] < baseline.global[key] - GLOBAL_TOLERANCE) {
    failures.push(
      `total ${key} coverage fell to ${global[key]}% (baseline ${baseline.global[key]}%)`,
    );
  }
}
for (const [file, value] of Object.entries(filePct)) {
  const before = baseline.files[file];
  if (before === undefined) {
    if (value < NEW_FILE_MINIMUM) {
      failures.push(
        `${file} is new to the coverage report at ${value}% lines; add tests that run it (need ${NEW_FILE_MINIMUM}%)`,
      );
    }
  } else if (
    value <
    // The 0.1 covers the one-decimal rounding of both percentages.
    before - Math.max(FILE_DROP_TOLERANCE, (FILE_DROP_TOLERANCE_LINES / files[file].lf) * 100) - 0.1
  ) {
    failures.push(`${file} fell from ${before}% to ${value}% line coverage`);
  }
}
for (const file of Object.keys(baseline.files)) {
  if (!(file in filePct) && fs.existsSync(path.join(repoRoot, file))) {
    failures.push(`${file} is no longer run by any test (was ${baseline.files[file]}% lines)`);
  }
}

if (update) {
  const next = {
    global: {
      lines: Math.max(global.lines, baseline.global.lines),
      branches: Math.max(global.branches, baseline.global.branches),
      functions: Math.max(global.functions, baseline.global.functions),
    },
    files: Object.fromEntries(
      Object.entries(filePct)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, value]) => [file, Math.max(value, baseline.files[file] ?? 0)]),
    ),
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`coverage baseline written to ${path.relative(repoRoot, baselinePath)}`);
  process.exit(0);
}

if (failures.length > 0) {
  console.error("\ntest:coverage FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    "\nAdd tests for the code you changed. If coverage rose legitimately, run `npm run test:coverage:update` and commit tests/coverage-baseline.json.",
  );
  process.exit(1);
}
console.log("test:coverage: OK");
