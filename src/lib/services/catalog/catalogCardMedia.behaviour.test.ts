// Calls the real raw-catalog service against a fake Supabase client with payloads shaped like
// each RPC's real output, and checks which photos survive the mapping.
//
// The card tables (catalog_raw_dish_cards, catalog_raw_venue_cards) have no
// media_approved_for_display column: their image_url is already filtered on the server through
// catalog_display_image_url (20261021150100 triggers). The fixtures below are `to_jsonb` of those
// rows, so they carry no display flag, exactly like production.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let service: typeof import("./index").catalogRawService;

before(async () => {
  const { setConfiguredDataSource } = await import("@/lib/services/supabase/client");
  setConfiguredDataSource("supabase");
  service = (await import("./index")).catalogRawService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.rpc = {};
  service.clearCache();
});

const RELEASE = "9b1c3c56-6b7e-4c1c-9b7a-2f1f0a2b3c4d";
const DISH_PHOTO = "https://project.supabase.co/storage/v1/object/public/dish-media/laksa.jpg";
const STALL_PHOTO = "https://project.supabase.co/storage/v1/object/public/venue-media/stall.jpg";

/** One `catalog_raw_dish_cards` row as `to_jsonb(visible) - 'listing_location' - …` returns it. */
function dishCardRow(overrides: Record<string, unknown> = {}) {
  return {
    release_id: RELEASE,
    id: "dish-1",
    venue_id: "venue-1",
    building_id: "maxwell",
    name: "Laksa",
    venue_name: "Sungei Road Laksa",
    building_name: "Maxwell Food Centre",
    building_type: "hawker_centre",
    description: null,
    price: 5,
    price_range: null,
    image_url: DISH_PHOTO,
    distance_meters: null,
    rating: 4.5,
    review_count: 12,
    cuisine_tags: ["local"],
    dietary_flags: [],
    is_open: true,
    verification_status: "verified",
    menu_rights_status: "merchant_owned",
    // The dish's own rights status; a gallery photo can be the card image while this is unverified.
    media_rights_status: "unverified",
    menu_source_url: null,
    media_source_url: null,
    updated_at: "2026-10-20T00:00:00Z",
    food_type: "Laksa",
    ...overrides,
  };
}

/** One `catalog_raw_venue_cards` row, including the server-built representative_dish object. */
function venueCardRow(overrides: Record<string, unknown> = {}) {
  return {
    release_id: RELEASE,
    id: "venue-1",
    building_id: "maxwell",
    name: "Sungei Road Laksa",
    building_name: "Maxwell Food Centre",
    building_type: "hawker_centre",
    unit_number: "01-23",
    floor: "1",
    address: "1 Kadayanallur St",
    postal_code: "069184",
    operating_hours: "08:00-15:00",
    image_url: STALL_PHOTO,
    latitude: 1.28,
    longitude: 103.84,
    is_open: true,
    menu_count: 4,
    cuisine_tags: ["local"],
    dietary_flags: [],
    min_price: 4,
    quality_rating: 4.4,
    quality_review_count: 30,
    // Exactly the keys catalog_raw_publish_release builds (20261021140000): no rights fields.
    representative_dish: {
      id: "dish-1",
      name: "Laksa",
      image_url: DISH_PHOTO,
      price: 5,
      verification_status: "verified",
    },
    verification_status: "verified",
    menu_rights_status: "merchant_owned",
    media_rights_status: "merchant_owned",
    menu_source_url: null,
    media_source_url: null,
    updated_at: "2026-10-20T00:00:00Z",
    ...overrides,
  };
}

const page = (items: unknown[]) => ({
  data: {
    items,
    next_cursor: null,
    release_id: RELEASE,
    match_count: items.length,
    totals: { venues: 1, dishes: 1 },
  },
  error: null,
});

test("catalog_raw_dishes_page rows keep their server-filtered photo", async () => {
  fake.rpc.catalog_raw_dishes_page = () => page([dishCardRow()]);
  const result = await service.listDishes({ query: "laksa" });
  assert.equal(result.items[0]?.imageUrl, DISH_PHOTO);
});

test("catalog_raw_venues_page rows keep the stall photo and the representative dish photo", async () => {
  fake.rpc.catalog_raw_venues_page = () => page([venueCardRow()]);
  const result = await service.listVenues({ query: "laksa" });
  assert.equal(result.items[0]?.imageUrl, STALL_PHOTO);
  assert.equal(result.items[0]?.representativeDish?.imageUrl, DISH_PHOTO);
  // SEARCH-10: the quality columns are in the payload and reach the card.
  assert.equal(result.items[0]?.qualityRating, 4.4);
  assert.equal(result.items[0]?.qualityReviewCount, 30);
});

test("catalog_raw_venue_menu_page rows (the stall menu) keep their photo", async () => {
  fake.rpc.catalog_raw_venue_menu_page = () => page([dishCardRow()]);
  const result = await service.listVenueMenu("venue-1");
  assert.equal(result.items[0]?.imageUrl, DISH_PHOTO);
});

test("catalog_raw_dish_detail keeps the hero photo; the gallery still needs approved_for_display", async () => {
  fake.rpc.catalog_raw_dish_detail = () => ({
    data: {
      ...dishCardRow(),
      media: [
        {
          url: DISH_PHOTO,
          source_url: null,
          rights_status: "merchant_owned",
          approved_for_display: true,
          sort_order: -1,
        },
        {
          url: "https://cdn.example.com/unapproved.jpg",
          source_url: null,
          rights_status: "merchant_owned",
          approved_for_display: false,
          sort_order: 0,
        },
      ],
    },
    error: null,
  });
  const detail = await service.getDish("dish-1");
  assert.equal(detail.imageUrl, DISH_PHOTO);
  assert.deepEqual(
    detail.media.map((media) => media.url),
    [DISH_PHOTO, ""],
  );
});

test("catalog_raw_venue_detail keeps the stall hero photo", async () => {
  fake.rpc.catalog_raw_venue_detail = () => ({ data: venueCardRow(), error: null });
  const detail = await service.getVenue("venue-1");
  assert.equal(detail.imageUrl, STALL_PHOTO);
  assert.equal(detail.representativeDish?.imageUrl, DISH_PHOTO);
});

test("an expired or mismatched cursor release is its own error class (SEARCH-20)", async () => {
  const { CatalogReleaseExpiredError } = await import("./index");
  for (const error of [
    { code: "P0001", message: "catalog release unavailable" },
    { code: "22023", message: "catalog cursor release mismatch" },
  ]) {
    service.clearCache();
    fake.rpc.catalog_raw_dishes_page = () => ({ data: null, error });
    await assert.rejects(
      service.listDishes({ query: "laksa", cursor: "next", releaseId: RELEASE }),
      (thrown: unknown) => thrown instanceof CatalogReleaseExpiredError,
      error.code,
    );
  }
});

test("server-filtered rows still drop blocked, malformed and explicitly withheld photos", async () => {
  fake.rpc.catalog_raw_dishes_page = () =>
    page([
      dishCardRow({ id: "a", image_url: "https://images.unsplash.com/photo-1" }),
      dishCardRow({ id: "b", image_url: "javascript:alert(1)" }),
      dishCardRow({ id: "c", media_rights_status: "removed" }),
      dishCardRow({ id: "d", media_approved_for_display: false }),
      dishCardRow({ id: "e", image_url: null }),
    ]);
  const result = await service.listDishes({ query: "laksa" });
  assert.deepEqual(
    result.items.map((item) => item.imageUrl),
    [undefined, undefined, undefined, undefined, undefined],
  );
});
