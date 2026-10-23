import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { json, loadEdgeFunction, signWebhook, type SentryEvent } from "./harness";

const SECRET = Buffer.from("hook-secret-bytes").toString("base64");
const ENV = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM: "Hungry <no-reply@mail.usehungry.com>",
  SEND_EMAIL_HOOK_SECRET: `v1,whsec_${SECRET}`,
  SUPABASE_URL: "https://project.supabase.co",
  RESEND_TEMPLATE_SIGNUP_ID: "tpl-signup",
  RESEND_TEMPLATE_RECOVERY_ID: "tpl-recovery",
  RESEND_TEMPLATE_MAGICLINK_ID: "tpl-magic",
};
const REDIRECT = "https://usehungry.com/auth/callback";

type Payload = {
  user?: { email?: string; new_email?: string };
  email_data?: Record<string, string | undefined>;
};

function hook(action: string, extra: Payload["email_data"] = {}, user: Payload["user"] = {}) {
  return {
    user: { email: "diner@example.com", ...user },
    email_data: {
      email_action_type: action,
      token: "123456",
      token_hash: "hash-abc",
      redirect_to: REDIRECT,
      site_url: "https://usehungry.com",
      ...extra,
    },
  };
}

interface Sent {
  headers: Headers;
  body: any;
}

async function load(
  options: {
    env?: Record<string, string>;
    resend?: (sent: Sent, index: number) => Response | Error;
    sentryEvents?: SentryEvent[];
  } = {},
) {
  const sent: Sent[] = [];
  const fetchFake = (async (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.resend.com/emails");
    const entry = { headers: new Headers(init.headers), body: JSON.parse(String(init.body)) };
    sent.push(entry);
    const result = options.resend?.(entry, sent.length - 1) ?? Response.json({ id: "email-1" });
    if (result instanceof Error) throw result;
    return result;
  }) as unknown as typeof fetch;
  const handler = await loadEdgeFunction("send-email", {
    env: { ...ENV, SENTRY_DSN: "", ...options.env },
    fetch: fetchFake,
    sentryEvents: options.sentryEvents,
  });
  return { handler, sent };
}

function signed(payload: unknown, id = "msg_1", secret = SECRET) {
  const body = JSON.stringify(payload);
  return new Request("https://edge.test/fn", {
    method: "POST",
    headers: { "content-type": "application/json", ...signWebhook(secret, body, id) },
    body,
  });
}

const status = async (response: Response) => [response.status, (await json(response)).error];

test("send-email accepts only POST and needs its Resend and hook secrets", async () => {
  const { handler } = await load();
  assert.equal((await handler(new Request("https://edge.test/fn"))).status, 405);

  for (const name of ["RESEND_API_KEY", "RESEND_FROM", "SEND_EMAIL_HOOK_SECRET"]) {
    const missing = await load({ env: { [name]: "" } });
    assert.deepEqual(await status(await missing.handler(signed(hook("signup")))), [
      500,
      "email_hook_not_configured",
    ]);
  }

  const injected = await load({ env: { RESEND_FROM: "a@b.test\r\nBcc: x@y.test" } });
  assert.deepEqual(await status(await injected.handler(signed(hook("signup")))), [
    500,
    "email_hook_not_configured",
  ]);
});

