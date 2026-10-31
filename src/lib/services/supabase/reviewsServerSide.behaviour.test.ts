// Reviews on the live service (REV-2, REV-6, REV-7, REV-8): publishing through submit_review with a
// thumbnail beside each photo, one-call feed pages with one signing request, and search over every
// review. Runs the real supabaseService against a fake client.

import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth, functions } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const REVIEW_ID = "aaaaaaaa-004a-4000-8000-000000000003";

// Photo uploads re-encode with expo-image-manipulator, which the node runtime does not have: a
// stand-in that "renders" any file at 4000 x 3000 and saves a JPEG.
const internals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = internals._load;
const resizeCalls: unknown[] = [];
internals._load = function load(request: string, ...rest: unknown[]) {
  if (request === "expo-image-manipulator") {
    const rendered = {
      width: 4000,
      height: 3000,
      saveAsync: async () => ({ uri: "file:///tmp/out.jpg" }),
    };
    const context = {
      renderAsync: async () => rendered,
      resize: (size: unknown) => {
        resizeCalls.push(size);
        return context;
      },
    };
    return {
      ImageManipulator: { manipulate: () => context },
      SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
    };
  }
  return originalLoad.call(this, request, ...rest);
};
const jpegBytes = () =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], {
    type: "image/jpeg",
  });
globalThis.fetch = (async () =>
  ({ ok: true, status: 200, blob: async () => jpegBytes() }) as Response) as typeof fetch;

let service: typeof import("./supabaseService").supabaseService;

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.storageCalls.length = 0;
  fake.rpc = {};
  fake.tables = {};
  fake.storage = {};
  resizeCalls.length = 0;
  functions.calls.length = 0;
  functions.results = {};
  auth.userId = ME;
});

const draft = {
  dishId: "d1",
  venueId: "v1",
  rating: 5,
  text: "Rich gravy",
  tags: ["Rich"],
  photos: ["file:///photos/a.jpg", "file:///photos/b.jpg"],
  wouldRecommend: true,
  clientReviewId: REVIEW_ID,
};

const missingFunction = { code: "PGRST202", message: "Could not find the function" };

test("REV-7/REV-2: submitReview uploads a photo and a thumbnail for each photo, then publishes in one rpc call", async () => {
  fake.storage.createSignedUploadUrl = () => ({ data: { token: "t" }, error: null });
  fake.rpc.submit_review = () => ({
    data: { review_id: REVIEW_ID, resumed: false, photos_added: 2 },
    error: null,
  });

  await service.reviews.submitReview(draft);

  const uploads = fake.storageCalls.filter((call) => call.method === "uploadToSignedUrl");
  assert.equal(uploads.length, 4, "two objects per photo");
  const paths = uploads.map((call) => String(call.args[0]));
  assert.equal(paths.filter((path) => path.includes(".thumb.")).length, 2);
  assert.ok(paths.every((path) => path.startsWith(`${ME}/${REVIEW_ID}/photo-`)));
  // The grid copy is the small edge; the photo keeps the 2048 cap.
  assert.ok(resizeCalls.some((size) => (size as { width?: number }).width === 480));
  assert.ok(resizeCalls.some((size) => (size as { width?: number }).width === 2048));

  const calls = fake.callsTo("submit_review");
  assert.equal(calls.length, 1, "one publish call");
  const args = calls[0]!.args as {
    p_review: Record<string, unknown>;
    p_photos: { storage_path: string; thumb_path: string | null }[];
  };
  assert.equal(args.p_review.id, REVIEW_ID);
  assert.equal(args.p_review.dish_id, "d1");
  assert.deepEqual(args.p_review.tags, ["Rich"]);
  assert.equal(args.p_photos.length, 2);
  assert.ok(args.p_photos.every((photo) => photo.thumb_path?.includes(".thumb.")));
  // Nothing is written to the tables directly any more.
  assert.equal(fake.queriesOn("reviews").length, 0);
  assert.equal(fake.queriesOn("review_photos").length, 0);
  assert.equal(fake.storageCalls.filter((call) => call.method === "remove").length, 0);
});

