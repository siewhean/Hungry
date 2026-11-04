// A deleted account's kept review (user_id null, text "[deleted]") on the Reviews photo grid and
// in the merchant inbox, against the real Supabase service with a fake client (SET-V1, SET-V2).

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OUTLET = "44444444-4444-4444-8444-444444444444";

let service: typeof import("./supabaseService").supabaseService;

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  auth.userId = ME;
});

const deletedRow = {
  id: "r1",
  dish_id: "d1",
  venue_id: "v1",
  user_id: null,
  author_name: "Deleted user",
  created_at: "2026-10-01T00:00:00Z",
  rating: 4,
  text: "[deleted]",
  tags: ["spicy"],
};

test("SET-V1: the photo grid leaves out a deleted account's review instead of a blank tile", async () => {
  // A backend without get_review_feed_page is read table by table (the fallback path).
  fake.rpc.get_review_feed_page = () => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" },
  });
  fake.tables.reviews = () => ({
    data: [
      {
        id: "r2",
        dish_id: "d1",
        venue_id: "v1",
        user_id: ME,
        created_at: "2026-10-02T00:00:00Z",
        rating: 5,
        text: "Great",
      },
      deletedRow,
    ],
    error: null,
  });
  // The deleted account's photo rows survive until the storage purge.
  fake.tables.review_photos = () => ({
    data: [
      { review_id: "r2", url: "https://img.example/r2.jpg", sort_order: 0 },
      { review_id: "r1", url: "https://img.example/r1.jpg", sort_order: 0 },
    ],
    error: null,
  });
  fake.tables.dishes = () => ({ data: [{ id: "d1", name: "Laksa", venue_id: "v1" }], error: null });
  fake.tables.venues = () => ({ data: [{ id: "v1", name: "Stall" }], error: null });

  const page = await service.reviews.listRecentReviewsPage({ limit: 2, withPhotos: true });
  assert.deepEqual(
    page.entries.map((entry) => entry.review.id),
    ["r2"],
  );
  // Paging still follows the raw rows, so the next page starts after the dropped review.
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.nextCursor, { before: "2026-10-01T00:00:00Z", beforeId: "r1" });
});

test("SET-V2: the merchant inbox shows a deleted account's review as a bare rating", async () => {
  fake.tables.merchant_outlets = () => ({ data: { id: OUTLET, venue_id: "v1" }, error: null });
  fake.tables.reviews = () => ({ data: [deletedRow], error: null });
  fake.tables.dishes = () => ({ data: [{ id: "d1", name: "Laksa" }], error: null });

  const [interaction] = await service.merchant.getInbox(OUTLET);
  assert.equal(interaction?.authorName, "Deleted account");
  assert.equal(interaction?.text, "");
  assert.deepEqual(interaction?.tags, []);
  assert.equal(interaction?.rating, 4);
});
