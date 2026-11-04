// Merchant round-four phase 1 contracts: colours on orange, hex-alpha tokens, the archived-dish
// SQL and the Insights wiring. Source reads only; behaviour is in the render and service tests.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { colors } from "@/theme/tokens";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("R4-8: Home's Manage menu card puts white text on a background that passes 4.5:1 in both palettes", () => {
  const home = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");
  const card = home.slice(
    home.indexOf('"Manage menu. Update prices'),
    home.indexOf("Business tools"),
  );
  assert.match(card, /backgroundColor: palette\.orangeControl/);
  assert.doesNotMatch(card, /inverseTextSecondary|textOnOrange|palette\.orange,|orangeLight/);
  for (const mode of ["light", "dark"] as const) {
    const ratio = contrast(colors[mode].white, colors[mode].orangeControl);
    assert.ok(ratio >= 4.5, `${mode}: white on orangeControl is ${ratio.toFixed(2)}:1`);
  }
});

test("R4-8: no merchant screen glues a hex alpha onto a token that is rgba in either palette", () => {
  const dir = "src/app/screens/merchant";
  const files = readdirSync(resolve(process.cwd(), dir)).filter(
    (name) => name.endsWith(".tsx") && !name.includes(".test."),
  );
  const offenders: string[] = [];
  for (const file of files) {
    const source = read(`${dir}/${file}`);
    for (const match of source.matchAll(/palette\.(\w+)\s*\+\s*"[0-9A-Fa-f]{2}"/g)) {
      const token = match[1] as keyof typeof colors.light;
      for (const mode of ["light", "dark"] as const) {
        const value = colors[mode][token] as string | undefined;
        if (!value || !/^#[0-9A-Fa-f]{6}$/.test(value))
          offenders.push(`${file}: palette.${token} (${mode})`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("MERCH-1/12: the feed, the dish page and the dashboard counts skip archived dishes", () => {
  const up = read(
    "supabase/migrations/20261029140000_merchant_archived_dishes_and_insight_facts.sql",
  );
  const down = read(
    "supabase/rollbacks/20261029140000_merchant_archived_dishes_and_insight_facts.down.sql",
  );
  assert.match(up, /^-- smoke: supabase\/smoke\/merchant_archived_dishes_and_insight_facts\.sql/m);
  assert.doesNotMatch(up, /^\s*(begin|commit);/im, "no transaction control in a migration");
  assert.match(up, /v_hits <> 3/, "three has_menu subqueries are patched");
  assert.match(up, /d\.venue_id = cv\.id\\n\s+and d\.archived_at is null/);
  assert.match(up, /where d\.id = p_dish_id\\n\s+and d\.archived_at is null/);
  assert.match(
    up,
    /menuCount', \(\s+select count\(\*\)::integer\s+from public\.dishes d\s+where d\.venue_id = v_venue_id and d\.archived_at is null/,
  );
  assert.match(down, /drop function if exists public\.get_merchant_insight_facts\(uuid\)/);
  assert.ok(
    read("supabase/smoke/merchant_archived_dishes_and_insight_facts.sql").includes("rollback;"),
  );
});

test("MERCH-R4-3: the facts RPC is invoker, signed-in only, and Insights reads it once", () => {
  const up = read(
    "supabase/migrations/20261029140000_merchant_archived_dishes_and_insight_facts.sql",
  );
  const facts = up.slice(up.indexOf("function public.get_merchant_insight_facts"));
  assert.match(facts, /security invoker/);
  assert.match(
    facts,
    /revoke all on function public\.get_merchant_insight_facts\(uuid\) from public, anon/,
  );
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /rpc\("get_merchant_insight_facts"/);
  assert.doesNotMatch(read("src/lib/services/mock/data.ts"), /merchantAIInsights/);
});

test("R4-7: the inbox refreshes on focus and by pull-to-refresh", () => {
  const inbox = read("src/app/screens/merchant/CustomerInboxScreen.tsx");
  assert.match(inbox, /refreshControl=/);
  assert.match(inbox, /hasFocusedOnce\.current\) void refreshInboxRef\.current\(\)/);
});
