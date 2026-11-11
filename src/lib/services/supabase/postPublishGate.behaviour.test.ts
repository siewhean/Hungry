// Food Portfolio Phase 1 on the live service: a post goes up through publish_post after the photo
// check has answered for the post's own files, and a review with a portfolio entry is one
// submit_review call. Runs the real supabaseService against a fake client.

import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth, functions } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const POST_ID = "bbbbbbbb-1110-4000-8000-000000000001";
const REVIEW_ID = "aaaaaaaa-1110-4000-8000-000000000002";

// Photo uploads re-encode with expo-image-manipulator, which node does not have.
const internals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = internals._load;
internals._load = function load(request: string, ...rest: unknown[]) {
  if (request === "expo-image-manipulator") {
    const rendered = {
      width: 1000,
      height: 800,
      saveAsync: async () => ({ uri: "file:///tmp/out.jpg" }),
    };
    const context = { renderAsync: async () => rendered, resize: () => context };
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
  fake.storage = { createSignedUploadUrl: () => ({ data: { token: "t" }, error: null }) };
  functions.calls.length = 0;
  functions.results = { "check-photo-safety": () => ({ data: { status: "clear" }, error: null }) };
  auth.userId = ME;
});

const bite = {
  dishId: "d1",
  venueId: "v1",
  photoUrl: "file:///photos/a.jpg",
  mediaUrls: ["file:///photos/a.jpg"],
  mediaType: "photo" as const,
  mediaTypes: ["photo" as const],
  caption: "Silky chicken",
  tasteStamp: NEUTRAL_TASTE_VECTOR,
  rating: 5,
  clientPostId: POST_ID,
};

/** The write operations (insert, update, upsert, delete) recorded on one table. */
const writesOn = (table: string) =>
  fake
    .queriesOn(table)
    .flatMap((query) => query.ops.map(([method]) => method))
    .filter((method) => ["insert", "update", "upsert", "delete"].includes(method));

const removedPaths = () =>
  fake.storageCalls
    .filter((call) => call.method === "remove")
    .flatMap((call) => call.args[0] as string[]);

test("postBite uploads to the post's folder, has the photo checked, then publishes in one call", async () => {
  fake.rpc.publish_post = () => ({ data: { post_id: POST_ID, resumed: false }, error: null });

  const posted = await service.social.postBite(bite);

  assert.equal(posted.id, POST_ID);
  const check = functions.calls.find((call) => call.name === "check-photo-safety");
  const body = check?.body as { paths: string[]; bucket: string };
  assert.equal(body.bucket, "post-media");
  assert.equal(body.paths.length, 1);
  assert.ok(body.paths[0].startsWith(`${ME}/${POST_ID}/`));
  const calls = fake.callsTo("publish_post");
  assert.equal(calls.length, 1);
  const args = calls[0]!.args as {
    p_post: Record<string, unknown>;
    p_media: { storage_path: string; media_type: string }[];
  };
  assert.equal(args.p_post.id, POST_ID);
  assert.equal(args.p_post.caption, "Silky chicken");
  assert.deepEqual(
    args.p_media.map((media) => [media.storage_path, media.media_type]),
    [[body.paths[0], "image"]],
  );
  // Nothing is written to the posts tables from the phone.
  assert.deepEqual(writesOn("posts"), []);
  assert.deepEqual(writesOn("post_media"), []);
  assert.deepEqual(removedPaths(), []);
});

test("a photo the check blocks is never sent to publish_post and its file is removed", async () => {
  functions.results["check-photo-safety"] = () => ({
    data: { status: "blocked", flagged: 1, photos: 1 },
    error: null,
  });
  await assert.rejects(
    () => service.social.postBite(bite),
    (error: { code?: string }) => error.code === "photo_rejected",
  );
  assert.equal(fake.callsTo("publish_post").length, 0);
  assert.equal(removedPaths().length, 1);
});

test("a server refusal removes the uploaded files; a blocked hint reads as the photo error", async () => {
  fake.rpc.publish_post = () => ({
    data: null,
    error: { code: "23514", message: "One of your photos can't be posted.", hint: "photo_blocked" },
  });
  await assert.rejects(
    () => service.social.postBite(bite),
    (error: { code?: string }) => error.code === "photo_rejected",
  );
  assert.equal(removedPaths().length, 1);

  fake.storageCalls.length = 0;
  fake.rpc.publish_post = () => ({
    data: null,
    error: {
      code: "23514",
      message: "We could not check your photo yet. Try again.",
      hint: "photo_unchecked",
    },
  });
  await assert.rejects(
    () => service.social.postBite(bite),
    (error: { code?: string }) => error.code === "photo_unchecked",
  );
  assert.equal(removedPaths().length, 1);
});

