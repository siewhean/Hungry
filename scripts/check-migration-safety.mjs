// CI gate for the safe-migration process (supabase/manual/safe-migration-runbook.md).
// Every migration newer than CUTOFF_VERSION needs:
//   1. a down migration in supabase/rollbacks/<same name>.down.sql
//   2. staging rehearsal evidence in supabase/rehearsals/<version>.json whose hashes
//      match the migration and down files byte for byte
// A migration can opt out with a visible header comment (`-- no-down: <reason>`,
// `-- no-rehearsal: <reason>`). Waivers need the owner's explicit approval.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CUTOFF_VERSION = "20261022120000";
export const PROD_REF = "yrlxjeovwslirseajomz";
export const REQUIRED_EVIDENCE_STEPS = [
  "backup",
  "up",
  "down",
  "schema_roundtrip",
  "data_roundtrip",
  "reapply",
];

const FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const DESTRUCTIVE_DOWN =
  /^\s*(drop\s+(table|column|schema)|alter\s+table\s+[^;]*\bdrop\s+column|truncate\b|delete\s+from)\b/im;

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function header(sql, key) {
  const match = sql.match(new RegExp(`^\\s*--\\s*${key}\\s*:?\\s*(.*)$`, "im"));
  return match ? match[1].trim() : null;
}

function hasTransactionControl(sql) {
  return /^\s*(begin|commit|rollback|start\s+transaction)\s*;/im.test(stripSqlComments(sql));
}

