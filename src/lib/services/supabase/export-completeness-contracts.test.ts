// SET-2: a table that holds a user's rows must be in the PDPA export (app_private.export_my_data)
// or in supabase/export-allowlist.json with a reason. Parses every migration in order, so a new
// `create table` that references user_profiles or auth.users fails CI until it is covered.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

function userKeyedTablesAndExport() {
  const tables = new Map<string, string>();
  let exportBody = "";
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    for (const match of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi,
    )) {
      let index = (match.index ?? 0) + match[0].length;
      const bodyStart = index;
      let depth = 1;
      while (index < sql.length && depth > 0) {
        const char = sql[index++];
        if (char === "(") depth += 1;
        else if (char === ")") depth -= 1;
      }
      const body = sql.slice(bodyStart, index);
      if (
        /references\s+(?:public\.)?user_profiles\s*\(|references\s+auth\.users\s*\(/i.test(body)
      ) {
        tables.set(match[1].toLowerCase(), file);
      }
    }
    // Foreign keys added later (ADD COLUMN ... references, ADD CONSTRAINT ... references).
    for (const match of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s+([^;]*?);/gis,
    )) {
      if (
        /references\s+(?:public\.)?user_profiles\s*\(|references\s+auth\.users\s*\(/i.test(match[2])
      ) {
        tables.set(match[1].toLowerCase(), file);
      }
    }
    for (const match of sql.matchAll(
      /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi,
    )) {
      tables.delete(match[1].toLowerCase());
    }
    const exportMatch = sql.match(
      /create\s+or\s+replace\s+function\s+app_private\.export_my_data\(\)[\s\S]*?\n\$\$;/i,
    );
    if (exportMatch) exportBody = exportMatch[0];
  }
  return { tables, exportBody };
}

const allowlist = JSON.parse(readRepoFile("supabase/export-allowlist.json")) as {
  tables: Record<string, string>;
};

test("every user-keyed table is in the PDPA export or the allowlist with a reason", () => {
  const { tables, exportBody } = userKeyedTablesAndExport();
  assert.ok(exportBody.length > 0, "found no export_my_data definition");
  assert.ok(tables.size > 30, "the migration parser found too few user-keyed tables");

  const uncovered = [...tables]
    .filter(([table]) => !new RegExp(`public\\.${table}\\b`).test(exportBody))
    .filter(([table]) => !(table in allowlist.tables))
    .map(([table, file]) => `${table} (created in ${file})`);

  assert.deepEqual(
    uncovered,
    [],
    "Add these tables to app_private.export_my_data in a new migration, or list them in " +
      "supabase/export-allowlist.json with the reason they hold no personal content.",
  );
});

test("the allowlist stays honest: reasons are written and tables are not also exported", () => {
  const { tables, exportBody } = userKeyedTablesAndExport();
  for (const [table, reason] of Object.entries(allowlist.tables)) {
    assert.ok(reason.trim().length >= 20, `${table} needs a written reason`);
    assert.ok(
      tables.has(table),
      `${table} is allowlisted but is not a user-keyed table; remove it`,
    );
    assert.ok(
      !new RegExp(`public\\.${table}\\b`).test(exportBody),
      `${table} is exported now; remove it from the allowlist`,
    );
  }
});

test("the three stores SET-2 added are exported", () => {
  const { exportBody } = userKeyedTablesAndExport();
  for (const table of ["dish_taste_ratings", "catalog_corrections", "notification_jobs"]) {
    assert.match(exportBody, new RegExp(`public\\.${table}\\b`));
  }
});
