import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type QueryCall, type Result } from "./harness";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  GOOGLE_CLOUD_VISION_API_KEY: "vision-key",
  GEMINI_API_KEY: "gemini-key",
  INGEST_MENU_PHOTO_ALLOWED_ORIGINS: "https://usehungry.com",
};
const NOW = new Date("2026-10-22T04:00:00Z");
const SUBMISSION = {
  id: "sub-1",
  venue_id: "ven-1",
  building_id: "b-1",
  submitted_by: "u1",
  storage_bucket: "menu-photos",
  storage_path: "u1/menu.jpg",
  ocr_attempts: 0,
  ocr_status: "pending",
};

interface Options {
  submission?: Record<string, unknown> | null;
  claim?: Result;
  rate?: unknown;
  rateError?: boolean;
  existing?: Record<string, unknown>[];
  signed?: Result;
  imageType?: string | null;
  imageStatus?: number;
  visionText?: string;
  visionStatus?: number;
  gemini?: unknown;
  geminiStatus?: number;
  env?: Record<string, string>;
}

async function load(options: Options = {}) {
  const supabase = new FakeSupabase();
  supabase.getUser = async () => ({ data: { user: { id: "u1" } }, error: null });
  supabase.tables.menu_photo_submissions = (query: QueryCall) => {
    const update = query.ops.find(([op]) => op === "update");
    if (!update) return { data: "submission" in options ? options.submission : SUBMISSION };
    if ((update[1][0] as { ocr_status?: string }).ocr_status === "processing") {
      return (
        options.claim ?? { data: { ...SUBMISSION, ocr_attempts: 1, ocr_status: "processing" } }
      );
    }
    return { data: null };
  };
  supabase.rpc.app_can_make_user_request = () =>
    options.rateError
      ? { error: { message: "down" } }
      : { data: "rate" in options ? options.rate : true };
  supabase.tables.dishes_draft = (query) =>
    query.ops.some(([op]) => op === "select") ? { data: options.existing ?? [] } : { data: null };
  supabase.storage.createSignedUrl = () =>
    options.signed ?? { data: { signedUrl: "https://storage.test/signed.jpg" } };

  const fetches: string[] = [];
  const fetchFake = (async (url: string, init?: RequestInit) => {
    fetches.push(url);
    if (url.startsWith("https://storage.test/")) {
      const type = options.imageType === undefined ? "image/jpeg" : options.imageType;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: options.imageStatus ?? 200,
        headers: type ? { "content-type": type } : {},
      });
    }
    if (url.startsWith("https://vision.googleapis.com/")) {
      return new Response(
        JSON.stringify({
          responses: [
            {
              fullTextAnnotation: { text: options.visionText ?? "Laksa $6.50\nChicken Rice 5.00" },
            },
          ],
        }),
        {
          status: options.visionStatus ?? 200,
        },
      );
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      const text =
        typeof options.gemini === "string" ? options.gemini : JSON.stringify(options.gemini ?? []);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
        status: options.geminiStatus ?? 200,
      });
    }
    throw new Error(`unexpected fetch ${url} ${init?.method}`);
  }) as unknown as typeof fetch;

  const handler = await loadEdgeFunction("ingest-menu-photo", {
    env: { ...ENV, ...options.env },
    supabase,
    fetch: fetchFake,
    now: NOW,
  });
  return { supabase, handler, fetches };
}

const ORIGIN = { origin: "https://usehungry.com" };
const ingest = (body: unknown = { submissionId: "sub-1" }, headers: Record<string, string> = {}) =>
  post(body, "user-jwt", { ...ORIGIN, ...headers });
const status = async (response: Response) => [response.status, (await json(response)).error];

function finalUpdate(supabase: FakeSupabase) {
  return supabase
    .queriesOn("menu_photo_submissions")
    .map(
      (query) =>
        query.ops.find(([op]) => op === "update")?.[1][0] as Record<string, unknown> | undefined,
    )
    .filter((fields) => fields && fields.ocr_status !== "processing")
    .at(-1);
}

test("ingest-menu-photo handles CORS: allowed origin, native clients, and strangers", async () => {
  const { handler } = await load();
  const preflight = await handler(
    new Request("https://edge.test/fn", { method: "OPTIONS", headers: ORIGIN }),
  );
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN.origin);

  const stranger = await handler(
    ingest({ submissionId: "sub-1" }, { origin: "https://evil.example" }),
  );
  assert.equal(stranger.status, 403);

  const native = await handler(post({ submissionId: "sub-1" }, "user-jwt"));
  assert.equal(native.status, 200, "a native request without Origin is allowed");
  assert.equal(native.headers.get("access-control-allow-origin"), "*");
});