test("a retry whose first answer was lost returns the live post and drops the new upload", async () => {
  fake.rpc.publish_post = () => ({ data: { post_id: POST_ID, resumed: true }, error: null });
  fake.rpc.get_post_by_id = () => ({ data: [], error: null });
  const posted = await service.social.postBite(bite);
  assert.equal(posted.id, POST_ID);
  assert.equal(removedPaths().length, 1, "the second copy of the file is not kept");
});

test("a backend without publish_post still posts through the old table writes", async () => {
  fake.rpc.publish_post = () => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" },
  });
  await service.social.postBite(bite);
  const writes = writesOn("posts");
  assert.ok(writes.includes("upsert"));
  assert.ok(writes.includes("update"));
  assert.ok(writesOn("post_media").includes("insert"));
});

const review = {
  dishId: "d1",
  venueId: "v1",
  rating: 4,
  text: "Good",
  tags: ["Rich"],
  photos: ["file:///photos/a.jpg"],
  clientReviewId: REVIEW_ID,
  portfolio: { caption: "Good", tasteStamp: NEUTRAL_TASTE_VECTOR, visibility: "private" as const },
};

test("a review with a portfolio entry is one submit_review call carrying the entry and who sees it", async () => {
  fake.rpc.submit_review = () => ({
    data: { review_id: REVIEW_ID, photos_added: 1, post_id: POST_ID, post_resumed: false },
    error: null,
  });

  const result = await service.reviews.submitReview(review);

  assert.deepEqual(result, { portfolioPostId: POST_ID });
  const buckets = functions.calls
    .filter((call) => call.name === "check-photo-safety")
    .map((call) => (call.body as { bucket: string }).bucket);
  assert.deepEqual(buckets, ["review-media", "post-media"]);
  const calls = fake.callsTo("submit_review");
  assert.equal(calls.length, 1);
  const portfolio = (calls[0]!.args as { p_portfolio: Record<string, unknown> }).p_portfolio as {
    post: { id: string; caption: string; visibility: string };
    media: { storage_path: string }[];
    rank?: number;
  };
  assert.equal(portfolio.post.visibility, "private");
  assert.equal(portfolio.rank, undefined, "no place in the old ranking");
  assert.equal(portfolio.post.caption, "Good");
  assert.ok(portfolio.media[0].storage_path.startsWith(`${ME}/${portfolio.post.id}/`));
  // No separate post or rank call that could fail on its own.
  assert.equal(fake.callsTo("publish_post").length, 0);
  assert.equal(fake.callsTo("rank_portfolio_post").length, 0);
  assert.deepEqual(writesOn("posts"), []);
});

test("a refused review with an entry removes the review photos and the entry copy", async () => {
  fake.rpc.submit_review = () => ({
    data: null,
    error: { code: "23514", message: "One of your photos can't be posted.", hint: "photo_blocked" },
  });
  await assert.rejects(
    () => service.reviews.submitReview(review),
    (error: { code?: string }) => error.code === "photo_rejected",
  );
  const removed = removedPaths();
  assert.ok(
    removed.some((path) => path.startsWith(`${ME}/${REVIEW_ID}/`)),
    "review photos",
  );
  assert.ok(
    removed.some((path) => !path.startsWith(`${ME}/${REVIEW_ID}/`)),
    "entry copy",
  );
});

test("an older backend refuses a review with an entry instead of dropping the entry", async () => {
  fake.rpc.submit_review = () => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" },
  });
  await assert.rejects(() => service.reviews.submitReview(review), /Food Portfolio/);
  assert.deepEqual(writesOn("reviews"), [], "no review written behind its back");
});

test("a signed-out postBite is refused before anything is uploaded", async () => {
  auth.userId = null;
  await assert.rejects(() => service.social.postBite(bite), /signed in/);
  assert.equal(fake.storageCalls.length, 0);
});

