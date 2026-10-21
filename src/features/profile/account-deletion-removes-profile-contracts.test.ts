// Round-two settings critical: deleting an account must remove the profile so its cascades fire.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261021100000_account_deletion_removes_profile.sql"),
  "utf8",
);

test("anonymisation deletes the profile after detaching content that must survive", () => {
  const detachReviews = migration.indexOf("update reviews");
  const detachPhotos = migration.indexOf("update menu_photo_submissions");
  const deleteProfile = migration.indexOf("delete from user_profiles");
  assert.ok(detachReviews > 0 && detachPhotos > 0 && deleteProfile > 0);
  assert.ok(detachReviews < deleteProfile && detachPhotos < deleteProfile);
  assert.doesNotMatch(migration, /update user_profiles/);
});

test("user tables without a foreign key to the profile are cleared explicitly", () => {
  for (const table of ["user_taste_vectors", "recommendation_impressions"]) {
    assert.match(migration, new RegExp(`delete from ${table}\\s+where user_id = v_user_id`));
  }
  assert.match(migration, /update portfolio_flags\s+set reviewed_by = null/);
});

test("the review guard lets only server code detach a review from its author", () => {
  const guard = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20261021110000_account_deletion_review_anonymise_guard.sql",
    ),
    "utf8",
  );
  assert.match(
    guard,
    /current_user not in \('anon', 'authenticated'\)\s+and old\.user_id is not null\s+and new\.user_id is null then\s+return new;/,
  );
  assert.ok(
    guard.indexOf("current_user not in") <
      guard.indexOf("raise exception 'authentication required'"),
  );
});
