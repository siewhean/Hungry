// Settings and account service fixes (round-three audit, SET-3, SET-5, SET-6, SET-9): the real
// Supabase service against a fake client.

import assert from "node:assert/strict";
import Module from "node:module";
import test, { after, before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";

// The test runtime has no native image re-encoder; a stand-in lets photo uploads run.
const moduleInternals = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const loadBeforeManipulator = moduleInternals._load;
moduleInternals._load = function load(request: string, ...rest: unknown[]) {
  if (request === "expo-image-manipulator") {
    return {
      SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
      ImageManipulator: {
        manipulate: () => ({
          resize() {
            return this;
          },
          renderAsync: async () => ({
            width: 100,
            height: 100,
            saveAsync: async () => ({ uri: "file:///saved.jpeg" }),
          }),
        }),
      },
    };
  }
  return loadBeforeManipulator.call(this, request, ...rest);
};

let service: typeof import("./supabaseService").supabaseService;
let mapSupabaseReviewRows: typeof import("./supabaseService").mapSupabaseReviewRows;
const storageCalls: { bucket: string; method: string; args: unknown[] }[] = [];
const previousFetch = globalThis.fetch;

before(async () => {
  const client = await import("./client");
  client.setConfiguredDataSource("supabase");
  const module = await import("./supabaseService");
  service = module.supabaseService;
  mapSupabaseReviewRows = module.mapSupabaseReviewRows;

  // Storage with the synchronous getPublicUrl the upload helper needs.
  const supabase = client.getSupabaseClient() as unknown as {
    storage: unknown;
    rpc: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
  // supabase-js lets `.maybeSingle()` follow an rpc call; the fake resolves directly.
  const rpc = supabase.rpc;
  supabase.rpc = (name, args) => {
    const result = rpc(name, args);
    return Object.assign(result, { maybeSingle: () => result, single: () => result });
  };
  supabase.storage = {
    from: (bucket: string) => ({
      createSignedUploadUrl: async (...args: unknown[]) => {
        storageCalls.push({ bucket, method: "createSignedUploadUrl", args });
        return { data: { token: "token" }, error: null };
      },
      uploadToSignedUrl: async (...args: unknown[]) => {
        storageCalls.push({ bucket, method: "uploadToSignedUrl", args });
        return { error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      remove: async (...args: unknown[]) => {
        storageCalls.push({ bucket, method: "remove", args });
        return { data: [], error: null };
      },
      createSignedUrls: async (paths: string[]) => ({
        data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}` })),
        error: null,
      }),
    }),
  };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  globalThis.fetch = (async () =>
    new Response(new Blob([jpeg], { type: "image/jpeg" }), { status: 200 })) as typeof fetch;
});

after(() => {
  globalThis.fetch = previousFetch;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  storageCalls.length = 0;
  auth.userId = ME;
});

const PREFERENCE_ROW = {
  stall_updates: false,
  weekly_picks: true,
  mealtime_suggestions: false,
  social_activity: true,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  weekly_cap: 3,
};

test("push preferences read and write the follow-request switch (social_activity)", async () => {
  fake.tables.notification_preferences = (call) => {
    const upsert = call.ops.find(([op]) => op === "upsert");
    if (upsert) {
      const row = upsert[1][0] as Record<string, unknown>;
      return { data: { ...PREFERENCE_ROW, ...row }, error: null };
    }
    return { data: PREFERENCE_ROW, error: null };
  };
  const current = await service.push.getPreferences();
  assert.equal(current.socialActivity, true);

  const next = await service.push.updatePreferences({ socialActivity: false });
  assert.equal(next.socialActivity, false);
  const upsert = fake
    .queriesOn("notification_preferences")
    .flatMap((call) => call.ops)
    .find(([op]) => op === "upsert");
  assert.equal((upsert?.[1][0] as Record<string, unknown>).social_activity, false);
  const selects = fake
    .queriesOn("notification_preferences")
    .flatMap((call) => call.ops)
    .filter(([op]) => op === "select")
    .map(([, args]) => String(args[0]));
  assert.ok(selects.every((columns) => columns.includes("social_activity")));
});

const stallInput = {
  stallName: "Ah Seng Wanton Mee",
  imageUri: "file:///photo-1.jpg",
  imageUris: ["file:///photo-1.jpg", "file:///photo-2.jpg"],
  menuItems: [],
  deliveryLinks: [],
};

test("a stall submission refused with permission denied rejects and removes its photos", async () => {
  fake.rpc.submit_user_stall_submission = () => ({
    data: null,
    error: { code: "42883", message: "could not find the function submit_user_stall_submission" },
  });
  fake.tables.user_stall_submissions = () => ({
    data: null,
    error: { code: "42501", message: "permission denied for table user_stall_submissions" },
  });
  await assert.rejects(
    service.contributions.submitDiscoveredStall(stallInput),
    (error: { message?: string }) => /permission denied/.test(error.message ?? ""),
  );
  const removed = storageCalls.filter((call) => call.method === "remove");
  assert.equal(removed.length > 0, true, "uploaded photos are removed");
  const removedPaths = removed.flatMap((call) => call.args[0] as string[]);
  assert.ok(removedPaths.some((path) => path.startsWith(`${ME}/`)));
});

test("a stall submission whose RPC fails removes its uploaded photos", async () => {
  fake.rpc.submit_user_stall_submission = () => ({
    data: null,
    error: { code: "P0001", message: "Stall name is required" },
  });
  await assert.rejects(
    service.contributions.submitDiscoveredStall(stallInput),
    (error: { message?: string }) => /Stall name is required/.test(error.message ?? ""),
  );
  const removedPaths = storageCalls
    .filter((call) => call.method === "remove")
    .flatMap((call) => call.args[0] as string[]);
  assert.equal(removedPaths.length, 2);
});

test("a submission no saved row confirms is an error, not a made-up success", async () => {
  fake.rpc.submit_user_stall_submission = () => ({ data: null, error: null });
  // An older submission of the same stall name must not be returned as this one.
  fake.tables.user_stall_submissions = (call) => {
    const filtersOnPath = call.ops.some(
      ([op, args]) => op === "eq" && (args[0] === "image_storage_path" || args[0] === "image_url"),
    );
    if (filtersOnPath) return { data: null, error: null };
    return {
      data: [
        {
          id: "older",
          user_id: ME,
          stall_name: "Ah Seng Wanton Mee",
          image_url: "https://cdn.test/older.jpeg",
          image_storage_path: `${ME}/older.jpeg`,
          created_at: new Date().toISOString(),
          status: "accepted",
        },
      ],
      error: null,
    };
  };
  await assert.rejects(
    service.contributions.submitDiscoveredStall(stallInput),
    /couldn't confirm your submission/,
  );
});

test("a deleted account's kept review shows as a bare rating without text or photos", async () => {
  fake.tables.review_photos = () => ({ data: [], error: null });
  fake.tables.public_profiles = () => ({ data: [], error: null });
  const reviews = await mapSupabaseReviewRows(
    (await import("./client")).getSupabaseClient() as never,
    [
      { id: "r1", user_id: null, rating: 4, text: "[deleted]", tags: ["spicy"] },
      { id: "r2", user_id: ME, rating: 5, text: "Great noodles" },
    ],
  );
  assert.equal(reviews[0].authorName, "Deleted account");
  assert.equal(reviews[0].text, "");
  assert.deepEqual(reviews[0].photos, []);
  assert.deepEqual(reviews[0].tags, []);
  assert.equal(reviews[0].rating, 4);
  assert.equal(reviews[1].text, "Great noodles");
  const photoQuery = fake.queriesOn("review_photos")[0];
  const inFilter = photoQuery.ops.find(([op]) => op === "in");
  assert.deepEqual(inFilter?.[1], ["review_id", ["r2"]], "no photo lookup for the deleted one");
});