test("a post without a valid client id gets a fresh one; videos are published but not photo-checked", async () => {
  fake.rpc.publish_post = (args) => ({
    data: { post_id: (args as { p_post: { id: string } }).p_post.id, resumed: false },
    error: null,
  });
  const posted = await service.social.postBite({
    ...bite,
    clientPostId: "not-a-uuid",
    photoUrl: "file:///clips/a.mp4",
    mediaUrls: ["file:///clips/a.mp4"],
    mediaType: "video",
    mediaTypes: ["video"],
    rating: 0,
  });
  assert.notEqual(posted.id, "not-a-uuid");
  const args = fake.callsTo("publish_post")[0]!.args as {
    p_post: { id: string };
    p_media: { media_type: string }[];
  };
  assert.notEqual(args.p_post.id, "not-a-uuid");
  assert.deepEqual(
    args.p_media.map((media) => media.media_type),
    ["video"],
  );
});

test("a server error without a photo hint is passed on as it came", async () => {
  fake.rpc.publish_post = () => ({
    data: null,
    error: { code: "55000", message: "This post was deleted." },
  });
  await assert.rejects(
    () => service.social.postBite(bite),
    (error: { code?: string; message?: string }) =>
      error.code === "55000" && error.message === "This post was deleted.",
  );
  assert.equal(removedPaths().length, 1);
});

test("the old table writes stop at the first refused write and remove the upload", async () => {
  fake.rpc.publish_post = () => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" },
  });
  for (const failing of ["upsert", "delete", "insert", "update"]) {
    fake.storageCalls.length = 0;
    fake.queries.length = 0;
    fake.tables.posts = (call) =>
      call.ops.some(([method]) => method === failing)
        ? { data: null, error: { message: `${failing} refused` } }
        : { data: null, error: null };
    fake.tables.post_media = fake.tables.posts;
    await assert.rejects(
      () => service.social.postBite(bite),
      (error: { message?: string }) => error.message === `${failing} refused`,
    );
    assert.equal(removedPaths().length, 1, failing);
  }
});

test("a resumed post that cannot be read back is still returned from the draft", async () => {
  fake.rpc.publish_post = () => ({ data: { post_id: POST_ID, resumed: true }, error: null });
  fake.rpc.get_post_by_id = () => ({ data: null, error: null });
  const posted = await service.social.postBite(bite);
  assert.equal(posted.id, POST_ID);
});

test("an entry photo the check blocks stops the review before submit_review", async () => {
  let checks = 0;
  functions.results["check-photo-safety"] = () => {
    checks += 1;
    return checks === 1
      ? { data: { status: "clear", flagged: 0, photos: 1 }, error: null }
      : { data: { status: "blocked", flagged: 1, photos: 1 }, error: null };
  };
  await assert.rejects(
    () => service.reviews.submitReview(review),
    (error: { code?: string }) => error.code === "photo_rejected",
  );
  assert.equal(fake.callsTo("submit_review").length, 0);
  const removed = removedPaths();
  assert.ok(
    removed.some((path) => path.startsWith(`${ME}/${REVIEW_ID}/`)),
    "review photos",
  );
  assert.ok(
    removed.some((path) => !path.startsWith(`${ME}/${REVIEW_ID}/`)),
    "entry copy",
  );
});

test("a review without an entry sends no p_portfolio and returns no entry id", async () => {
  fake.rpc.submit_review = () => ({
    data: { review_id: REVIEW_ID, photos_added: 1 },
    error: null,
  });
  const result = await service.reviews.submitReview({ ...review, portfolio: undefined });
  assert.deepEqual(result, { portfolioPostId: null });
  const args = fake.callsTo("submit_review")[0]!.args as Record<string, unknown>;
  assert.equal("p_portfolio" in args, false);
  assert.deepEqual(
    functions.calls.map((call) => (call.body as { bucket: string }).bucket),
    ["review-media"],
  );
});

test("a retried review whose entry already exists drops both new copies", async () => {
  fake.rpc.submit_review = () => ({
    data: { review_id: REVIEW_ID, photos_added: 0, post_id: POST_ID, post_resumed: true },
    error: null,
  });
  const result = await service.reviews.submitReview(review);
  assert.deepEqual(result, { portfolioPostId: POST_ID });
  const removed = removedPaths();
  assert.ok(removed.some((path) => path.startsWith(`${ME}/${REVIEW_ID}/`)));
  assert.ok(removed.some((path) => !path.startsWith(`${ME}/${REVIEW_ID}/`)));
});

test("an older backend without an entry asked for still takes the review through the tables", async () => {
  fake.rpc.submit_review = () => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" },
  });
  const result = await service.reviews.submitReview({ ...review, portfolio: undefined });
  assert.deepEqual(result, { portfolioPostId: null });
  assert.ok(writesOn("reviews").length > 0);
});
