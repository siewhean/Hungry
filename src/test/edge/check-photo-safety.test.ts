import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type SentryEvent } from "./harness";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  GOOGLE_CLOUD_VISION_API_KEY: "vision-key",
  SENTRY_DSN: "https://key@sentry.test/1",
};
const ORIGIN = { origin: "https://usehungry.com" };

interface Options {
  env?: Record<string, string>;
  rate?: unknown;
  signed?: { data?: unknown; error?: { message: string } | null };
  imageStatus?: number;
  visionStatus?: number;
  /** One SafeSearch annotation per photo. */
  annotations?: Record<string, string>[];
  visionItemError?: boolean;
  allowedOrigins?: string;
}

async function load(options: Options = {}) {
  const supabase = new FakeSupabase();
  supabase.getUser = async () => ({ data: { user: { id: "u1" } }, error: null });
  supabase.rpc.app_can_make_user_request = () => ({
    data: "rate" in options ? options.rate : true,
  });
  supabase.storage.createSignedUrls = ({ args }) =>
    options.signed ?? {
      data: (args[0] as string[]).map((path) => ({
        path,
        signedUrl: `https://storage.test/${path}`,
      })),
    };

  const visionBodies: { requests: unknown[] }[] = [];
  const fetchFake = (async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://storage.test/")) {
      return new Response(new Uint8Array([1, 2, 3]), { status: options.imageStatus ?? 200 });
    }
    if (url.startsWith("https://vision.googleapis.com/")) {
      const body = JSON.parse(String(init?.body));
      visionBodies.push(body);
      return new Response(
        JSON.stringify({
          responses: body.requests.map((_: unknown, index: number) =>
            options.visionItemError
              ? { error: { message: "bad image" } }
              : {
                  safeSearchAnnotation: options.annotations?.[index] ?? { adult: "VERY_UNLIKELY" },
                },
          ),
        }),
        { status: options.visionStatus ?? 200 },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as unknown as typeof fetch;

  const sentryEvents: SentryEvent[] = [];
  const handler = await loadEdgeFunction("check-photo-safety", {
    env: {
      ...ENV,
      ...(options.allowedOrigins
        ? { CHECK_PHOTO_SAFETY_ALLOWED_ORIGINS: options.allowedOrigins }
        : {}),
      ...options.env,
    },
    supabase,
    fetch: fetchFake,
    sentryEvents,
  });
  return { supabase, handler, visionBodies, sentryEvents };
}

const check = (paths: unknown = ["u1/r1/photo-0.jpg"], headers: Record<string, string> = {}) =>
  post({ paths }, "user-jwt", headers);
const exceptions = (events: SentryEvent[]) => events.filter((event) => event.kind === "exception");

test("check-photo-safety handles CORS like the other app-called functions", async () => {
  const { handler } = await load({ allowedOrigins: ORIGIN.origin });
  const preflight = await handler(
    new Request("https://edge.test/fn", { method: "OPTIONS", headers: ORIGIN }),
  );
  assert.equal(preflight.status, 200);
  assert.equal((await handler(check(undefined, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await handler(new Request("https://edge.test/fn", { method: "GET" }))).status, 405);
  const native = await handler(check());
  assert.equal(native.status, 200, "a native request without Origin is allowed");
});

test("check-photo-safety needs a signed-in caller", async () => {
  const { handler, supabase } = await load();
  assert.equal((await handler(post({ paths: ["u1/a.jpg"] }))).status, 401);
  supabase.getUser = async () => ({ data: { user: null }, error: { message: "bad jwt" } });
  assert.equal((await handler(check())).status, 401);
});

test("check-photo-safety only checks the caller's own files, 1 to 10 of them", async () => {
  const { handler, supabase } = await load();
  const tooMany = Array.from({ length: 11 }, (_, index) => `u1/r/${index}.jpg`);
  for (const paths of [
    null,
    [],
    "u1/a.jpg",
    ["u2/r/a.jpg"],
    ["u1/../u2/a.jpg"],
    ["u1/a.jpg", "other/b.jpg"],
    [42],
    tooMany,
  ]) {
    const response = await handler(check(paths));
    assert.equal(response.status, 400, JSON.stringify(paths));
    assert.equal((await json(response)).error, "invalid_paths");
  }
  assert.equal(supabase.storageCalls.length, 0, "nothing was signed or fetched");
});

test("check-photo-safety is rate limited per person", async () => {
  const { handler, supabase } = await load({ rate: false });
  const response = await handler(check());
  assert.equal(response.status, 429);
  assert.deepEqual(supabase.callsTo("app_can_make_user_request")[0].args, {
    p_actor_user_id: "u1",
    p_action: "check-photo-safety",
    p_limit: 30,
  });
});

test("check-photo-safety answers clear and sends every photo in one batch", async () => {
  const { handler, supabase, visionBodies } = await load();
  const paths = ["u1/r/a.jpg", "u1/r/b.jpg", "u1/r/c.jpg"];
  const response = await handler(check(paths));
  assert.deepEqual(await json(response), { status: "clear", photos: 3 });
  assert.equal(
    supabase.storageCalls.filter((call) => call.method === "createSignedUrls").length,
    1,
  );
  assert.equal(supabase.storageCalls[0].bucket, "review-media");
  assert.equal(visionBodies.length, 1, "one Vision request, not one per photo");
  assert.equal(visionBodies[0].requests.length, 3);
});

test("check-photo-safety blocks adult or violent photos and very racy ones, not mildly racy food", async () => {
  const cases: [Record<string, string>, string][] = [
    [{ adult: "LIKELY" }, "blocked"],
    [{ adult: "VERY_LIKELY" }, "blocked"],
    [{ violence: "LIKELY" }, "blocked"],
    [{ racy: "VERY_LIKELY" }, "blocked"],
    [{ racy: "LIKELY" }, "clear"],
    [{ adult: "POSSIBLE", violence: "POSSIBLE", racy: "POSSIBLE" }, "clear"],
    [{ medical: "VERY_LIKELY", spoof: "VERY_LIKELY" }, "clear"],
  ];
  for (const [annotation, expected] of cases) {
    const { handler } = await load({ annotations: [annotation] });
    const body = await json(await handler(check()));
    assert.equal(body.status, expected, JSON.stringify(annotation));
  }
});

test("check-photo-safety blocks the whole post when one photo of several is flagged", async () => {
  const { handler } = await load({
    annotations: [{ adult: "UNLIKELY" }, { adult: "VERY_LIKELY" }],
  });
  const body = await json(await handler(check(["u1/r/a.jpg", "u1/r/b.jpg"])));
  assert.deepEqual(body, { status: "blocked", flagged: 1, photos: 2 });
});

test("check-photo-safety answers unchecked and reports when Vision is not configured", async () => {
  const { handler, sentryEvents, visionBodies } = await load({
    env: { GOOGLE_CLOUD_VISION_API_KEY: "" },
  });
  const body = await json(await handler(check()));
  assert.equal(body.status, "unchecked");
  assert.equal(visionBodies.length, 0);
  assert.equal(exceptions(sentryEvents).length, 1, "missing key reaches error tracking");
});

test("check-photo-safety answers unchecked and reports when storage or Vision fails", async () => {
  for (const options of [
    { signed: { data: null, error: { message: "storage down" } } },
    { imageStatus: 500 },
    { visionStatus: 503 },
    { visionItemError: true },
  ] as Options[]) {
    const { handler, sentryEvents } = await load(options);
    const response = await handler(check());
    assert.equal(response.status, 200, JSON.stringify(options));
    assert.equal((await json(response)).status, "unchecked");
    assert.equal(exceptions(sentryEvents).length, 1);
  }
});

test("check-photo-safety checks post photos in the post-media bucket and refuses other buckets", async () => {
  const { handler, supabase } = await load();
  const response = await handler(
    post({ paths: ["u1/p1/a.jpg"], bucket: "post-media" }, "user-jwt"),
  );
  assert.equal((await json(response)).status, "clear");
  assert.equal(supabase.storageCalls[0].bucket, "post-media");
  const other = await handler(post({ paths: ["u1/p1/a.jpg"], bucket: "avatars" }, "user-jwt"));
  assert.equal(other.status, 400);
  assert.equal((await json(other)).error, "invalid_bucket");
});

test("check-photo-safety records each photo's answer for publish_post", async () => {
  const { handler, supabase } = await load({
    annotations: [{ adult: "UNLIKELY" }, { adult: "VERY_LIKELY" }],
  });
  const before = Date.now();
  await handler(post({ paths: ["u1/p1/a.jpg", "u1/p1/b.jpg"], bucket: "post-media" }, "user-jwt"));
  const args = supabase.callsTo("record_photo_safety_checks")[0].args;
  const startedAt = Date.parse(String(args.p_started_at));
  assert.ok(
    startedAt >= before - 1000 && startedAt <= Date.now(),
    "the answer carries when the check started",
  );
  assert.deepEqual(
    { ...args, p_started_at: undefined },
    {
      p_user_id: "u1",
      p_bucket: "post-media",
      p_checks: [
        { path: "u1/p1/a.jpg", status: "clear" },
        { path: "u1/p1/b.jpg", status: "blocked" },
      ],
      p_started_at: undefined,
    },
  );
});

test("check-photo-safety records unchecked when it cannot check, so the photo cannot be posted yet", async () => {
  const { handler, supabase } = await load({ env: { GOOGLE_CLOUD_VISION_API_KEY: "" } });
  await handler(check(["u1/r/a.jpg"]));
  assert.deepEqual(supabase.callsTo("record_photo_safety_checks")[0].args.p_checks, [
    { path: "u1/r/a.jpg", status: "unchecked" },
  ]);
  const down = await load({ visionStatus: 503 });
  await down.handler(check(["u1/r/a.jpg"]));
  assert.equal(
    (
      down.supabase.callsTo("record_photo_safety_checks")[0].args.p_checks as { status: string }[]
    )[0].status,
    "unchecked",
  );
});

test("check-photo-safety reports a failed record but still answers", async () => {
  const { handler, supabase, sentryEvents } = await load();
  supabase.rpc.record_photo_safety_checks = () => ({ data: null, error: { message: "down" } });
  const body = await json(await handler(check()));
  assert.equal(body.status, "clear");
  assert.ok(
    exceptions(sentryEvents).some((event) =>
      String((event.error as Error | undefined)?.message).includes("record_photo_safety_checks"),
    ),
  );
});