test("send-email rejects a body that is too large or not signed by Supabase Auth", async () => {
  const { handler, sent } = await load();
  const big = JSON.stringify({ pad: "x".repeat(70 * 1024) });
  assert.deepEqual(
    await status(await handler(new Request("https://edge.test/fn", { method: "POST", body: big }))),
    [413, "payload_too_large"],
  );

  const body = JSON.stringify(hook("signup"));
  const unsigned = new Request("https://edge.test/fn", { method: "POST", body });
  assert.deepEqual(await status(await handler(unsigned)), [401, "invalid_webhook_signature"]);

  const wrongKey = signed(
    hook("signup"),
    "msg_1",
    Buffer.from("another-secret").toString("base64"),
  );
  assert.deepEqual(await status(await handler(wrongKey)), [401, "invalid_webhook_signature"]);

  const tampered = signed(hook("signup"));
  const forged = new Request("https://edge.test/fn", {
    method: "POST",
    headers: tampered.headers,
    body: JSON.stringify(hook("recovery")),
  });
  assert.deepEqual(await status(await handler(forged)), [401, "invalid_webhook_signature"]);

  const stale = JSON.stringify(hook("signup"));
  const old = new Request("https://edge.test/fn", {
    method: "POST",
    headers: signWebhook(SECRET, stale, "msg_1", new Date(Date.now() - 10 * 60 * 1000)),
    body: stale,
  });
  assert.deepEqual(await status(await handler(old)), [401, "invalid_webhook_signature"]);
  assert.equal(sent.length, 0, "nothing is sent for an unverified request");
});

test("send-email refuses an action it does not know and a payload with no redirect", async () => {
  const { handler, sent } = await load();
  assert.deepEqual(await status(await handler(signed(hook("delete_everything")))), [
    422,
    "unsupported_email_action",
  ]);
  assert.deepEqual(await status(await handler(signed(hook("signup", { redirect_to: " " })))), [
    400,
    "invalid_email_hook_payload",
  ]);
  for (const bad of [
    hook("signup", { token: "" }),
    hook("signup", { token_hash: undefined }),
    hook("signup", {}, { email: "" }),
  ]) {
    assert.deepEqual(await status(await handler(signed(bad))), [400, "invalid_email_hook_payload"]);
  }
  assert.equal(sent.length, 0);
});

test("send-email sends a signup email through the signup template with the code and the verify link", async () => {
  const { handler, sent } = await load();
  const response = await handler(signed(hook("signup")));
  assert.deepEqual([response.status, await json(response)], [200, {}]);

  const [email] = sent;
  assert.equal(email.headers.get("authorization"), "Bearer re_test");
  assert.deepEqual(email.body.to, ["diner@example.com"]);
  assert.equal(email.body.from, ENV.RESEND_FROM);
  assert.equal(email.body.template.id, "tpl-signup");
  const link = new URL(email.body.template.variables.CONFIRMATION_URL);
  assert.equal(link.origin + link.pathname, "https://project.supabase.co/auth/v1/verify");
  assert.deepEqual(Object.fromEntries(link.searchParams), {
    token: "hash-abc",
    type: "signup",
    redirect_to: REDIRECT,
  });
  assert.equal(email.body.template.variables.TOKEN, "123456");
});

test("send-email picks the template per action and leaves the link out of code-only emails", async () => {
  const expected: [string, string, boolean][] = [
    ["signup", "tpl-signup", true],
    ["invite", "tpl-signup", true],
    ["recovery", "tpl-recovery", true],
    ["magiclink", "tpl-magic", false],
    ["reauthentication", "tpl-magic", false],
  ];
  for (const [action, template, hasLink] of expected) {
    const { handler, sent } = await load();
    assert.equal((await handler(signed(hook(action)))).status, 200, action);
    assert.equal(sent[0].body.template.id, template, action);
    assert.equal("CONFIRMATION_URL" in sent[0].body.template.variables, hasLink, action);
  }

  const noTemplate = await load({ env: { RESEND_TEMPLATE_RECOVERY_ID: "" } });
  assert.deepEqual(await status(await noTemplate.handler(signed(hook("recovery")))), [
    500,
    "email_hook_not_configured",
  ]);
});

test("send-email sends each email once per webhook: the key is derived from the webhook id", async () => {
  const { handler, sent } = await load();
  await handler(signed(hook("signup"), "msg_A"));
  await handler(signed(hook("signup"), "msg_A"));
  await handler(signed(hook("signup"), "msg_B"));
  const key = (id: string) =>
    `hungry-auth-${createHash("sha256").update(`${id}\0primary`).digest("hex")}`;
  assert.deepEqual(
    sent.map((email) => email.headers.get("idempotency-key")),
    [key("msg_A"), key("msg_A"), key("msg_B")],
  );
});

