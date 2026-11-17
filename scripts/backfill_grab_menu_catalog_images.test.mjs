import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogRows,
  buildVenueMatcher,
  isRealGrabFoodImage,
} from "./backfill_grab_menu_catalog_images.mjs";

const buildings = [
  { id: "bld-a", name: "Mall A", address: "1 Alpha Road" },
  { id: "bld-b", name: "Mall B", address: "2 Beta Road" },
  { id: "bld-c", name: "Standalone", address: "3 Gamma Road" },
];

test("Grab image allowlist accepts only Huawei food image URLs", () => {
  assert.equal(
    isRealGrabFoodImage(
      "https://huawei-food-cms.grab.com/compressed_webp/items/example/photo/item.webp",
    ),
    true,
  );
  assert.equal(isRealGrabFoodImage("https://food.grab.com/static/images/logo-app-grab-inverse.svg"), false);
  assert.equal(isRealGrabFoodImage("https://images.unsplash.com/photo-demo"), false);
  assert.equal(isRealGrabFoodImage(""), false);
});

test("venue matcher refuses duplicate exact names without location evidence", () => {
  const matchVenue = buildVenueMatcher(
    [
      { id: "ven-a", business_id: "A", name: "Fun Toast", building_id: "bld-a", address: "1 Alpha Road" },
      { id: "ven-b", business_id: "B", name: "Fun Toast", building_id: "bld-b", address: "2 Beta Road" },
    ],
    buildings,
  );

  assert.equal(matchVenue({ stallName: "FUN TOAST", buildingName: "", address: "" }), null);
  assert.equal(matchVenue({ stallName: "FUN TOAST", buildingName: "Mall B", address: "" })?.id, "ven-b");
});

test("catalog rows remain unapproved unless licensed Grab media approval is explicit", () => {
  const sourceRows = [
    {
      stallIndex: 0,
      dishIndex: 0,
      stallName: "Single Stall",
      buildingName: "Standalone",
      address: "3 Gamma Road",
      sourceUrl: "https://food.grab.com/sg/en/restaurant/single-stall-delivery/1-CABC",
      dishName: "Chicken Rice",
      description: "Classic plate",
      price: 5.5,
      rawImageUrl: "https://huawei-food-cms.grab.com/compressed_webp/items/example/photo/item.webp",
      imageUrl: "https://huawei-food-cms.grab.com/compressed_webp/items/example/photo/item.webp",
    },
  ];
  const matchVenue = buildVenueMatcher(
    [{ id: "ven-c", business_id: "C", name: "Single Stall", building_id: "bld-c", address: "3 Gamma Road" }],
    buildings,
  );

  const staged = buildCatalogRows(sourceRows, matchVenue);
  assert.equal(staged.dishes[0].menu_approved_for_display, false);
  assert.equal(staged.dishes[0].menu_rights_status, "unverified");
  assert.equal(staged.dishImages[0].media_approved_for_display, false);
  assert.equal(staged.dishImages[0].media_rights_status, "unverified");

  const approved = buildCatalogRows(sourceRows, matchVenue, { approveLicensedGrabMedia: true });
  assert.equal(approved.dishes[0].menu_approved_for_display, true);
  assert.equal(approved.dishes[0].menu_rights_status, "licensed");
  assert.equal(approved.dishImages[0].media_approved_for_display, true);
  assert.equal(approved.dishImages[0].media_rights_status, "licensed");
});
