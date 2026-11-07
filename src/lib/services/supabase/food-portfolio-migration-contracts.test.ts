// Source contracts for the Food Portfolio migration (20261107090000) and its entry points.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261107090000_food_portfolio_pages.sql");
const rollback = read("supabase/rollbacks/20261107090000_food_portfolio_pages.down.sql");

const RPCS = [
  ["get_food_portfolio_top_posts", "uuid"],
  ["get_food_portfolio_stalls", "uuid, integer"],
  ["get_following_dish_feed", "integer, timestamptz, uuid"],
  ["set_pinned_posts", "uuid[]"],
] as const;

test("each RPC is a volatile invoker wrapper over an app_private definer body, signed-in only, rate limited", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/food_portfolio_pages\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  for (const [name, args] of RPCS) {
    const wrapper = new RegExp(
      `create or replace function public\\.${name}\\([\\s\\S]*?language sql\\s+volatile\\s+security invoker`,
    );
    assert.match(migration, wrapper, `${name} wrapper is volatile and invoker`);
    const body = new RegExp(
      `create or replace function app_private\\.${name}\\([\\s\\S]*?volatile\\s+security definer\\s+set search_path = public, pg_temp`,
    );
    assert.match(migration, body, `${name} body is a pinned-search-path definer`);
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${name}\\(${args.replace(/[[\]]/g, "\\$&")}\\) from public, anon;`,
      ),
      `anon cannot run ${name}`,
    );
    assert.match(migration, new RegExp(`\\('rpc/${name}', null, \\d+,`), `${name} has a rate rule`);
    assert.match(
      rollback,
      new RegExp(`drop function if exists public\\.${name}\\(`),
      `down drops ${name}`,
    );
    assert.match(rollback, new RegExp(`drop function if exists app_private\\.${name}\\(`));
  }
});

test("reads apply the same visibility as a single post read", () => {
  for (const name of [
    "get_food_portfolio_top_posts",
    "get_food_portfolio_stalls",
    "get_following_dish_feed",
  ]) {
    const start = migration.indexOf(`create or replace function app_private.${name}(`);
    const body = migration.slice(
      start,
      migration.indexOf("$$;", migration.indexOf("as $$", start)),
    );
    assert.match(body, /auth\.uid\(\) is not null/, `${name}: signed-in only`);
    assert.match(body, /p\.status = 'published'/);
    assert.match(body, /p\.deleted_at is null/);
    assert.match(body, /post_moderation_states/);
    assert.match(body, /hidden_posts/);
    assert.match(
      body,
      /app_private\.can_read_post\(p\.id\)/,
      `${name}: private accounts and blocks`,
    );
  }
  const feed = migration.slice(
    migration.indexOf("create or replace function app_private.get_following_dish_feed("),
  );
  assert.match(feed, /f\.status = 'approved'/, "pending follow requests never see posts");
});

test("pins are one UPDATE limited to your own published posts, three at most", () => {
  assert.match(migration, /check \(cardinality\(pinned_post_ids\) <= 3\)/);
  const body = migration.slice(
    migration.indexOf("create or replace function app_private.set_pinned_posts("),
  );
  assert.match(body, /update public\.user_profiles up\s+set pinned_post_ids = coalesce\(\(/);
  assert.match(body, /p\.author_id = v_user/);
  assert.match(body, /where up\.id = v_user/);
  assert.match(
    rollback,
    /rollback_archive\.user_profiles_pinned_post_ids_20261107090000/,
    "pins archived before the drop",
  );
  assert.match(rollback, /^-- expect-row-loss: app_private\.request_rate_rules/m);
});

test("Post a dish is reachable from the dish page and stall page only with the Food Portfolio flag", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  assert.match(
    dish,
    /FEATURE_FLAGS\.foodPortfolioEnabled[\s\S]{0,200}id: "post-dish"[\s\S]{0,400}navigation\.navigate\("Post", \{ dishId: dish\.id, venueId: dish\.venueId \}\)/,
  );
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(
    stall,
    /FEATURE_FLAGS\.foodPortfolioEnabled \? \([\s\S]{0,200}label="Post a dish here"[\s\S]{0,500}navigation\.navigate\("Post", \{ venueId: venue\.id \}\)/,
  );
  const composer = read("src/app/screens/post/PostComposerScreen.tsx");
  assert.match(
    composer,
    /FEATURE_FLAGS\.foodPortfolioEnabled && navigation\.canGoBack\(\)\) \{\s+navigation\.goBack\(\);/,
    "a posted dish returns to the page it came from, not Discover",
  );
  const root = read("src/app/navigation/RootNavigator.tsx");
  assert.match(
    root,
    /FEATURE_FLAGS\.foodPortfolioEnabled \? \(\s+<RootStack\.Screen getComponent=\{loadFollowingFeedScreen\} name="FollowingFeed" \/>/,
  );
});
