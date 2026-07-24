import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("raw catalog publisher records deterministic quality findings before activation", () => {
  const migration = read("supabase/migrations/20260724113000_catalog_raw_publish_quality_gate.sql");

  assert.match(migration, /catalog_raw_release_quarantines/);
  assert.match(migration, /catalog_raw_is_mock_id/);
  assert.match(migration, /mock_venue_id/);
  assert.match(migration, /mock_dish_id/);
  assert.match(migration, /mock_building_id/);
  assert.match(migration, /blank_venue_name/);
  assert.match(migration, /blank_dish_name/);
  assert.match(migration, /non_consumer_venue/);
  assert.match(migration, /semantic_duplicate_venue/);
  assert.match(migration, /semantic_duplicate_dish/);
  assert.match(migration, /jsonb_array_length\(v_quality_findings\) > 0/);
  assert.match(migration, /set status = 'failed', quality_findings = v_quality_findings/);
  assert.match(migration, /set status = 'retired'[\s\S]*?where status = 'active'/);
});

test("raw catalog publisher carries only approved media plus approval metadata into cards", () => {
  const migration = read("supabase/migrations/20260724113000_catalog_raw_publish_quality_gate.sql");

  assert.match(migration, /catalog_raw_venue_cards[\s\S]*?media_approved_for_display boolean/);
  assert.match(migration, /catalog_raw_dish_cards[\s\S]*?media_approved_for_display boolean/);
  assert.match(migration, /public\.catalog_display_image_url\(/);
  assert.match(migration, /where safe_media\.url is not null/);
  assert.match(migration, /'media_approved_for_display', dish_media\.url is not null/);
  assert.match(migration, /unsafe_card_media/);
  assert.match(migration, /unsafe_detail_media/);
});

test("release publisher exposes machine-readable quality findings to the invocation script", () => {
  const publishSql = read("supabase/publish/catalog_raw_release.sql");
  const publisher = read("scripts/publish-catalog-raw-release.mjs");

  assert.match(publishSql, /quality_findings/);
  assert.match(publisher, /result\.rows\?\.\[0\]\?\.status !== "active"/);
  assert.match(publisher, /release\?\.quality_findings/);
});

test("three-page raw catalog smoke is gated on quality and safe media", () => {
  const smoke = read("supabase/smoke/catalog_raw_paging_quality.sql");

  assert.match(smoke, /catalog_raw_dishes_page/);
  assert.match(smoke, /catalog_raw_venues_page/);
  assert.match(smoke, /page_one/);
  assert.match(smoke, /page_two/);
  assert.match(smoke, /page_three/);
  assert.match(smoke, /mock_or_test_rows/);
  assert.match(smoke, /duplicate_stable_ids/);
  assert.match(smoke, /unsafe_media_rows/);
});
