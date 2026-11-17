import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("phase7 dietary flag migration seeds the canonical six flags", () => {
  const sql = readRepoFile("supabase/migrations/0005_seed_dietary_flags.sql");
  for (const slug of ["halal", "vegetarian", "vegan", "pork_free", "nut_free", "gluten_free"]) {
    assert.ok(sql.includes(`'${slug}'`), `Expected slug '${slug}' in dietary seed migration.`);
  }
});

test("phase7 venue category migration seeds expected category slugs", () => {
  const sql = readRepoFile("supabase/migrations/0006_seed_venue_categories.sql");
  for (const slug of ["local_favourites", "noodles", "rice", "desserts", "late_night"]) {
    assert.ok(
      sql.includes(`'${slug}'`),
      `Expected slug '${slug}' in venue category seed migration.`,
    );
  }
});

test("phase7 dish rating trigger migration defines trigger and function", () => {
  const sql = readRepoFile("supabase/migrations/0007_update_dish_rating_trigger.sql");
  assert.match(sql, /create or replace function public\.update_dish_rating\(\)/i);
  assert.match(sql, /create trigger trg_update_dish_rating/i);
  assert.match(sql, /after insert or update or delete on reviews/i);
});

test("phase7 auth scaffold migration includes guest session, orders, and chat policy surfaces", () => {
  const sql = readRepoFile("supabase/migrations/0008_phase7_auth_scaffold.sql");
  assert.match(sql, /create table if not exists guest_sessions/i);
  assert.match(sql, /device_id text not null/i);
  assert.match(sql, /'legacy-' \|\| id::text/i);
  assert.match(sql, /create table if not exists orders/i);
  assert.match(sql, /create table if not exists chat_messages/i);
  assert.match(sql, /create policy "orders_select_own"/i);
  assert.match(sql, /create policy "chat_messages_select_own"/i);
});

test("guest sessions edge function scaffold exposes POST handler semantics", () => {
  const source = readRepoFile("supabase/functions/guest-sessions/index.ts");
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /createGuestToken/);
  assert.match(source, /sha256Hex/);
  assert.match(source, /\.from\("guest_sessions"\)/);
  assert.match(source, /GUEST_SESSION_API_KEY/);
  assert.match(source, /GUEST_SESSION_ALLOWED_ORIGINS/);
  assert.match(source, /x-guest-session-key/);
  assert.match(source, /Access-Control-Allow-Headers[\s\S]*x-guest-session-key/i);
  assert.match(source, /if \(!origin\)[\s\S]*return "\*";/);
  assert.match(source, /MAX_SESSIONS_PER_DEVICE_PER_HOUR/);
});

test("phase7 smoke SQL scripts exist for PostGIS and pgvector checks", () => {
  const postgisSql = readRepoFile("supabase/smoke/postgis_distance.sql");
  const vectorSql = readRepoFile("supabase/smoke/pgvector_similarity.sql");
  assert.match(postgisSql, /st_distance/i);
  assert.match(vectorSql, /vector_cosine_ops/i);
  assert.match(vectorSql, /using hnsw/i);
});

test("generated seed SQL is non-destructive and deterministic", () => {
  const generatorSource = readRepoFile("scripts/seed/generateSeedSQL.ts");
  const seedSql = readRepoFile("supabase/seed.sql");
  assert.match(generatorSource, /RELATIVE_TIME_BASE_ISO/);
  assert.doesNotMatch(seedSql, /\ntruncate table\b/i);
  assert.match(seedSql, /on conflict/i);
});
