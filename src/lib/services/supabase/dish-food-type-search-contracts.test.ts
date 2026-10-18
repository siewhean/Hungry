import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync("supabase/migrations/20261018170000_dish_food_types.sql", "utf8");

test("dishes carry a vetted food type and course", () => {
  assert.match(migration, /add column if not exists food_type text/);
  assert.match(migration, /add column if not exists course text/);
  assert.match(migration, /course in \('Main', 'Side', 'Drink', 'Dessert & bakery'\)/);
});

test("published dish cards pick up the dish food type", () => {
  assert.match(
    migration,
    /alter table public\.catalog_raw_dish_cards add column if not exists food_type text/,
  );
  assert.match(migration, /before insert on public\.catalog_raw_dish_cards/);
});

test("both dish search paths match the food type", () => {
  assert.match(migration, /create or replace function public\.search_dishes\(/);
  assert.match(migration, /coalesce\(d\.food_type, ''\) ilike '%' \|\| params\.query \|\| '%'/);
  assert.match(migration, /create or replace function public\.catalog_raw_dishes_page\(/);
  assert.match(migration, /c\.food_type ilike '%' \|\| p_query \|\| '%'/);
});

test("every loaded dish has a vetted food type", () => {
  const rows = readFileSync("data/dish_food_types/dish_food_types.csv", "utf8").trim().split("\n");
  const dishIds = readFileSync("data/catalog_load/dishes.csv", "utf8").match(/^dsh-[^,]+/gm) ?? [];
  assert.equal(rows[0], "dish_id,food_type,course");
  assert.equal(rows.length - 1, dishIds.length);
});
