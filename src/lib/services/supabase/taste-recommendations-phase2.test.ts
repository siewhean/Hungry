import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261017191500_taste_recommendations_confidence_tags.sql",
  ),
  "utf8",
);

test("server ranking keeps the RPC signature and search path", () => {
  assert.match(
    sql,
    /create or replace function public\.get_taste_recommendations\(\s*p_surface text,/i,
  );
  assert.match(sql, /p_limit integer default 20\s*\)/i);
  assert.match(sql, /security invoker\s*set search_path = public, extensions/i);
});

test("server ranking weights AI vectors by confidence like the on-device engine", () => {
  assert.match(sql, /when dtv\.source = 'default' then 1::double precision/i);
  assert.match(sql, /0\.50 \* tg\.confidence \* tg\.taste_score/i);
  assert.match(sql, /\(0\.15 \+ 0\.25 \* \(1 - tg\.confidence\)\) \* tg\.distance_score/i);
  assert.match(sql, /\(0\.10 \+ 0\.25 \* \(1 - tg\.confidence\)\) \* tg\.rating_score/i);
});

test("server ranking blends 20% tag overlap from the caller's own favourites", () => {
  assert.match(sql, /from user_favourite_dishes f[\s\S]*where f\.user_id = auth\.uid\(\)/i);
  assert.match(sql, /0\.80 \* vc\.vector_score/i);
  assert.match(sql, /0\.20 \* least\(/i);
});
