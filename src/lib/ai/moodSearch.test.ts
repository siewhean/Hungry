import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import type { DishDetail, SearchFilters, TasteVector } from "@/types/domain";
import {
  applyMoodIntent,
  parseMoodIntent,
  rankMoodResults,
  shouldTryMoodSearch,
} from "./moodSearch";

const USUAL: TasteVector = { sweet: 3, spicy: 8, sour: 2, salty: 5, rich: 6, aromatic: 6 };

const FILTERS: SearchFilters = {
  query: "something soupy not too spicy under $8",
  categories: [],
  dietaryFlags: ["halal"],
  tasteValues: USUAL,
  radius: 1000,
};

function dish(id: string, name: string, price: number, tasteTags: string[] = []): DishDetail {
  return { id, name, price, tasteTags } as unknown as DishDetail;
}

test("mood search only runs for a sentence that matched no dish names", () => {
  assert.equal(shouldTryMoodSearch("something soupy", 0), true);
  assert.equal(shouldTryMoodSearch("laksa", 0), false);
  assert.equal(shouldTryMoodSearch("chicken rice", 4), false);
});

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

test("applyMoodIntent shifts taste within 0-10 and merges budget and dietary needs", () => {
  const intent = parseMoodIntent({
    tasteShift: { spicy: -3, sour: -4 },
    maxPrice: 8,
    dietaryFlags: ["vegetarian"],
    keywords: ["soup"],
    summary: "soupy, mild, under $8",
  });
  assert.ok(intent);
  const mood = applyMoodIntent(FILTERS, USUAL, intent);
  assert.equal(mood.tasteVector.spicy, 5);
  assert.equal(mood.tasteVector.sour, 0);
  assert.equal(mood.tasteVector.rich, 6);
  assert.equal(mood.filters.query, "");
  assert.equal(mood.filters.maxPrice, 8);
  assert.deepEqual(mood.filters.dietaryFlags, ["halal", "vegetarian"]);
  assert.deepEqual(mood.filters.tasteValues, mood.tasteVector);
});

test("rankMoodResults keeps taste order, lifts keyword matches and drops dishes over budget", () => {
  const intent = parseMoodIntent({ maxPrice: 8, keywords: ["soup"], summary: "" });
  assert.ok(intent);
  const ranked = rankMoodResults(
    [
      dish("a", "Char kway teow", 6),
      dish("b", "Fish soup", 7),
      dish("c", "Lobster soup", 30),
      dish("d", "Ban mian", 5, ["soup"]),
    ],
    intent,
  );
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["b", "d", "a"],
  );
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
