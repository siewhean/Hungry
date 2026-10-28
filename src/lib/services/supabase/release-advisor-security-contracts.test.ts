import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const migration = readRepoFile(
  "supabase/migrations/20260619110000_release_advisor_security_cleanup.sql",
);
const cursorHardening = readRepoFile(
  "supabase/migrations/20261025090000_catalog_hide_non_consumer_venues.sql",
);

test("release advisor cleanup fixes catalog helper search paths", () => {
  for (const signature of [
    "catalog_url_is_delivery_app(text)",
    "catalog_display_image_url(text, boolean, text, text)",
    "catalog_menu_is_displayable(boolean, text, text)",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter\\s+function\\s+public\\.${signature.replace(/[()]/g, "\\$&")}`, "i"),
    );
  }
  assert.match(migration, /set\s+search_path\s+=\s+public,\s*pg_catalog/i);
});

test("raw catalog cursor helpers are service-role only", () => {
  for (const signature of ["catalog_raw_cursor\\(jsonb\\)", "catalog_raw_cursor_value\\(text\\)"]) {
    assert.match(
      cursorHardening,
      new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated;`),
    );
    assert.match(
      cursorHardening,
      new RegExp(`grant execute on function public\\.${signature} to service_role;`),
    );
  }
});

test("customer promotion reads are RLS-backed invoker calls", () => {
  assert.match(migration, /merchant_outlets_public_live_select/i);
  assert.match(migration, /merchant_promotions_public_active_select/i);
  assert.match(migration, /grant\s+select\s*\(\s*id,\s*venue_id,\s*is_live\s*\)/i);
  assert.match(migration, /grant\s+select\s*\([\s\S]*target_audience[\s\S]*created_at[\s\S]*\)/i);
  assert.match(
    migration,
    /alter\s+function\s+public\.list_customer_active_promotions\(text,\s*text\)\s+security\s+invoker/i,
  );
});

test("activity functions keep trigger behavior without direct app-role execution", () => {
  for (const functionName of [
    "trg_activity_on_post_like",
    "trg_activity_on_post_comment",
    "trg_activity_on_follow",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\(\\)[\\s\\S]*from\\s+public,\\s*anon,\\s*authenticated`,
        "i",
      ),
    );
  }

  assert.match(
    migration,
    /alter\s+function\s+public\.mark_activity_read\(uuid\)\s+security\s+invoker/i,
  );
});

test("user stall submissions are inserted through authenticated RLS", () => {
  assert.match(migration, /user_stall_submissions_insert_own_pending/i);
  assert.match(migration, /auth\.uid\(\)\s+=\s+user_id/i);
  assert.match(migration, /status\s+=\s+'pending'/i);
  assert.match(
    migration,
    /grant\s+insert\s*\([\s\S]*gallery_images[\s\S]*postal_code[\s\S]*menu_items[\s\S]*\)/i,
  );

  const overloadChecks = migration.match(/security\s+invoker/gim) ?? [];
  assert.ok(overloadChecks.length >= 5, "expected public RPCs and overloads to become invoker");
  assert.doesNotMatch(
    migration,
    /grant\s+execute[\s\S]*submit_user_stall_submission[\s\S]*to\s+anon/i,
  );
});
