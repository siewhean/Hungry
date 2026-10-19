import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0030_home_social_feed_reads.sql"),
  "utf8",
);

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/home_social_feed_reads.sql"),
  "utf8",
);

const serviceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("0030 adds a bounded Home social feed RPC", () => {
  assert.match(migrationSql, /create\s+or\s+replace\s+function\s+public\.get_home_social_feed\b/i);
  assert.match(migrationSql, /p_limit\s+integer\s+default\s+20/i);
  assert.match(migrationSql, /p_cursor_published_at\s+timestamptz\s+default\s+null/i);
  assert.match(migrationSql, /p_cursor_id\s+uuid\s+default\s+null/i);
  assert.match(migrationSql, /order\s+by\s+feed_cursor_at\s+desc,\s*p\.id\s+desc/i);
  assert.match(migrationSql, /limit\s+\(select\s+result_limit\s+from\s+params\)/i);
});

test("0030 keeps feed reads invoker-safe and visibility-gated", () => {
  const functionBlock =
    /create\s+or\s+replace\s+function\s+public\.get_home_social_feed[\s\S]*?\$\$;/i.exec(
      migrationSql,
    )?.[0];
  assert.ok(functionBlock, "get_home_social_feed body should be detectable");
  assert.match(functionBlock, /security\s+invoker/i);
  assert.doesNotMatch(functionBlock, /security\s+definer/i);
  assert.match(functionBlock, /set\s+search_path\s+=\s+public/i);
  assert.match(functionBlock, /public\.can_read_post\(p\.id\)/i);

  assert.match(
    migrationSql,
    /revoke\s+execute\s+on\s+function\s+public\.get_home_social_feed\(integer,\s*timestamptz,\s*uuid\)\s+from\s+public/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.get_home_social_feed\(integer,\s*timestamptz,\s*uuid\)\s+to\s+authenticated/i,
  );
  assert.doesNotMatch(migrationSql, /to\s+anon/i);
});

test("0030 adds feed indexes without implementing deferred social infrastructure", () => {
  for (const indexName of [
    "idx_posts_home_feed_cursor",
    "idx_posts_feed_published",
    "idx_post_media_post_order",
  ]) {
    assert.match(migrationSql + smokeSql, new RegExp(escapeRegExp(indexName), "i"));
  }

  assert.doesNotMatch(migrationSql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(migrationSql, /\btruncate\s+table\b/i);
  assert.doesNotMatch(migrationSql, /\bpartition\s+by\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(user_feed_items|feed_items|post_reports|hidden_posts|blocked_users|merchant_organizations|menu_versions|media_assets|background_jobs|orders|payments|refunds|payouts)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\balter\s+table\s+(posts|post_media|post_comments|post_likes|post_saves|post_shares)[\s\S]{0,200}\b(alter\s+column\s+id|rename\s+column|drop\s+column|rename\s+to)\b/i,
  );
});

test("Supabase social feed uses RPC-first reads with legacy fallback", () => {
  assert.match(serviceSource, /function\s+asRowArray/i);
  assert.match(serviceSource, /async\s+function\s+fetchHomeSocialFeedBitesViaRpc/i);
  assert.match(serviceSource, /client\.rpc\("get_home_social_feed"/);
  assert.match(
    serviceSource,
    /const\s+rpcBites\s+=\s+await\s+fetchHomeSocialFeedBitesViaRpc\(client\)/,
  );
  assert.match(serviceSource, /if\s+\(rpcBites\)\s+return\s+rpcBites/);
  assert.match(serviceSource, /return\s+fetchPublishedPostBites\(client\)/);
  // v3 first: it carries the viewer's like/save state.
  assert.match(serviceSource, /client\.rpc\("get_home_social_feed_v3"/);
  assert.match(serviceSource, /viewerHasLiked: typeof row\.viewer_has_liked === "boolean"/);
  // Reactions are an idempotent upsert/delete, not read-then-toggle.
  assert.match(serviceSource, /\.from\(table\)[\s\S]{0,40}\.upsert\(/);
  assert.doesNotMatch(serviceSource, /\.from\(table\)[\s\S]{0,80}\.select\("id"\)/);
  assert.doesNotMatch(serviceSource, /\(existing\.data\s+as\s+Row\s+\|\s+null\)\?\.id/);
});

test("home social feed smoke SQL checks function, grants, indexes, guard, and samples", () => {
  assert.match(smokeSql, /'get_home_social_feed'/);
  assert.match(smokeSql, /security_definer_not_allowed/i);
  assert.match(smokeSql, /missing_authenticated_execute/i);
  assert.match(smokeSql, /unexpected_anon_execute/i);
  assert.match(smokeSql, /missing_visibility_guard/i);
  assert.match(smokeSql, /public\.get_home_social_feed\(10,\s*null,\s*null\)/i);
  assert.match(smokeSql, /home_social_feed_reads_smoke_passed/i);
});