test("ingest-menu-photo needs POST, its keys, and a signed-in caller", async () => {
  const { handler } = await load();
  assert.equal(
    (await handler(new Request("https://edge.test/fn", { method: "GET", headers: ORIGIN }))).status,
    405,
  );

  assert.equal(
    (await (await load({ env: { SUPABASE_ANON_KEY: "" } })).handler(ingest())).status,
    500,
  );
  assert.deepEqual(
    await status(
      await (await load({ env: { GOOGLE_CLOUD_VISION_API_KEY: "" } })).handler(ingest()),
    ),
    [500, "missing_vision_api_key"],
  );
  assert.deepEqual(
    await status(await handler(post({ submissionId: "sub-1" }, undefined, ORIGIN))),
    [401, "missing_authorization"],
  );

  const badJwt = await load();
  badJwt.supabase.getUser = async () => ({ data: { user: null }, error: { message: "expired" } });
  assert.deepEqual(await status(await badJwt.handler(ingest())), [401, "invalid_authorization"]);
});

test("ingest-menu-photo only works on the caller's own queued submission", async () => {
  assert.deepEqual(await status(await (await load()).handler(ingest({}))), [
    400,
    "submission_id_required",
  ]);
  assert.deepEqual(await status(await (await load({ submission: null })).handler(ingest())), [
    404,
    "submission_not_found",
  ]);
  assert.deepEqual(
    await status(
      await (
        await load({ submission: { ...SUBMISSION, submitted_by: "someone-else" } })
      ).handler(ingest()),
    ),
    [403, "forbidden_submission"],
  );
  for (const ocr_status of ["processing", "succeeded", "skipped"]) {
    assert.deepEqual(
      await status(
        await (await load({ submission: { ...SUBMISSION, ocr_status } })).handler(ingest()),
      ),
      [409, "submission_not_queued"],
    );
  }
  assert.deepEqual(
    await status(
      await (
        await load({ submission: { ...SUBMISSION, ocr_status: "failed", ocr_attempts: 3 } })
      ).handler(ingest()),
    ),
    [429, "ocr_retry_limit_exceeded"],
  );
  const retry = await load({
    submission: { ...SUBMISSION, ocr_status: "failed", ocr_attempts: 2 },
  });
  assert.equal(
    (await retry.handler(ingest())).status,
    200,
    "a failed submission may be retried until the third attempt",
  );
});

test("ingest-menu-photo is rate limited per user and claims the submission atomically", async () => {
  const limited = await load({ rate: false });
  assert.deepEqual(await status(await limited.handler(ingest())), [429, "rate_limited"]);
  assert.deepEqual(limited.supabase.callsTo("app_can_make_user_request")[0].args, {
    p_actor_user_id: "u1",
    p_action: "ingest-menu-photo",
    p_limit: 10,
  });
  assert.deepEqual(await status(await (await load({ rateError: true })).handler(ingest())), [
    429,
    "rate_limited",
  ]);

  const lost = await load({ claim: { data: null } });
  assert.deepEqual(await status(await lost.handler(ingest())), [409, "submission_not_queued"]);
  assert.equal(lost.fetches.length, 0, "a lost claim means no vision spend");

  const { handler, supabase } = await load();
  await handler(ingest());
  const claim = supabase.queriesOn("menu_photo_submissions")[1].ops;
  assert.deepEqual(claim.find(([op]) => op === "in")![1], ["ocr_status", ["pending", "failed"]]);
  assert.deepEqual(claim.find(([op]) => op === "lt")![1], ["ocr_attempts", 3]);
  assert.deepEqual(claim.find(([op, args]) => op === "eq" && args[0] === "submitted_by")![1], [
    "submitted_by",
    "u1",
  ]);
  assert.equal((claim[0][1][0] as { ocr_attempts: number }).ocr_attempts, 1);
});

test("ingest-menu-photo reads the photo, runs OCR, and saves each line as a pending draft dish (fallback parser)", async () => {
  const { handler, supabase, fetches } = await load({ gemini: [] });
  const body = await json(await handler(ingest()));
  assert.deepEqual(body, { ok: true, submissionId: "sub-1", extracted: 2 });
  assert.ok(fetches[0].startsWith("https://storage.test/"));
  assert.ok(
    fetches[1].startsWith("https://vision.googleapis.com/v1/images:annotate?key=vision-key"),
  );

  const inserts = supabase
    .queriesOn("dishes_draft")
    .map((query) => query.ops.find(([op]) => op === "insert")?.[1][0])
    .filter(Boolean) as Record<string, unknown>[];
  assert.equal(inserts.length, 2);
  assert.deepEqual(
    [
      inserts[0].name,
      inserts[0].name_normalized,
      inserts[0].price_cents,
      inserts[0].extraction_confidence,
      inserts[0].review_status,
    ],
    ["Laksa", "laksa", 650, 0.72, "pending"],
  );
  assert.deepEqual([inserts[1].name, inserts[1].price_cents], ["Chicken Rice", 500]);
  assert.deepEqual(
    [inserts[0].venue_id, inserts[0].building_id, inserts[0].source_photo_id],
    ["ven-1", "b-1", "sub-1"],
  );

  const done = finalUpdate(supabase)!;
  assert.deepEqual([done.ocr_status, done.ocr_error], ["succeeded", null]);
  assert.equal((done.vision_response as { extractedCount: number }).extractedCount, 2);
});

