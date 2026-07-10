import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const migration = readRepoFile(
  "supabase/migrations/20260610120000_catalog_display_provenance_guardrails.sql",
);
const smoke = readRepoFile("supabase/smoke/catalog_display_provenance.sql");
const auditScript = readRepoFile("scripts/audit_excel_source_quality.py");
const auditTests = readRepoFile("scripts/__tests__/audit_excel_source_quality.test.py");
const packageJson = readRepoFile("package.json");

test("catalog display migration adds explicit media and menu approval metadata", () => {
  for (const table of ["buildings", "venues", "dishes", "dish_images"]) {
    assert.match(
      migration,
      new RegExp(
        `alter\\s+table\\s+${table}[\\s\\S]*add\\s+column\\s+if\\s+not\\s+exists\\s+media_approved_for_display\\s+boolean\\s+not\\s+null\\s+default\\s+false`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `alter\\s+table\\s+${table}[\\s\\S]*add\\s+column\\s+if\\s+not\\s+exists\\s+media_rights_status\\s+text\\s+not\\s+null\\s+default\\s+'unverified'`,
        "i",
      ),
    );
  }

  for (const table of ["venues", "dishes"]) {
    assert.match(
      migration,
      new RegExp(
        `alter\\s+table\\s+${table}[\\s\\S]*add\\s+column\\s+if\\s+not\\s+exists\\s+menu_approved_for_display\\s+boolean\\s+not\\s+null\\s+default\\s+false`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `alter\\s+table\\s+${table}[\\s\\S]*add\\s+column\\s+if\\s+not\\s+exists\\s+menu_rights_status\\s+text\\s+not\\s+null\\s+default\\s+'unverified'`,
        "i",
      ),
    );
  }
});

test("app-facing read RPCs filter menus and sanitize images through provenance helpers", () => {
  for (const functionName of [
    "search_dishes",
    "get_discovery_feed_by_location",
    "get_dish_detail",
  ]) {
    const functionBlock = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]*?\\$\\$;`,
      "i",
    ).exec(migration)?.[0];
    assert.ok(functionBlock, `${functionName} should be redefined`);
    assert.match(functionBlock, /security\s+invoker/i);
    assert.match(functionBlock, /catalog_menu_is_displayable/i);
    assert.match(functionBlock, /catalog_display_image_url/i);
    assert.doesNotMatch(functionBlock, /coalesce\(nullif\(d\.image_url/i);
  }

  assert.match(migration, /lower\(p_url\)\s+like\s+'%images\.unsplash\.com%'/i);
  assert.match(
    migration,
    /catalog_url_is_delivery_app\(concat_ws\(' ',\s*p_url,\s*p_source_url\)\)/i,
  );
  assert.match(migration, /coalesce\(p_rights_status,\s*'unverified'\)\s*<>\s*'licensed'/i);
});

test("database smoke exercises representative app-facing RPC output", () => {
  assert.match(smoke, /Unsplash placeholder image should not be displayable/);
  assert.match(smoke, /Delivery-app image should be blocked unless explicitly licensed/);
  assert.match(smoke, /insert\s+into\s+buildings/i);
  assert.match(smoke, /insert\s+into\s+venues/i);
  assert.match(smoke, /insert\s+into\s+dishes/i);
  assert.match(smoke, /rollback;/i);
  assert.match(smoke, /Unapproved seeded dish should not be returned by search_dishes/);
  assert.match(
    smoke,
    /Approved seeded dish should be returned by search_dishes with approved image/,
  );
  assert.match(smoke, /Delivery-app image should be stripped from search_dishes output/);
  assert.match(smoke, /Unapproved seeded dish should not be returned by get_dish_detail/);
  assert.match(
    smoke,
    /Approved seeded dish should be returned by get_dish_detail with approved image/,
  );
  assert.match(smoke, /Discovery feed should choose the approved seeded dish and approved image/);
  assert.match(smoke, /search_dishes must filter menu rows and sanitize images/);
  assert.match(smoke, /get_discovery_feed_by_location must filter menu rows and sanitize images/);
  assert.match(
    migration,
    /left\s+join\s+lateral\s*\([\s\S]*from\s+dish_images\s+di[\s\S]*where\s+di\.dish_id\s+=\s+top_dish\.id[\s\S]*order\s+by\s+di\.sort_order[\s\S]*\)\s+top_dish_image\s+on\s+true/i,
  );
  assert.match(
    migration,
    /coalesce\(\s*top_dish_image\.url,[\s\S]*catalog_display_image_url\(top_dish\.image_url/i,
  );
  assert.match(packageJson, /"smoke:database:provenance"/);
});

test("Excel source audit has a production display gate for unsafe menus and images", () => {
  assert.match(auditScript, /--fail-unapproved-display/);
  assert.match(auditScript, /delivery_app_source_quarantine/);
  assert.match(auditScript, /production_menu_unverified/);
  assert.match(auditScript, /production_image_unverified/);
  assert.match(auditScript, /display_gate_failed=/);
  assert.match(auditTests, /test_delivery_app_rows_are_quarantined_even_when_marked_approved/);
  assert.match(auditTests, /test_official_source_still_needs_explicit_approval_and_rights_status/);
  assert.match(auditTests, /test_placeholder_images_are_not_display_approved/);
  assert.match(packageJson, /"data:excel:display-gate"/);
});
