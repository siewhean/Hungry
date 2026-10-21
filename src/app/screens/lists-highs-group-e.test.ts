import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("H40: the newest portfolio_items SELECT grant to authenticated is column-scoped without private_notes", () => {
  const dir = "supabase/migrations";
  const files = readdirSync(resolve(process.cwd(), dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  let lastGrant: { file: string; statement: string } | null = null;
  for (const file of files) {
    const sql = read(`${dir}/${file}`).replace(/--.*$/gm, "");
    for (const statement of sql.split(";")) {
      if (
        /grant\s+select\b[\s\S]*\bon\s+table\s+public\.portfolio_items\s+to\s+[^;]*\bauthenticated\b/i.test(
          statement,
        )
      ) {
        lastGrant = { file, statement };
      }
    }
  }
  assert.ok(lastGrant, "expected a portfolio_items SELECT grant");
  assert.match(lastGrant.statement, /grant\s+select\s*\(/i, `${lastGrant.file} grants table-wide SELECT`);
  assert.doesNotMatch(lastGrant.statement, /private_notes/);
  assert.match(
    read(`${dir}/${lastGrant.file}`),
    /revoke select on table public\.portfolio_items from public, anon, authenticated/,
  );
  assert.match(
    read("supabase/smoke/portfolio_items_restore_private_notes_column_guard.sql"),
    /has_column_privilege\('authenticated', 'public\.portfolio_items', 'private_notes', 'select'\)/,
  );
});
