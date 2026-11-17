import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const VERSION = "20261116120000_reviews_survive_dish_removal";
const migration = read(`supabase/migrations/${VERSION}.sql`);
const down = read(`supabase/rollbacks/${VERSION}.down.sql`);
const smoke = read("supabase/smoke/reviews_survive_dish_removal.sql");
const loader = read("scripts/load_workbook_catalog_snapshot.py");

test("the migration makes reviews.dish_id restrict deletes and deletes no rows", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/reviews_survive_dish_removal\.sql/m);
  assert.match(migration, /references public\.dishes \(id\) on delete restrict/);
  assert.match(migration, /c\.confdeltype\s*=|v_action = 'r'/);
  assert.doesNotMatch(migration, /^\s*(delete\s+from|truncate|update)\b/im);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im);
});

test("the down migration restores ON DELETE CASCADE and is a no-op when already cascading", () => {
  assert.match(down, /references public\.dishes \(id\) on delete cascade/);
  assert.match(down, /v_action = 'c'/);
  assert.doesNotMatch(down, /^\s*(begin|commit);/im);
});

test("the smoke proves refuse, archive-keeps-review and unreviewed-delete", () => {
  assert.match(smoke, /foreign_key_violation/);
  assert.match(smoke, /set archived_at = now\(\)/);
  assert.match(smoke, /get_item_details/);
  assert.match(smoke, /delete from dishes where id = 'smoke-r02-unreviewed'/);
  assert.match(smoke, /insert into buildings/); // creates its own building
  assert.match(smoke, /\nrollback;\s*$/);
});

test("the catalog loader's replace refusal tells the operator to archive reviewed dishes", () => {
  assert.match(loader, /--replace refused: % rows in % reference catalog tables/);
  assert.match(loader, /archive dishes that have reviews/);
});
