import { Webhook } from "npm:standardwebhooks@^1";
import { handleEmailHook } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const secret = btoa("hungry-local-webhook-test-secret-only");
const configuration: Record<string, string> = {
  RESEND_API_KEY: "test-only-unused-api-key",
  RESEND_FROM: "Hungry <hello@example.test>",
  SEND_EMAIL_HOOK_SECRET: `v1,whsec_${secret}`,
  SUPABASE_URL: "https://supabase.example.test",
  RESEND_TEMPLATE_SIGNUP_ID: "signup-template",
  RESEND_TEMPLATE_RECOVERY_ID: "recovery-template",
  RESEND_TEMPLATE_MAGICLINK_ID: "magiclink-template",
};
function payload(action = "signup") {
  return {
    user: { email: "current@example.test", new_email: "new@example.test" },
    email_data: {
      email_action_type: action,
      token: "123456", token_hash: "new-hash",
      token_new: "654321", token_hash_new: "current-hash",
      redirect_to: "hungry://auth/callback",
    },
  };
}
function signedRequest(body: unknown, id = "local-event-1", timestamp = new Date()) {
  const text = JSON.stringify(body);
  return new Request("https://function.example.test/send-email", {
    method: "POST", body: text,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": new Webhook(secret).sign(id, timestamp, text),
    },
  });
}
async function withProvider(run: (calls: { body: Record<string, unknown>; key: string }[]) => Promise<void>, failures: number[] = []) {
  const originalFetch = globalThis.fetch;
  const previous = Object.fromEntries(Object.keys(configuration).map(key => [key, Deno.env.get(key)]));
  for (const [key, value] of Object.entries(configuration)) Deno.env.set(key, value);
  const calls: { body: Record<string, unknown>; key: string }[] = [];
  globalThis.fetch = async (_input, init) => {
    calls.push({ body: JSON.parse(String(init?.body)), key: new Headers(init?.headers).get("Idempotency-Key") ?? "" });
    return failures.includes(calls.length)
      ? new Response("{}", { status: 503 })
      : Response.json({ id: `local-receipt-${calls.length}` });
  };
  try { await run(calls); }
  finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
  }
}
Deno.test("auth hook validates signature and replay age before any provider call", () => withProvider(async calls => {
  const unsigned = new Request("https://function.example.test", { method: "POST", body: JSON.stringify(payload()) });
  assert((await handleEmailHook(unsigned)).status === 401, "unsigned hook must fail");
  assert((await handleEmailHook(signedRequest(payload(), "old-event", new Date(Date.now() - 3600000)))).status === 401, "expired signature must fail");
  assert(calls.length === 0, "unverified hooks must never send email");
}));
Deno.test("auth hook rejects non-string recipient without sending", () => withProvider(async calls => {
  const invalid = { ...payload(), user: { email: { address: "invalid" } } };
  assert((await handleEmailHook(signedRequest(invalid))).status === 400, "invalid recipient must fail validation");
  assert(calls.length === 0, "invalid recipient must never reach provider");
}));
Deno.test("recovery hook sends verified token and same idempotency key on retry", () => withProvider(async calls => {
  assert((await handleEmailHook(signedRequest(payload("recovery")))).status === 200, "valid recovery should succeed");
  assert((await handleEmailHook(signedRequest(payload("recovery")))).status === 200, "safe retry should succeed");
  assert(calls[0].key.length > 20 && calls[0].key === calls[1].key, "retry key must remain stable");
  const template = calls[0].body.template as { id: string; variables: { TOKEN: string; CONFIRMATION_URL: string } };
  assert(template.id === "recovery-template" && template.variables.TOKEN === "123456", "recovery template and OTP must match");
  assert(new URL(template.variables.CONFIRMATION_URL).searchParams.get("type") === "recovery", "recovery confirmation type must match");
}));
Deno.test("email-change partial provider failure preserves per-recipient retry identities", () => withProvider(async calls => {
  assert((await handleEmailHook(signedRequest(payload("email_change")))).status === 502, "second-recipient failure must be visible");
  assert((await handleEmailHook(signedRequest(payload("email_change")))).status === 200, "retry may complete");
  assert(calls.length === 4 && calls[0].key === calls[2].key && calls[1].key === calls[3].key, "each recipient retry identity must stay stable");
  assert(calls[0].key !== calls[1].key, "recipient identities must differ");
  const first = calls[0].body.template as { variables: { TOKEN: string; CONFIRMATION_URL: string } };
  const second = calls[1].body.template as { variables: { TOKEN: string; CONFIRMATION_URL: string } };
  assert(first.variables.TOKEN === "123456" && new URL(first.variables.CONFIRMATION_URL).searchParams.get("token") === "current-hash", "current address must receive current token/hash pair");
  assert(second.variables.TOKEN === "654321" && new URL(second.variables.CONFIRMATION_URL).searchParams.get("token") === "new-hash", "new address must receive new token/hash pair");
}, [2]));