test("App Store 1.2: a photo that fails the explicit-content check stops the post and is removed", async () => {
  fake.storage.createSignedUploadUrl = () => ({ data: { token: "t" }, error: null });
  functions.results["check-photo-safety"] = () => ({
    data: { status: "blocked", flagged: 1, photos: 2 },
    error: null,
  });
  await assert.rejects(
    () => service.reviews.submitReview(draft),
    (error: { code?: string }) => error.code === "photo_rejected",
  );

  assert.equal(functions.calls.length, 1);
  assert.equal(functions.calls[0].name, "check-photo-safety");
  const sent = (functions.calls[0].body as { paths: string[] }).paths;
  assert.equal(sent.length, 2, "only the photos are sent, not their thumbnails");
  assert.ok(
    sent.every((path) => path.startsWith(`${ME}/${REVIEW_ID}/`) && !path.includes(".thumb.")),
  );
  assert.equal(fake.callsTo("submit_review").length, 0, "no review is created");
  const removed = fake.storageCalls.filter((call) => call.method === "remove");
  assert.equal(removed.length, 1);
  assert.equal((removed[0].args[0] as string[]).length, 4, "photos and thumbnails are removed");
});

test("App Store 1.2: an unchecked, failed or clear answer lets the review through", async () => {
  fake.storage.createSignedUploadUrl = () => ({ data: { token: "t" }, error: null });
  for (const result of [
    () => ({ data: { status: "clear", photos: 2 }, error: null }),
    () => ({ data: { status: "unchecked", photos: 2 }, error: null }),
    () => ({ data: null, error: { message: "function not deployed" } }),
  ]) {
    fake.rpcCalls.length = 0;
    functions.results["check-photo-safety"] = result;
    fake.rpc.submit_review = () => ({ data: { photos_added: 2 }, error: null });
    await service.reviews.submitReview(draft);
    assert.equal(fake.callsTo("submit_review").length, 1);
  }
});

test("REV-2: a thumbnail that fails to upload does not fail the review", async () => {
  fake.storage.createSignedUploadUrl = ({ args }) =>
    String(args[0]).includes(".thumb.")
      ? { data: null, error: { message: "boom" } }
      : { data: { token: "t" }, error: null };
  fake.rpc.submit_review = () => ({ data: { photos_added: 2 }, error: null });

  await service.reviews.submitReview(draft);

  const args = fake.callsTo("submit_review")[0]!.args as {
    p_photos: { thumb_path: string | null }[];
  };
  assert.deepEqual(
    args.p_photos.map((photo) => photo.thumb_path),
    [null, null],
  );
});

test("REV-7: when the server refuses the review, the uploaded photos and thumbnails are removed", async () => {
  fake.storage.createSignedUploadUrl = () => ({ data: { token: "t" }, error: null });
  fake.rpc.submit_review = () => ({
    data: null,
    error: { code: "23514", message: "Add a photo to publish your review." },
  });

  await assert.rejects(service.reviews.submitReview(draft), (error: { code?: string }) => {
    assert.equal(error.code, "23514");
    return true;
  });

  const removed = fake.storageCalls.filter((call) => call.method === "remove");
  assert.equal(removed.length, 1);
  assert.equal((removed[0]!.args[0] as string[]).length, 4, "both photos and both thumbnails");
});

test("REV-7: a retry that finds the photos already attached removes the files it just uploaded", async () => {
  fake.storage.createSignedUploadUrl = () => ({ data: { token: "t" }, error: null });
  fake.rpc.submit_review = () => ({
    data: { review_id: REVIEW_ID, resumed: true, photos_added: 0 },
    error: null,
  });

  await service.reviews.submitReview(draft);

  assert.equal(fake.storageCalls.filter((call) => call.method === "remove").length, 1);
});

