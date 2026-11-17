import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const migration = fs.readFileSync(
  path.join(repoRoot, "supabase/migrations/20261017183700_dish_taste_tagging.sql"),
  "utf8",
);
const edgeFunction = fs.readFileSync(
  path.join(repoRoot, "supabase/functions/tag-dishes/index.ts"),
  "utf8",
);

test("tagging functions run only as the service role", () => {
  for (const fn of [
    "dishes_needing_taste_tags(integer, text)",
    "apply_dish_flavor_tag(uuid, uuid)",
  ]) {
    const escaped = fn.replace(/[()]/g, "\\$&");
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${escaped} to service_role`),
    );
  }
  assert.equal((migration.match(/security definer/g) ?? []).length, 2);
  assert.equal((migration.match(/set search_path = public, pg_temp/g) ?? []).length, 2);
});

test("applying a suggestion never writes dietary flags", () => {
  assert.doesNotMatch(migration, /dish_dietary_flags/);
  assert.doesNotMatch(edgeFunction, /dish_dietary_flags/);
});

test("tag-dishes auto-applies only at confidence 0.7 or higher and never suggests halal", () => {
  assert.match(edgeFunction, /const AUTO_APPLY_CONFIDENCE = 0\.7;/);
  assert.match(edgeFunction, /confidence >= AUTO_APPLY_CONFIDENCE/);
  const dietary = edgeFunction.match(/const DIETARY_FLAGS = \[([^\]]*)\]/)?.[1] ?? "";
  assert.doesNotMatch(dietary, /halal/);
});

test("tag-dishes keeps the Anthropic key server-side behind a worker token", () => {
  assert.match(edgeFunction, /TASTE_TAGGING_WORKER_TOKEN/);
  assert.match(edgeFunction, /new Anthropic\(\)/);
  assert.doesNotMatch(edgeFunction, /sk-ant-/);
});
