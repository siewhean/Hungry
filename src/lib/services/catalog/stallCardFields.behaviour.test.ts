// The stall fields round-four Search added to catalog_raw_venues_page and catalog_suggest
// (migration 20261029120000): the stall's logo, the typical price of its mains, the dish that
// matched the query, and the venue id on a suggestion whose stall name is unique.

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
const LOGO = "https://project.supabase.co/storage/v1/object/public/brand-logos/laksa.png";
const DISH_PHOTO = "https://project.supabase.co/storage/v1/object/public/dish-media/laksa.jpg";

function venueRow(overrides: Record<string, unknown> = {}) {
  return {
    release_id: RELEASE,
    id: "venue-1",
    building_id: "maxwell",
    name: "Sungei Road Laksa",
    building_name: "Maxwell Food Centre",
    menu_count: 4,
    min_price: 1,
    quality_rating: 4.4,
    quality_review_count: 30,
    verification_status: "verified",
    menu_rights_status: "merchant_owned",
    media_rights_status: "merchant_owned",
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

test("venue cards carry the logo, the main price and the matched dish", async () => {
  fake.rpc.catalog_raw_venues_page = () =>
    page([
      venueRow({
        logo_url: LOGO,
        main_price: 5,
        matched_dish: {
          id: "dish-1",
          name: "Signature Laksa",
          price: 6,
          image_url: DISH_PHOTO,
          verification_status: "verified",
        },
      }),
    ]);
  const [stall] = (await service.listVenues({ query: "laksa" })).items;
  assert.equal(stall?.logoUrl, LOGO);
  assert.equal(stall?.mainPrice, 5);
  assert.deepEqual(stall?.matchedDish, {
    id: "dish-1",
    name: "Signature Laksa",
    imageUrl: DISH_PHOTO,
    price: 6,
    verificationStatus: "verified",
  });
});

test("a stall without a logo, main price or matched dish maps to none of them", async () => {
  fake.rpc.catalog_raw_venues_page = () =>
    page([venueRow({ logo_url: null, main_price: null, matched_dish: null })]);
  const [stall] = (await service.listVenues({})).items;
  assert.equal(stall?.logoUrl, undefined);
  assert.equal(stall?.mainPrice, undefined);
  assert.equal(stall?.matchedDish, undefined);
});

test("a matched dish photo that is not an http(s) image is dropped", async () => {
  fake.rpc.catalog_raw_venues_page = () =>
    page([
      venueRow({
        matched_dish: { id: "dish-1", name: "Laksa", price: 6, image_url: "javascript:alert(1)" },
      }),
    ]);
  const [stall] = (await service.listVenues({ query: "laksa" })).items;
  assert.equal(stall?.matchedDish?.name, "Laksa");
  assert.equal(stall?.matchedDish?.imageUrl, undefined);
});

test("stall suggestions carry the venue id and building only when the name is unique", async () => {
  fake.rpc.catalog_suggest = () => ({
    data: [
      { kind: "stall", label: "Sungei Road Laksa", id: "venue-1", subtitle: "Maxwell Food Centre" },
      { kind: "stall", label: "Ya Kun Kaya Toast" },
      { kind: "place", label: "Maxwell Food Centre", id: "maxwell" },
      { kind: "food_type", label: "Laksa" },
    ],
    error: null,
  });
  const suggestions = await service.suggest("s");
  assert.deepEqual(suggestions, [
    {
      kind: "stall",
      label: "Sungei Road Laksa",
      venueId: "venue-1",
      subtitle: "Maxwell Food Centre",
    },
    { kind: "stall", label: "Ya Kun Kaya Toast" },
    { kind: "place", label: "Maxwell Food Centre", placeId: "maxwell" },
    { kind: "food_type", label: "Laksa" },
  ]);
});