test("ingest-menu-photo prefers the Gemini extraction, cleans it, and falls back when it is unusable", async () => {
  const gemini = [
    {
      name: "  Bak Chor Mee ",
      price: 5.5,
      modifiers: ["extra vinegar", " "],
      extraction_confidence: 3,
    },
    { name: "", price: 1 },
    { name: "Fishball Soup", price: "cheap", extraction_confidence: -1 },
  ];
  const { handler, supabase } = await load({ gemini });
  assert.equal((await json(await handler(ingest()))).extracted, 2);
  const inserts = supabase
    .queriesOn("dishes_draft")
    .map((query) => query.ops.find(([op]) => op === "insert")?.[1][0])
    .filter(Boolean) as Record<string, unknown>[];
  assert.deepEqual(
    [inserts[0].name, inserts[0].modifiers, inserts[0].extraction_confidence],
    ["Bak Chor Mee", ["extra vinegar"], 1],
  );
  assert.deepEqual([inserts[1].price_cents, inserts[1].extraction_confidence], [null, 0]);

  for (const options of [
    { geminiStatus: 500 },
    { gemini: "not json" },
    { gemini: "{}" },
    { env: { GEMINI_API_KEY: "" } },
  ]) {
    const fallback = await load(options as Options);
    assert.equal(
      (await json(await fallback.handler(ingest()))).extracted,
      2,
      JSON.stringify(options),
    );
  }
});

test("ingest-menu-photo merges a near-duplicate dish into the existing draft instead of adding another", async () => {
  const { handler, supabase } = await load({
    gemini: [{ name: "Laksa", price: 6.5, extraction_confidence: 0.9 }],
    existing: [
      {
        id: "draft-9",
        name: "Laksa",
        price_cents: 650,
        extraction_confidence: 0.6,
        confidence_bumps: 2,
      },
    ],
  });
  const body = await json(await handler(ingest()));
  assert.equal(body.extracted, 1);
  const draftQueries = supabase.queriesOn("dishes_draft");
  assert.ok(!draftQueries.some((query) => query.ops.some(([op]) => op === "insert")));
  const update = draftQueries.find((query) => query.ops.some(([op]) => op === "update"))!.ops;
  assert.deepEqual(update[0][1][0], {
    extraction_confidence: 0.9,
    confidence_bumps: 3,
    updated_at: NOW.toISOString(),
  });
  assert.deepEqual(update[1], ["eq", ["id", "draft-9"]]);
});

test("ingest-menu-photo marks a photo with no readable dishes as skipped", async () => {
  const { handler, supabase } = await load({ visionText: "", gemini: [] });
  const body = await json(await handler(ingest()));
  assert.equal(body.extracted, 0);
  assert.equal(finalUpdate(supabase)!.ocr_status, "skipped");
});

test("ingest-menu-photo caps one photo at 50 dishes", async () => {
  const gemini = Array.from({ length: 80 }, (_, index) => ({
    name: `Dish number ${index} abc${"x".repeat(index)}`,
    price: 3,
  }));
  const { handler } = await load({ gemini });
  assert.equal((await json(await handler(ingest()))).extracted, 50);
});

test("ingest-menu-photo fails the submission with a generic message when any OCR step breaks", async () => {
  const failures: Options[] = [
    { signed: { error: { message: "secret signing detail" } } },
    { imageStatus: 404 },
    { imageType: "text/html" },
    { imageType: null },
    { visionStatus: 500 },
  ];
  for (const options of failures) {
    const { handler, supabase } = await load(options);
    const response = await handler(ingest());
    assert.deepEqual(await status(response), [500, "ocr_pipeline_failed"], JSON.stringify(options));
    const failed = finalUpdate(supabase)!;
    assert.deepEqual(
      [failed.ocr_status, failed.ocr_error],
      ["failed", "Processing failed. Please try again."],
    );
    assert.ok(
      !JSON.stringify(failed).includes("secret signing detail"),
      "internal detail is not stored for users",
    );
  }
});

test("ingest-menu-photo accepts only jpeg, png, heic and webp photos", async () => {
  for (const imageType of [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/webp",
    "IMAGE/PNG; charset=binary",
  ]) {
    const { handler } = await load({ imageType });
    assert.equal((await handler(ingest())).status, 200, imageType);
  }
  for (const imageType of ["image/gif", "application/pdf", "image/svg+xml"]) {
    const { handler } = await load({ imageType });
    assert.equal((await handler(ingest())).status, 500, imageType);
  }
});
