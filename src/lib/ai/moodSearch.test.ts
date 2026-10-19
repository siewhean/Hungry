import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parseMoodIntent } from "./moodSearch";

test("parseMoodIntent clamps shifts and drops malformed fields", () => {
  const intent = parseMoodIntent({
    tasteShift: { spicy: -9, rich: 2, sweet: "x" },
    maxPrice: null,
    dietaryFlags: ["vegetarian", 3],
    keywords: ["soup", ""],
    summary: "soupy, mild",
  });
  assert.ok(intent);
  assert.equal(intent.tasteShift.spicy, -5);
  assert.equal(intent.tasteShift.rich, 2);
  assert.equal(intent.tasteShift.sweet, 0);
  assert.equal(intent.maxPrice, undefined);
  assert.deepEqual(intent.dietaryFlags, ["vegetarian"]);
  assert.deepEqual(intent.keywords, ["soup"]);
  assert.equal(parseMoodIntent(null), null);
});

test("mood-search Edge Function caches answers and caps fresh calls per user per day", () => {
  const source = fs.readFileSync("supabase/functions/mood-search/index.ts", "utf8");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /const DAILY_LIMIT = 20;/);
  assert.match(source, /\.eq\("cached", false\)/);
  assert.match(source, /from "\.\.\/_shared\/tasteTagging\.ts"/);
  const migration = fs.readFileSync(
    "supabase/migrations/20261018060000_mood_search_queries.sql",
    "utf8",
  );
  assert.match(migration, /on delete cascade/);
  assert.match(migration, /revoke all on public\.mood_search_queries from anon, authenticated;/);

  // The cap check and the slot claim happen in one locked RPC, not count-then-insert.
  assert.match(source, /client\.rpc\("reserve_mood_search_slot"/);
  assert.match(source, /\.eq\("pending", false\)/);
  const slotMigration = fs.readFileSync(
    "supabase/migrations/20261018091000_push_token_unbind_mood_search_slot.sql",
    "utf8",
  );
  assert.match(slotMigration, /pg_advisory_xact_lock/);
  assert.match(slotMigration, /set search_path = ''/);
  assert.match(
    slotMigration,
    /grant execute on function public\.reserve_mood_search_slot\(uuid, text, integer\) to service_role;/,
  );
});
