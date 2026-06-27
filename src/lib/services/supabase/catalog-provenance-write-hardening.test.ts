import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const migration = readRepoFile(
  "supabase/migrations/20260627114814_catalog_provenance_write_hardening.sql",
);
const repository = readRepoFile("src/lib/services/supabase/supabaseRepository.ts");
const stallDetail = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
const stallDetailV2 = readRepoFile("src/app/screens/detail/StallDetailScreenV2.tsx");
const dishDetail = readRepoFile("src/app/screens/detail/DishDetailScreen.tsx");
const importer = readRepoFile("scripts/import_excel_to_supabase.py");

test("merchant catalog guards preserve provenance trust fields", () => {
  for (const field of [
    "media_approved_for_display",
    "media_rights_status",
    "media_source_url",
    "media_verified_at",
    "media_verified_by",
    "menu_approved_for_display",
    "menu_rights_status",
    "menu_source_url",
    "menu_verified_at",
    "menu_verified_by",
  ]) {
    assert.match(
      migration,
      new RegExp(`new\\.${field}\\s+is\\s+distinct\\s+from\\s+old\\.${field}`),
    );
  }

  assert.match(migration, /new\.menu_approved_for_display\s+is\s+distinct\s+from\s+false/i);
  assert.match(migration, /new\.menu_rights_status\s+is\s+distinct\s+from\s+'unverified'/i);
  assert.match(migration, /enforce_merchant_dish_image_write_guard/);
  assert.match(migration, /trg_enforce_merchant_dish_image_write_guard/);
  assert.match(migration, /merchant dish image updates cannot change provenance fields/);
});

test("public direct catalog reads use displayability policies", () => {
  assert.match(migration, /drop policy if exists "public_select_dishes"/);
  assert.match(
    migration,
    /catalog_menu_is_displayable\(menu_approved_for_display,\s*menu_rights_status,\s*menu_source_url\)/,
  );
  assert.match(migration, /drop policy if exists "public_select_dish_images"/);
  assert.match(
    migration,
    /catalog_display_image_url\(url,\s*media_approved_for_display,\s*media_rights_status,\s*media_source_url\)\s+is\s+not\s+null/,
  );
  assert.match(migration, /dish_images_select_merchant_owner_or_manager/);
});

test("menu item promotion creates canonical dishes without display approval bypass", () => {
  const insertColumns = /insert into dishes \(([\s\S]*?)\)\s+select/i.exec(migration)?.[1] ?? "";
  assert.match(migration, /promote_staging_menu_items_to_dishes/);
  assert.match(migration, /regexp_split_to_table/);
  assert.match(migration, /insert into dishes/);
  assert.match(migration, /'dsh-menu-'\s+\|\|\s+md5/);
  assert.doesNotMatch(insertColumns, /menu_approved_for_display/i);
  assert.doesNotMatch(insertColumns, /media_approved_for_display/i);
  assert.match(
    migration,
    /revoke execute on function public\.promote_staging_menu_items_to_dishes\(uuid\) from public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.promote_staging_menu_items_to_dishes\(uuid\) to service_role/i,
  );
});

test("importer can promote parsed menu items after staging apply", () => {
  assert.match(importer, /--promote-production-menu-items/);
  assert.match(importer, /rpc_request/);
  assert.match(importer, /promote_staging_menu_items_to_dishes/);
  assert.match(importer, /promote_menu_items_to_dishes/);
});

test("frontend Supabase menu reads prefer display-safe service data", () => {
  assert.match(repository, /isCatalogMenuDisplayable/);
  assert.match(repository, /\.filter\(isCatalogMenuDisplayable\)/);
  assert.match(repository, /catalogDisplayImageUrl\(row,\s*"url"\)/);
  assert.match(repository, /media_approved_for_display,media_rights_status,media_source_url/);

  assert.match(
    stallDetail,
    /hydratedDishes\s+\?\?\s+\(serviceProviderMode\s+===\s+"supabase"\s+\?\s+\[\]\s+:\s+cachedDishes\)/,
  );
  assert.match(
    stallDetail,
    /cachedDishes\.length\s+>\s+0\s+&&\s+serviceProviderMode\s+!==\s+"supabase"/,
  );
  assert.match(
    stallDetailV2,
    /serviceProviderMode\s+===\s+"supabase"\s+\?\s+\[\]\s+:\s+cachedDishes/,
  );
  assert.match(stallDetailV2, /discovery\.listDishesByVenue\(venueId\)/);
  assert.match(
    dishDetail,
    /serviceProviderMode\s+===\s+"supabase"\s+\?\s+undefined\s+:\s+cachedDish/,
  );
  assert.match(dishDetail, /discovery\.getDish\(deepLinkedDishId\)/);
});