test("REV-7: a backend without submit_review is written table by table, thumbnails included", async () => {
  fake.storage.createSignedUploadUrl = () => ({ data: { token: "t" }, error: null });
  fake.rpc.submit_review = () => ({ data: null, error: missingFunction });

  await service.reviews.submitReview(draft);

  assert.equal(
    fake.queriesOn("reviews").filter((q) => q.ops.some(([op]) => op === "insert")).length,
    1,
  );
  const photoInsert = fake
    .queriesOn("review_photos")
    .flatMap((q) => q.ops)
    .find(([op]) => op === "insert");
  const rows = photoInsert?.[1][0] as { thumb_path: string | null; sort_order: number }[];
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.thumb_path?.includes(".thumb.")));
});

const rpcPage = {
  entries: [
    {
      id: "r2",
      user_id: ME,
      dish_id: "d1",
      venue_id: "v1",
      author_name: "Me",
      author_avatar_url: null,
      rating: 4.5,
      created_at: "2026-10-02T00:00:00.123456+00:00",
      text: "Great",
      tags: ["Rich"],
      would_recommend: true,
      helpful_count: 2,
      dish_name: "Laksa",
      venue_name: "Stall",
      photos: [
        {
          storage_bucket: "review-media",
          storage_path: `${ME}/r2/photo-0.jpg`,
          thumb_path: `${ME}/r2/photo-0.thumb.jpg`,
          url: `${ME}/r2/photo-0.jpg`,
        },
        { storage_bucket: "review-media", storage_path: `${ME}/r2/photo-1.jpg`, thumb_path: null },
      ],
      viewer_found_helpful: true,
      moderation_state: "hidden",
    },
    {
      id: "r1",
      user_id: null,
      dish_id: "d1",
      venue_id: "v1",
      author_name: "Deleted user",
      rating: 4,
      created_at: "2026-10-01T00:00:00+00:00",
      text: "[deleted]",
      tags: ["Rich"],
      dish_name: "Laksa",
      venue_name: "Stall",
      photos: [{ storage_bucket: "review-media", storage_path: "gone/r1.jpg" }],
    },
  ],
  raw_count: 2,
  has_more: true,
  next_cursor: { before: "2026-10-01T00:00:00.654321+00:00", before_id: "r1" },
};

function signAll() {
  fake.storage.createSignedUrls = ({ args }) => ({
    data: (args[0] as string[]).map((path) => ({
      path,
      signedUrl: `https://signed.example/${path}`,
      error: null,
    })),
    error: null,
  });
}

test("REV-8: a feed page is one rpc and one signing request, with thumbnails beside the photos", async () => {
  signAll();
  fake.rpc.get_review_feed_page = () => ({ data: rpcPage, error: null });

  const page = await service.reviews.listRecentReviewsPage({ limit: 2, withPhotos: true });

  assert.equal(fake.rpcCalls.filter((call) => call.name === "get_review_feed_page").length, 1);
  assert.equal(fake.queries.length, 0, "no table reads for the page");
  assert.equal(fake.storageCalls.filter((call) => call.method === "createSignedUrls").length, 1);
  assert.deepEqual(
    page.entries.map((entry) => entry.review.id),
    ["r2"],
    "the deleted account's photo review is left off the grid",
  );
  const [entry] = page.entries;
  assert.equal(entry!.dishName, "Laksa");
  assert.equal(entry!.venueName, "Stall");
  assert.equal(entry!.review.photos.length, 2);
  assert.equal(
    entry!.review.photoThumbnails?.[0],
    `https://signed.example/${ME}/r2/photo-0.thumb.jpg`,
  );
  assert.equal(entry!.review.photoThumbnails?.[1], "", "a photo without a thumbnail has none");
  assert.equal(entry!.review.viewerFoundHelpful, true);
  assert.equal(entry!.review.moderationState, "hidden");
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.nextCursor, {
    before: "2026-10-01T00:00:00.654321+00:00",
    beforeId: "r1",
  });
  // The deleted account's photo path is never signed.
  const signedPaths = fake.storageCalls.find((call) => call.method === "createSignedUrls")!
    .args[0] as string[];
  assert.ok(!signedPaths.includes("gone/r1.jpg"));
});

