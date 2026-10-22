import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type QueryCall } from "./harness";

const TOKEN = "notify-secret";
const ENV = {
  NOTIFICATION_WORKER_TOKEN: TOKEN,
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};
// 12:00 in Singapore (UTC+8): outside the default 22:00-08:00 quiet hours.
const NOON_SGT = new Date("2026-10-22T04:00:00Z");
// 23:00 in Singapore: inside quiet hours.
const NIGHT_SGT = new Date("2026-10-22T15:00:00Z");

type Job = Record<string, unknown>;

function job(overrides: Job = {}): Job {
  return {
    id: "job-1",
    user_id: "u1",
    category: "stall_update",
    dish_id: "dish-1",
    title: "Laksa is back",
    body: "Katong Laksa restocked",
    deep_link: "hungry://dish/dish-1",
    attempts: 1,
    created_at: new Date(NOON_SGT.getTime() - 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

interface Scenario {
  jobs: Job[];
  prefs?: Job[];
  tokens?: Job[];
  dishes?: Job[];
  recentSent?: Job[];
  reviews?: Job[];
  hiddenReviews?: Job[];
  merchantPrefs?: Job[];
  activeToday?: Job[];
  expo?: (messages: { to: string }[]) => unknown;
  now?: Date;
  env?: Record<string, string>;
}

async function run(scenario: Scenario, body: unknown = {}) {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_notification_jobs = () => ({ data: scenario.jobs });
  const rows: Record<string, Job[] | undefined> = {
    notification_preferences: scenario.prefs ?? [{ user_id: "u1", stall_updates: true }],
    user_push_tokens: scenario.tokens ?? [{ user_id: "u1", token: "ExponentPushToken[a]" }],
    dishes: scenario.dishes ?? [{ id: "dish-1", availability_flags: [] }],
    reviews: scenario.reviews,
    review_moderation_states: scenario.hiddenReviews,
    merchant_notification_preferences: scenario.merchantPrefs,
    user_activity_days: scenario.activeToday,
  };
  supabase.tables.notification_jobs = (query: QueryCall) =>
    query.ops.some(([op]) => op === "select")
      ? { data: scenario.recentSent ?? [] }
      : { data: null };
  for (const [table, data] of Object.entries(rows))
    supabase.tables[table] = () => ({ data: data ?? [] });

  const pushes: { url: string; init: RequestInit; messages: { to: string }[] }[] = [];
  const fetchFake = (async (url: string, init: RequestInit) => {
    const messages = JSON.parse(String(init.body));
    pushes.push({ url, init, messages });
    const payload = scenario.expo
      ? scenario.expo(messages)
      : { data: messages.map(() => ({ status: "ok" })) };
    if (payload instanceof Error) throw payload;
    return new Response(JSON.stringify(payload));
  }) as unknown as typeof fetch;

  const handler = await loadEdgeFunction("send-notifications", {
    env: { ...ENV, ...scenario.env },
    supabase,
    fetch: fetchFake,
    now: scenario.now ?? NOON_SGT,
  });
  const response = await handler(post(body, TOKEN));
  return { response, body: await json(response), supabase, pushes };
}

/** What each job was finally updated to, in order. */
function outcomes(supabase: FakeSupabase): Record<string, unknown>[] {
  return supabase
    .queriesOn("notification_jobs")
    .filter((query) => query.ops.some(([op]) => op === "update"))
    .map((query) => {
      const fields = query.ops.find(([op]) => op === "update")![1][0] as Record<string, unknown>;
      const id = query.ops.find(([op]) => op === "eq")![1][1];
      return { id, ...fields };
    });
}

test("send-notifications rejects other methods, a bad token, and missing env", async () => {
  const supabase = new FakeSupabase();
  const handler = await loadEdgeFunction("send-notifications", { env: ENV, supabase });
  assert.equal((await handler(new Request("https://edge.test/fn", { method: "GET" }))).status, 405);
  assert.equal((await handler(post({}, "wrong"))).status, 401);
  assert.equal(supabase.rpcCalls.length, 0);

  const noEnv = await loadEdgeFunction("send-notifications", {
    env: { NOTIFICATION_WORKER_TOKEN: TOKEN },
  });
  assert.equal((await noEnv(post({}, TOKEN))).status, 500);
});

test("send-notifications reports a failed claim and an empty queue", async () => {
  const failing = new FakeSupabase();
  failing.rpc.claim_notification_jobs = () => ({ error: { message: "deadlock" } });
  const failHandler = await loadEdgeFunction("send-notifications", { env: ENV, supabase: failing });
  const failed = await failHandler(post({}, TOKEN));
  assert.equal(failed.status, 500);
  assert.deepEqual(await json(failed), { error: "claim_failed", detail: "deadlock" });

  const empty = await run({ jobs: [] });
  assert.deepEqual(empty.body, { claimed: 0 });
});

test("send-notifications claims at most the clamped batch size", async () => {
  const seen: unknown[] = [];
  for (const limit of [undefined, 0, 9999, 12.6, "x"]) {
    const supabase = new FakeSupabase();
    const handler = await loadEdgeFunction("send-notifications", { env: ENV, supabase });
    await handler(post(limit === undefined ? {} : { limit }, TOKEN));
    seen.push(supabase.callsTo("claim_notification_jobs")[0].args.p_limit);
  }
  assert.deepEqual(seen, [100, 1, 500, 12, 100]);
});

test("send-notifications sends a push to every device and marks the job sent", async () => {
  const { body, pushes, supabase } = await run({
    jobs: [job()],
    tokens: [
      { user_id: "u1", token: "ExponentPushToken[a]" },
      { user_id: "u1", token: "ExponentPushToken[b]" },
    ],
    env: { EXPO_ACCESS_TOKEN: "expo-secret" },
  });
  assert.deepEqual(body, { claimed: 1, sent: 1, skipped: 0, deferred: 0, failed: 0 });
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].url, "https://exp.host/--/api/v2/push/send");
  assert.deepEqual(
    pushes[0].messages.map((message) => message.to),
    ["ExponentPushToken[a]", "ExponentPushToken[b]"],
  );
  assert.equal(
    (pushes[0].init.headers as Record<string, string>).Authorization,
    "Bearer expo-secret",
  );
  assert.deepEqual(pushes[0].messages[0], {
    to: "ExponentPushToken[a]",
    title: "Laksa is back",
    body: "Katong Laksa restocked",
    channelId: "stall-updates",
    data: { url: "hungry://dish/dish-1", notificationId: "job-1", category: "stall_update" },
  });
  const [outcome] = outcomes(supabase);
  assert.deepEqual([outcome.id, outcome.status, outcome.locked_at], ["job-1", "sent", null]);
});

test("send-notifications sends no Authorization header without an Expo access token", async () => {
  const { pushes } = await run({ jobs: [job()] });
  assert.equal((pushes[0].init.headers as Record<string, string>).Authorization, undefined);
});

const SKIPS: [string, Scenario, string][] = [
  [
    "a user who turned the category off",
    { jobs: [job()], prefs: [{ user_id: "u1", stall_updates: false }] },
    "opted_out",
  ],
  [
    "a user with no saved preferences (stall updates default off)",
    { jobs: [job()], prefs: [] },
    "opted_out",
  ],
  [
    "a social job when social activity is off",
    {
      jobs: [job({ category: "social_like_digest", dish_id: null })],
      prefs: [{ user_id: "u1", social_activity: false }],
    },
    "opted_out",
  ],
  [
    "a job older than 48 hours",
    { jobs: [job({ created_at: new Date(NOON_SGT.getTime() - 49 * 3600 * 1000).toISOString() })] },
    "stale",
  ],
  [
    "a meal-time suggestion older than two hours",
    {
      jobs: [
        job({
          category: "mealtime",
          dish_id: null,
          created_at: new Date(NOON_SGT.getTime() - 3 * 3600 * 1000).toISOString(),
        }),
      ],
      prefs: [{ user_id: "u1", mealtime_suggestions: true }],
    },
    "stale",
  ],
  [
    "a meal-time suggestion for someone who already opened the app today",
    {
      jobs: [job({ category: "mealtime", dish_id: null })],
      prefs: [{ user_id: "u1", mealtime_suggestions: true }],
      activeToday: [{ user_id: "u1" }],
    },
    "already_active",
  ],
  ["a dish that no longer exists", { jobs: [job()], dishes: [] }, "no_longer_relevant"],
  [
    "a dish that sold out",
    { jobs: [job()], dishes: [{ id: "dish-1", availability_flags: ["Sold-Out"] }] },
    "no_longer_relevant",
  ],
  [
    "a user already at their weekly cap",
    { jobs: [job()], recentSent: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u1" }] },
    "weekly_cap",
  ],
  ["a user with no registered device", { jobs: [job()], tokens: [] }, "no_device"],
  [
    "a merchant low-rating alert while merchant alerts are disabled",
    {
      jobs: [
        job({
          category: "merchant_low_rating",
          dish_id: null,
          review_id: "r1",
          merchant_account_id: "m1",
        }),
      ],
    },
    "merchant_alerts_disabled",
  ],
  [
    "a merchant who turned low-rating alerts off",
    {
      jobs: [
        job({
          category: "merchant_low_rating",
          dish_id: null,
          review_id: "r1",
          merchant_account_id: "m1",
        }),
      ],
      reviews: [{ id: "r1" }],
      merchantPrefs: [{ merchant_account_id: "m1", low_rating_alerts: false }],
      env: { MERCHANT_ALERTS_ENABLED: "true" },
    },
    "opted_out",
  ],
  [
    "a low-rating alert for a review moderation hid",
    {
      jobs: [
        job({
          category: "merchant_low_rating",
          dish_id: null,
          review_id: "r1",
          merchant_account_id: "m1",
        }),
      ],
      reviews: [{ id: "r1" }],
      hiddenReviews: [{ review_id: "r1" }],
      env: { MERCHANT_ALERTS_ENABLED: "true" },
    },
    "no_longer_relevant",
  ],
];

for (const [name, scenario, reason] of SKIPS) {
  test(`send-notifications skips ${name} (${reason}) without sending`, async () => {
    const { body, pushes, supabase } = await run(scenario);
    assert.equal(pushes.length, 0);
    assert.equal(body.skipped, 1);
    assert.deepEqual(
      outcomes(supabase).map(({ status, skip_reason }) => ({ status, skip_reason })),
      [{ status: "skipped", skip_reason: reason }],
    );
  });
}

test("send-notifications defers consumer pushes in quiet hours and gives the attempt back", async () => {
  const { body, pushes, supabase } = await run({ jobs: [job({ attempts: 2 })], now: NIGHT_SGT });
  assert.equal(pushes.length, 0);
  assert.equal(body.deferred, 1);
  assert.deepEqual(
    outcomes(supabase).map(({ status, attempts }) => ({ status, attempts })),
    [{ status: "pending", attempts: 1 }],
  );
});

test("send-notifications quiet hours wrap midnight and respect each user's own window", async () => {
  const night = await run({
    jobs: [job()],
    prefs: [{ user_id: "u1", stall_updates: true, quiet_start_hour: 1, quiet_end_hour: 5 }],
    now: NIGHT_SGT,
  });
  assert.equal(night.body.sent, 1, "23:00 is outside a 01:00-05:00 window");
  const early = await run({ jobs: [job()], now: new Date("2026-10-21T22:00:00Z") });
  assert.equal(early.body.deferred, 1, "06:00 is still inside 22:00-08:00");
  const off = await run({
    jobs: [job()],
    prefs: [{ user_id: "u1", stall_updates: true, quiet_start_hour: 9, quiet_end_hour: 9 }],
    now: NIGHT_SGT,
  });
  assert.equal(off.body.sent, 1, "equal start and end means no quiet hours");
});

test("send-notifications sends merchant low-rating alerts at any hour and ignores the weekly cap", async () => {
  const lowRating = job({
    category: "merchant_low_rating",
    dish_id: null,
    review_id: "r1",
    merchant_account_id: "m1",
  });
  const { body } = await run({
    jobs: [lowRating],
    reviews: [{ id: "r1" }],
    recentSent: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u1" }, { user_id: "u1" }],
    env: { MERCHANT_ALERTS_ENABLED: "true" },
    now: NIGHT_SGT,
  });
  assert.equal(body.sent, 1);
});

test("send-notifications never holds back a follow request for the weekly cap, and does not count it toward the cap", async () => {
  const followRequest = (id: string) =>
    job({ id, category: "social_follow_request", dish_id: null });
  const { body } = await run({
    jobs: [followRequest("a"), followRequest("b"), followRequest("c"), followRequest("d")],
    prefs: [{ user_id: "u1", social_activity: true, weekly_cap: 1 }],
    recentSent: [{ user_id: "u1" }, { user_id: "u1" }],
  });
  assert.equal(body.sent, 4);
});

test("send-notifications counts each sent push toward the cap within one run", async () => {
  const jobs = [job({ id: "a" }), job({ id: "b" }), job({ id: "c" }), job({ id: "d" })];
  const { body } = await run({
    jobs,
    prefs: [{ user_id: "u1", stall_updates: true, weekly_cap: 2 }],
    recentSent: [],
  });
  assert.deepEqual([body.sent, body.skipped], [2, 2]);
});

test("send-notifications removes device tokens Expo reports as unregistered", async () => {
  const { body, supabase } = await run({
    jobs: [job()],
    tokens: [
      { user_id: "u1", token: "ExponentPushToken[live]" },
      { user_id: "u1", token: "ExponentPushToken[dead]" },
    ],
    expo: () => ({
      data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }],
    }),
  });
  assert.equal(body.sent, 1, "one device received it");
  const deletion = supabase
    .queriesOn("user_push_tokens")
    .find((query) => query.ops.some(([op]) => op === "delete"));
  assert.deepEqual(deletion!.ops.find(([op]) => op === "in")![1], [
    "token",
    ["ExponentPushToken[dead]"],
  ]);
});

test("send-notifications retries a failed send until the third attempt, then gives up", async () => {
  const failingExpo = () => ({ data: [{ status: "error" }] });
  const first = await run({ jobs: [job({ attempts: 1 })], expo: failingExpo });
  assert.deepEqual(
    [
      first.body.failed,
      outcomes(first.supabase)[0].status,
      outcomes(first.supabase)[0].skip_reason,
    ],
    [1, "pending", null],
  );

  const last = await run({ jobs: [job({ attempts: 3 })], expo: failingExpo });
  assert.deepEqual(
    [outcomes(last.supabase)[0].status, outcomes(last.supabase)[0].skip_reason],
    ["failed", "send_failed"],
  );

  const network = await run({
    jobs: [job({ attempts: 1 })],
    expo: () => new Error("network down"),
  });
  assert.equal(network.body.failed, 1, "a thrown fetch counts as a failure, not a crash");
});