export function checkMigrationSafety({ migrations, rollbacks, rehearsals, smokes = null }) {
  const problems = [];
  const seen = new Map();

  for (const m of migrations) {
    const match = FILE_PATTERN.exec(m.name);
    if (match) {
      if (seen.has(match[1])) {
        problems.push(`${m.name}: version ${match[1]} is also used by ${seen.get(match[1])}`);
      }
      seen.set(match[1], m.name);
    }
  }

  const migrationBases = new Set(migrations.map((m) => m.name.replace(/\.sql$/, "")));
  for (const r of rollbacks) {
    const base = r.name.replace(/\.down\.sql$/, "");
    if (!r.name.endsWith(".down.sql") || !migrationBases.has(base)) {
      problems.push(
        `supabase/rollbacks/${r.name}: no matching migration (expected <migration name>.down.sql)`,
      );
    }
  }

  for (const m of migrations) {
    const match = FILE_PATTERN.exec(m.name);
    if (!match) continue; // legacy 0001_... baseline files
    const [, version] = match;
    if (version <= CUTOFF_VERSION) continue;

    const where = `supabase/migrations/${m.name}`;
    const base = m.name.replace(/\.sql$/, "");
    const noDown = header(m.sql, "no-down");
    const noRehearsal = header(m.sql, "no-rehearsal");
    const noTx = header(m.sql, "no-transaction") !== null;
    for (const [key, value] of [
      ["no-down", noDown],
      ["no-rehearsal", noRehearsal],
    ]) {
      if (value !== null && value.length < 10) {
        problems.push(`${where}: "-- ${key}:" needs a reason of at least 10 characters`);
      }
    }

    if (!noTx && hasTransactionControl(m.sql)) {
      problems.push(
        `${where}: remove begin/commit; the migration runner wraps each migration in one transaction (or add "-- no-transaction: <reason>")`,
      );
    }

    const down = rollbacks.find((r) => r.name === `${base}.down.sql`);
    if (!down && noDown === null) {
      problems.push(
        `${where}: missing supabase/rollbacks/${base}.down.sql (or a "-- no-down: <reason>" header)`,
      );
    }
    if (down) {
      if (!noTx && hasTransactionControl(down.sql)) {
        problems.push(
          `supabase/rollbacks/${down.name}: remove begin/commit; the runner wraps the down migration in one transaction`,
        );
      }
      if (
        DESTRUCTIVE_DOWN.test(stripSqlComments(down.sql)) &&
        !/rollback_archive/.test(down.sql) &&
        header(down.sql, "down-loses-data") === null
      ) {
        problems.push(
          `supabase/rollbacks/${down.name}: drops or deletes data without copying it to the rollback_archive schema first (or add "-- down-loses-data: <reason>")`,
        );
      }
    }

    const smokeHeaders = [...m.sql.matchAll(/^\s*--\s*smoke\s*:\s*(\S+)/gim)].map((x) => x[1]);
    if (noRehearsal === null && smokeHeaders.length === 0) {
      problems.push(
        `${where}: add a "-- smoke: supabase/smoke/<file>.sql" header (or "-- smoke: none <reason>")`,
      );
    }
    for (const file of smokeHeaders) {
      if (file !== "none" && smokes && !smokes.includes(file))
        problems.push(`${where}: smoke file ${file} does not exist`);
    }

    if (noRehearsal === null) {
      const evidence = rehearsals.find((e) => e.name === `${version}.json`);
      if (!evidence) {
        problems.push(
          `${where}: no staging rehearsal evidence at supabase/rehearsals/${version}.json (run scripts/db/rehearse.sh ${version})`,
        );
      } else if (evidence.error) {
        problems.push(`supabase/rehearsals/${evidence.name}: ${evidence.error}`);
      } else {
        const e = evidence.json;
        const at = `supabase/rehearsals/${evidence.name}`;
        if (e.result !== "pass") problems.push(`${at}: result is not "pass"`);
        if (e.version !== version) problems.push(`${at}: version does not match the migration`);
        if (e.up_sha256 !== sha256(m.sql))
          problems.push(
            `${at}: migration changed since it was rehearsed (re-run scripts/db/rehearse.sh ${version})`,
          );
        if (down && e.down_sha256 !== sha256(down.sql))
          problems.push(
            `${at}: down migration changed since it was rehearsed (re-run scripts/db/rehearse.sh ${version})`,
          );
        if (!down && noDown !== null && e.down_sha256)
          problems.push(`${at}: down_sha256 recorded but there is no down file`);
        if (e.prod_schema_matched !== true)
          problems.push(
            `${at}: staging's schema was not verified against production's before the rehearsal`,
          );
        if (!e.staging_ref || e.staging_ref === PROD_REF)
          problems.push(`${at}: staging_ref must be a project other than production`);
        for (const step of REQUIRED_EVIDENCE_STEPS) {
          if (
            noDown !== null &&
            ["down", "schema_roundtrip", "data_roundtrip", "reapply"].includes(step)
          )
            continue;
          if (e.steps?.[step] !== true) problems.push(`${at}: step "${step}" did not pass`);
        }
        if (Array.isArray(e.rows_lost) && e.rows_lost.length > 0) {
          problems.push(`${at}: rows were lost in ${e.rows_lost.join(", ")}`);
        }
      }
    }
  }
  return problems;
}

function readDir(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(predicate)
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

export function loadRepoState(root = process.cwd()) {
  const migrations = readDir(path.join(root, "supabase", "migrations"), (n) => n.endsWith(".sql"));
  const rollbacks = readDir(path.join(root, "supabase", "rollbacks"), (n) => n.endsWith(".sql"));
  const rehearsals = readDir(path.join(root, "supabase", "rehearsals"), (n) =>
    n.endsWith(".json"),
  ).map(({ name, sql }) => {
    try {
      return { name, json: JSON.parse(sql) };
    } catch {
      return { name, error: "not valid JSON" };
    }
  });
  const smokes = readDir(path.join(root, "supabase", "smoke"), (n) => n.endsWith(".sql")).map(
    (f) => `supabase/smoke/${f.name}`,
  );
  return { migrations, rollbacks, rehearsals, smokes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const problems = checkMigrationSafety(loadRepoState());
  if (problems.length > 0) {
    console.error("Migration safety check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    console.error("\nSee supabase/manual/safe-migration-runbook.md");
    process.exit(1);
  }
  console.log("Migration safety check passed.");
}
