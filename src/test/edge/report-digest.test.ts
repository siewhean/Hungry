import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type SentryEvent } from "./harness";

const ENV = {
  REPORT_DIGEST_TOKEN: "worker-secret",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  RESEND_API_KEY: "re_key",
  RESEND_FROM: "Hungry <noreply@usehungry.com>",
  SENTRY_DSN: "https://key@sentry.test/1",
};

const REPORTS = [
  {
    id: "r1",
    target_type: "review",
    target_id: "rev-1",
    reason: "offensive",
    created_at: "2026-10-31T01:00:00Z",
  },
  {
    id: "r2",
    target_type: "profile",
    target_id: "user-9",
    reason: "spam",
    created_at: "2026-10-31T01:05:00Z",
  },
];

async function load(
  options: { reports?: unknown; resendStatus?: number; env?: Record<string, string> } = {},
) {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_content_reports_for_alert = () =>
    options.reports instanceof Error
      ? { data: null, error: { message: options.reports.message } }
      : { data: "reports" in options ? options.reports : REPORTS };
  const emails: { url: string; headers: Record<string, string>; body: any }[] = [];
  const fetchFake = (async (url: string, init?: RequestInit) => {
    emails.push({
      url,
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    return new Response("{}", { status: options.resendStatus ?? 200 });
  }) as unknown as typeof fetch;
  const sentryEvents: SentryEvent[] = [];
  const handler = await loadEdgeFunction("report-digest", {
    env: { ...ENV, ...options.env },
    supabase,
    fetch: fetchFake,
    sentryEvents,
  });
  return { supabase, handler, emails, sentryEvents };
}

test("report-digest only answers POST with the worker token", async () => {
  const { handler, supabase } = await load();
  assert.equal((await handler(new Request("https://edge.test/fn"))).status, 405);
  assert.equal((await handler(post({}))).status, 401);
  assert.equal((await handler(post({}, "wrong"))).status, 401);
  assert.equal((await handler(post({}, "worker-secre"))).status, 401, "a prefix is not enough");
  assert.equal(supabase.rpcCalls.length, 0, "nothing is claimed without the token");

  const unconfigured = await load({ env: { REPORT_DIGEST_TOKEN: "" } });
  assert.equal((await unconfigured.handler(post({}, ""))).status, 401);
});

test("report-digest emails the support inbox once with what to look at, never who reported", async () => {
  const { handler, emails, supabase } = await load();
  const response = await handler(post({}, "worker-secret"));
  assert.deepEqual(await json(response), { sent: 2 });

  assert.equal(emails.length, 1);
  assert.equal(emails[0].url, "https://api.resend.com/emails");
  assert.equal(emails[0].headers.Authorization, "Bearer re_key");
  assert.deepEqual(emails[0].body.to, ["usehungrysingapore@gmail.com"]);
  assert.equal(emails[0].body.from, ENV.RESEND_FROM);
  assert.match(emails[0].body.subject, /2 new reports/);
  assert.match(emails[0].body.text, /review rev-1: offensive/);
  assert.match(emails[0].body.text, /profile user-9: spam/);
  assert.doesNotMatch(emails[0].body.text, /reporter/i);
  assert.equal(supabase.callsTo("release_content_report_alerts").length, 0);
});

test("report-digest sends to REPORT_DIGEST_TO when set and uses the singular for one report", async () => {
  const { handler, emails } = await load({
    reports: [REPORTS[0]],
    env: { REPORT_DIGEST_TO: "safety@usehungry.com" },
  });
  await handler(post({}, "worker-secret"));
  assert.deepEqual(emails[0].body.to, ["safety@usehungry.com"]);
  assert.match(emails[0].body.subject, /1 new report to review/);
});

test("report-digest sends nothing when no report is waiting", async () => {
  const { handler, emails } = await load({ reports: [] });
  assert.deepEqual(await json(await handler(post({}, "worker-secret"))), { sent: 0 });
  assert.equal(emails.length, 0);
});

test("report-digest clamps the batch size to 1..200 and defaults to 50", async () => {
  const { handler, supabase } = await load({ reports: [] });
  for (const limit of [undefined, 0, -5, 10_000, 7.9, "abc"]) {
    await handler(post(limit === undefined ? {} : { limit }, "worker-secret"));
  }
  assert.deepEqual(
    supabase.callsTo("claim_content_reports_for_alert").map((call) => call.args.p_limit),
    [50, 1, 1, 200, 7, 50],
  );
});

test("report-digest puts the reports back when the email fails, so the next run sends them", async () => {
  const { handler, supabase, sentryEvents } = await load({ resendStatus: 500 });
  const response = await handler(post({}, "worker-secret"));
  assert.equal(response.status, 502);
  assert.deepEqual(supabase.callsTo("release_content_report_alerts")[0].args, {
    p_ids: ["r1", "r2"],
  });
  assert.equal(sentryEvents.filter((event) => event.kind === "exception").length, 1);
});

test("report-digest reports a failed claim and stops", async () => {
  const { handler, emails, sentryEvents } = await load({ reports: new Error("db down") });
  const response = await handler(post({}, "worker-secret"));
  assert.equal(response.status, 500);
  assert.equal(emails.length, 0);
  assert.equal(sentryEvents.filter((event) => event.kind === "exception").length, 1);
});

test("report-digest refuses to run without its mail settings", async () => {
  const { handler, supabase } = await load({ env: { RESEND_API_KEY: "" } });
  assert.equal((await handler(post({}, "worker-secret"))).status, 500);
  assert.equal(supabase.rpcCalls.length, 0, "no report is claimed that cannot be sent");
});
