// Package 0.1 (sh, 2026-11-14): a photo is optional on a review and on a post. The mock service
// and the server rules must agree: the mock saves a review with no photo, and the newest
// migration that touches submit_review / publish_post_core takes both photo refusals out, with no
// later migration putting them back.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

const MIGRATIONS = path.join(process.cwd(), "supabase/migrations");
const ROLLBACKS = path.join(process.cwd(), "supabase/rollbacks");
const PHOTO_OPTIONAL = "20261114090000_photo_optional.sql";
const REFUSALS = ["Add a photo to publish your review.", "Add a photo to post."];

const migrationFiles = () =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();

/** The SQL a migration runs as live code: patch_function's $find$ blocks are only search text. */
const liveSql = (sql: string) => sql.replace(/\$find\$[\s\S]*?\$find\$/g, "");

test("0.1: the mock saves a review with no photo, and makes no portfolio entry without one", async () => {
  const result = await hungryService.reviews.submitReview({
    dishId: "d1",
    venueId: "v1",
    rating: 4,
    text: "Springy noodles",
    tags: [],
    photos: [],
    wouldRecommend: true,
    clientReviewId: "aaaaaaaa-1114-4000-8000-0000000000aa",
  });
  assert.equal(result.portfolioPostId, null);
});

test("0.1: the server's newest rule takes both photo refusals out, as the mock does", () => {
  const files = migrationFiles();
  assert.ok(files.includes(PHOTO_OPTIONAL), "the photo-optional migration exists");
  for (const refusal of REFUSALS) {
    const raise = `raise exception '${refusal}'`;
    const adders = files.filter((name) =>
      liveSql(readFileSync(path.join(MIGRATIONS, name), "utf8")).includes(raise),
    );
    const lastAdder = adders[adders.length - 1];
    assert.ok(lastAdder && lastAdder < PHOTO_OPTIONAL, `${refusal} was added before 0.1`);
    const up = readFileSync(path.join(MIGRATIONS, PHOTO_OPTIONAL), "utf8");
    const findBlocks = up.match(/\$find\$[\s\S]*?\$find\$/g) ?? [];
    assert.ok(
      findBlocks.some((block) => block.includes(raise)),
      `${PHOTO_OPTIONAL} patches out "${refusal}"`,
    );
    assert.ok(!liveSql(up).includes(raise), `${PHOTO_OPTIONAL} does not raise "${refusal}"`);
  }
});

test("0.1: a post with no media becomes a text post, and the rollback puts both refusals back", () => {
  const up = readFileSync(path.join(MIGRATIONS, PHOTO_OPTIONAL), "utf8");
  assert.match(liveSql(up), /when v_count = 0 then 'text'/);
  const down = readFileSync(
    path.join(ROLLBACKS, PHOTO_OPTIONAL.replace(/\.sql$/, ".down.sql")),
    "utf8",
  );
  for (const refusal of REFUSALS) {
    assert.ok(liveSql(down).includes(`raise exception '${refusal}'`), `down restores "${refusal}"`);
  }
});
