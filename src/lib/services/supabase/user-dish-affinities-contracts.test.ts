import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { AFFINITY_WEIGHTS } from "@/lib/ai/foodHistory";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");
const migration = read("supabase/migrations/20261020080000_user_dish_affinities.sql");

test("food history table is read/delete-own; only the definer function writes it", () => {
  assert.match(migration, /alter table public\.user_dish_affinities enable row level security/);
  assert.match(migration, /grant select, delete on public\.user_dish_affinities to authenticated/);
  assert.match(
    migration,
    /for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
  assert.match(
    migration,
    /for delete to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
  assert.doesNotMatch(migration, /on public\.user_dish_affinities for (insert|update)/);
  assert.match(
    migration,
    /revoke all on function public\.apply_affinity_event\(uuid, text, numeric, timestamptz, boolean\)\s+from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_my_food_history\(integer\) to authenticated/,
  );
  assert.match(migration, /where a\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /add column if not exists buckets jsonb/);
  // PDPA export includes the new table.
  assert.match(
    migration,
    /'foodHistory',\s+coalesce\(\(select jsonb_agg\(to_jsonb\(t\)\) from public\.user_dish_affinities t/,
  );
});

test("SQL weights and half-life match src/lib/ai/foodHistory.ts", () => {
  assert.match(migration, /90 \* 86400/);
  assert.match(migration, /interval '30 days'/);
  assert.match(
    migration,
    new RegExp(`when p_type = 'dismissed' then ${AFFINITY_WEIGHTS.dismissed}`),
  );
  assert.match(
    migration,
    new RegExp(`when p_type = 'dish_like' and p_applied then ${AFFINITY_WEIGHTS.dish_like}`),
  );
  assert.match(
    migration,
    new RegExp(`'food_button_click'\\) and p_applied then ${AFFINITY_WEIGHTS.click}`),
  );
  assert.match(
    migration,
    new RegExp(
      `then ${AFFINITY_WEIGHTS.review_positive}\\s+when p_rating <= 2 then ${AFFINITY_WEIGHTS.review_negative}`,
    ),
  );
  assert.match(
    migration,
    new RegExp(`new\\.dish_id, ${AFFINITY_WEIGHTS.favourite}, new\\.created_at`),
  );
  assert.match(migration, new RegExp(`old\\.dish_id, ${AFFINITY_WEIGHTS.unsaved}, now\\(\\)`));
  assert.match(
    migration,
    new RegExp(`new\\.reference_id, ${AFFINITY_WEIGHTS.dish_tried}, new\\.created_at`),
  );
});

test("dishes map food_type so same-food-other-stall recommendations work", () => {
  assert.match(
    read("src/lib/services/supabase/supabaseRepository.ts"),
    /foodTypeTag: toString\(row\.food_type\) \|\| undefined/,
  );
});

test("Settings offers the openness choice and a food history reset", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.match(settings, /label="Trying new food"/);
  assert.match(settings, /screen: "FoodOpenness",\s+params: \{ mode: "settings" \}/);
  assert.match(settings, /label="Reset food history"/);
});