test("send-email email change goes to both addresses with the reversed token pairs", async () => {
  const { handler, sent } = await load();
  const change = hook(
    "email_change",
    {
      token: "111111",
      token_hash: "hash-new-address",
      token_new: "222222",
      token_hash_new: "hash-current",
    },
    { email: "old@example.com", new_email: "new@example.com" },
  );
  assert.equal((await handler(signed(change))).status, 200);
  assert.deepEqual(
    sent.map((email) => [
      email.body.to[0],
      email.body.template.variables.TOKEN,
      new URL(email.body.template.variables.CONFIRMATION_URL).searchParams.get("token"),
    ]),
    [
      ["old@example.com", "111111", "hash-current"],
      ["new@example.com", "222222", "hash-new-address"],
    ],
  );
  const keys = sent.map((email) => email.headers.get("idempotency-key"));
  assert.notEqual(keys[0], keys[1]);

  const single = await load();
  const onePair = hook(
    "email_change",
    { token: "333333", token_hash: "hash-only", token_new: "", token_hash_new: "" },
    { email: "old@example.com", new_email: "new@example.com" },
  );
  assert.equal((await single.handler(signed(onePair))).status, 200);
  assert.deepEqual(
    single.sent.map((email) => [email.body.to[0], email.body.template.variables.TOKEN]),
    [["new@example.com", "333333"]],
    "with one pair the code goes to the new address",
  );

  const none = await load();
  const empty = hook(
    "email_change",
    { token: "", token_hash: "" },
    { new_email: "new@example.com" },
  );
  assert.deepEqual(await status(await none.handler(signed(empty))), [
    400,
    "invalid_email_hook_payload",
  ]);
});

test("send-email answers 502 when Resend refuses, fails, or returns no id, and reports it", async () => {
  for (const resend of [
    () => new Response("denied", { status: 403 }),
    () => new Error("network down"),
    () => Response.json({}),
    () => new Response("not json"),
  ]) {
    const sentryEvents: SentryEvent[] = [];
    const { handler } = await load({
      resend,
      env: { SENTRY_DSN: "https://key@o0.ingest.sentry.io/1" },
      sentryEvents,
    });
    assert.deepEqual(await status(await handler(signed(hook("signup")))), [
      502,
      "email_provider_rejected_message",
    ]);
    assert.ok(
      sentryEvents.some((event) => event.kind === "exception"),
      "the failure reaches Sentry",
    );
  }
});

test("send-email stops after the first failure of a two-address change and retries with the same keys", async () => {
  const change = hook(
    "email_change",
    { token: "111111", token_hash: "h-new", token_new: "222222", token_hash_new: "h-cur" },
    { email: "old@example.com", new_email: "new@example.com" },
  );
  const failing = await load({
    resend: (_, index) =>
      index === 1 ? new Response("busy", { status: 500 }) : Response.json({ id: "ok" }),
  });
  assert.equal((await failing.handler(signed(change, "msg_C"))).status, 502);
  assert.equal(failing.sent.length, 2, "the first email went out, the second failed");

  const retry = await load();
  assert.equal((await retry.handler(signed(change, "msg_C"))).status, 200);
  assert.deepEqual(
    retry.sent.map((email) => email.headers.get("idempotency-key")),
    failing.sent.map((email) => email.headers.get("idempotency-key")),
    "Resend sees the same keys, so the delivered email is not sent twice",
  );
});

test("send-email refuses to build a link on a non-https project URL", async () => {
  const { handler, sent } = await load({ env: { SUPABASE_URL: "http://project.supabase.co" } });
  assert.deepEqual(await status(await handler(signed(hook("signup")))), [
    500,
    "email_hook_not_configured",
  ]);
  assert.equal(sent.length, 0);

  const local = await load({ env: { SUPABASE_URL: "http://localhost:54321" } });
  assert.equal((await local.handler(signed(hook("signup")))).status, 200);
});