test("REV-8: the page request carries the cursor and filters", async () => {
  fake.rpc.get_review_feed_page = () => ({ data: { entries: [], has_more: false }, error: null });

  await service.reviews.listRecentReviewsPage({
    limit: 20,
    before: "2026-10-01T00:00:00.654321+00:00",
    beforeId: "r1",
    venueId: "v1",
    withPhotos: true,
  });

  assert.deepEqual(fake.callsTo("get_review_feed_page")[0]!.args, {
    p_limit: 20,
    p_before: "2026-10-01T00:00:00.654321+00:00",
    p_before_id: "r1",
    p_after: undefined,
    p_venue_id: "v1",
    p_dish_ids: undefined,
    p_with_photos: true,
  });
});

test("REV-8: a failing feed rpc is an error, not an empty feed", async () => {
  fake.rpc.get_review_feed_page = () => ({ data: null, error: { code: "XX000", message: "boom" } });
  await assert.rejects(service.reviews.listRecentReviewsPage({ limit: 5 }));
});

test("REV-8: an empty dish list asks for nothing", async () => {
  const page = await service.reviews.listRecentReviewsPage({ dishIds: [] });
  assert.deepEqual(page.entries, []);
  assert.equal(fake.rpcCalls.length, 0);
});

test("REV-6: search sends search_reviews and returns a review that is not in any loaded page", async () => {
  signAll();
  fake.rpc.search_reviews = () => ({
    data: { ...rpcPage, entries: [rpcPage.entries[0]] },
    error: null,
  });

  const page = await service.reviews.searchReviewsPage({ query: "  laksa ", limit: 30 });

  assert.deepEqual(fake.callsTo("search_reviews")[0]!.args, {
    p_query: "laksa",
    p_before: undefined,
    p_before_id: undefined,
    p_limit: 30,
    p_with_photos: true,
  });
  assert.deepEqual(
    page.entries.map((entry) => entry.review.id),
    ["r2"],
  );
  assert.ok(page.nextCursor);
});

test("REV-6: a one-letter search is not sent", async () => {
  const page = await service.reviews.searchReviewsPage({ query: " a " });
  assert.deepEqual(page.entries, []);
  assert.equal(fake.rpcCalls.length, 0);
});

test("REV-6: without search_reviews the newest reviews are filtered on the device", async () => {
  fake.rpc.search_reviews = () => ({ data: null, error: missingFunction });
  fake.rpc.get_review_feed_page = () => ({ data: null, error: missingFunction });
  fake.tables.reviews = () => ({
    data: [
      {
        id: "r2",
        dish_id: "d1",
        venue_id: "v1",
        user_id: ME,
        created_at: "2026-10-02T00:00:00Z",
        rating: 5,
        text: "Great curry",
        tags: [],
      },
      {
        id: "r3",
        dish_id: "d2",
        venue_id: "v1",
        user_id: ME,
        created_at: "2026-10-01T00:00:00Z",
        rating: 5,
        text: "Fine",
        tags: [],
      },
    ],
    error: null,
  });
  fake.tables.dishes = () => ({
    data: [
      { id: "d1", name: "Laksa", venue_id: "v1" },
      { id: "d2", name: "Chicken rice", venue_id: "v1" },
    ],
    error: null,
  });
  fake.tables.venues = () => ({ data: [{ id: "v1", name: "Stall" }], error: null });
  fake.tables.review_photos = () => ({
    data: [
      { review_id: "r2", url: "https://img.example/r2.jpg", sort_order: 0 },
      { review_id: "r3", url: "https://img.example/r3.jpg", sort_order: 0 },
    ],
    error: null,
  });

  const page = await service.reviews.searchReviewsPage({ query: "curry" });
  assert.deepEqual(
    page.entries.map((entry) => entry.review.id),
    ["r2"],
  );
});
