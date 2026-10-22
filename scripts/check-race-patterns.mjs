// CI gate for read-then-write races (see "Concurrency" in CLAUDE.md).
//
// Flags, in migrations newer than CUTOFF_VERSION and in app/edge TypeScript:
//   - a function that counts or checks for a row and then inserts, with no lock
//   - a next-position / next-number computed with max(...) + 1 and then inserted
//   - a denormalised counter recomputed with (select count(*) ...) and no lock
//   - a counter written back from a value the code read first (x: row.x + 1)
// A function is fine when it takes a lock (pg_advisory_xact_lock, FOR [NO KEY] UPDATE,
// SKIP LOCKED), uses INSERT .. ON CONFLICT, or carries a visible
// `-- race-ok: <reason of at least 10 characters>` comment.
//
// This is a heuristic. A pass does not prove the code is race free; the two-session checks
// in supabase/race-harness/run.sh do that for the paths they cover.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CUTOFF_VERSION = "20261022150000";

const LOCKS =
  /pg_advisory_xact_lock|pg_advisory_lock|\bfor\s+(no\s+key\s+)?update\b|\bfor\s+share\b|skip\s+locked|\bon\s+conflict\b/i;
const RACE_OK = /--\s*race-ok\s*:\s*\S.{8,}/i;

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

// Split a migration into [{ name, body }] for every dollar-quoted function body.
export function functionBodies(sql) {
  const out = [];
  const re = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi;
  let match;
  while ((match = re.exec(sql))) {
    const tag = /\$(\w*)\$/.exec(sql.slice(re.lastIndex));
    if (!tag) continue;
    const start = re.lastIndex + tag.index + tag[0].length;
    const end = sql.indexOf(tag[0], start);
    if (end === -1) continue;
    out.push({ name: match[1], body: sql.slice(start, end) });
    re.lastIndex = end + tag[0].length;
  }
  return out;
}

export function checkSqlFunction(name, body) {
  if (RACE_OK.test(body) || LOCKS.test(stripComments(body))) return [];
  const sql = stripComments(body);
  const writes = /\binsert\s+into\b/i.test(sql);
  const problems = [];

  const countsThenInserts =
    writes &&
    (/\bcount\s*\(/i.test(sql) || /\bif\s+(not\s+)?exists\s*\(/i.test(sql)) &&
    /\b(raise\s+exception|return\s+null|return\s+v_)/i.test(sql);
  if (countsThenInserts) {
    problems.push(
      `${name}: counts or checks for a row and then inserts without a lock. ` +
        "Take pg_advisory_xact_lock(hashtextextended(<key>, 0)) or lock the parent row first, " +
        "or use INSERT .. ON CONFLICT (or add `-- race-ok: <reason>`).",
    );
  }

  if (writes && /\bmax\s*\([^)]*\)\s*\+\s*1\b/i.test(sql)) {
    problems.push(
      `${name}: computes the next position/number with max(...) + 1 and then inserts. ` +
        "Lock the parent row first (or add `-- race-ok: <reason>`).",
    );
  }

  if (/\bset\b[^;]*\b\w*count\w*\s*=\s*\(\s*select\s+count\s*\(/i.test(sql)) {
    problems.push(
      `${name}: recomputes a counter from a snapshot. Lock the parent row (FOR NO KEY UPDATE) ` +
        "in a statement before the UPDATE so the count sees committed rows (or add `-- race-ok: <reason>`).",
    );
  }
  return problems;
}

export function checkMigration({ name, sql }) {
  return functionBodies(sql).flatMap((fn) =>
    checkSqlFunction(`${name}: ${fn.name}`, fn.body).map((p) => p),
  );
}

// Client/edge code: `.update({ n: Number(row.n ?? 0) + 1 })` writes back a value that was read first.
const TS_COUNTER = /\.update\(\s*\{[^{}]*:[^{}]*[A-Za-z_)\]]\s*[+-]\s*1\b[^{}]*\}/;
const TS_RACE_OK = /\/\/\s*race-ok\s*:\s*\S.{8,}/i;

export function checkTypeScript({ name, text }) {
  if (TS_RACE_OK.test(text)) return [];
  if (!TS_COUNTER.test(text)) return [];
  return [
    `${name}: writes back a counter it read first (.update({ x: row.x + 1 })). ` +
      "Do it in one UPDATE in a database function (x = x + 1) or an RPC, or add `// race-ok: <reason>`.",
  ];
}

function walk(dir, filter, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, filter, acc);
    } else if (filter(full)) acc.push(full);
  }
  return acc;
}

export function run(root = process.cwd()) {
  const problems = [];
  const migrationsDir = path.join(root, "supabase", "migrations");
  for (const file of fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).sort() : []) {
    const version = /^(\d{14})_/.exec(file)?.[1];
    if (!version || version <= CUTOFF_VERSION) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    problems.push(...checkMigration({ name: `supabase/migrations/${file}`, sql }));
  }
  const tsFiles = [
    ...walk(path.join(root, "src", "lib", "services"), (f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)),
    ...walk(path.join(root, "supabase", "functions"), (f) => /\.ts$/.test(f)),
  ];
  for (const file of tsFiles) {
    const text = fs.readFileSync(file, "utf8");
    problems.push(...checkTypeScript({ name: path.relative(root, file), text }));
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const problems = run();
  if (problems.length > 0) {
    console.error("Possible race conditions (see Concurrency in CLAUDE.md):\n");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("No read-then-write patterns found in new migrations or app/edge code.");
}
