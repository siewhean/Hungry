// Merchant round-four phase 3 (P3-1, P3-3): the claimant is emailed once when ops approve a claim,
// the email never reaches the audit log, and a decision on an already-approved claim is a 409.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";

import {
  buildClaimNotApprovedEmail,
  buildMerchantApprovalEmail,
  sendClaimNotApprovedEmail,
  sendMerchantApprovalEmail,
} from "../../../marketing/website/web-v2/src/lib/email/merchantApprovalEmail";

const read = (path: string) => readFileSync(path, "utf8");
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

function configureEmail() {
  process.env.RESEND_API_KEY = "re_test";
  process.env.WAITLIST_EMAIL_FROM = "Hungry <hello@usehungry.com>";
  delete process.env.HUNGRY_EMAIL_API_URL;
}

test("the approval email names the stall, says what to do next and escapes the stall name", () => {
  const { html, subject, text } = buildMerchantApprovalEmail({
    stallName: "Ah <b>Seng</b> Noodles",
  });
  assert.equal(subject, "Your Hungry claim is approved");
  assert.match(text, /Ah <b>Seng<\/b> Noodles is approved|claim for Ah <b>Seng<\/b> Noodles/);
  assert.match(text, /Merchant Centre/);
  assert.match(text, /https:\/\/usehungry\.com\/for-merchants/);
  assert.doesNotMatch(html, /<b>Seng<\/b>/);
  assert.match(html, /&lt;b&gt;Seng&lt;\/b&gt;/);
});

test("the approval email falls back to 'your stall' without a name", () => {
  assert.match(buildMerchantApprovalEmail({}).text, /claim for your stall on Hungry/);
});

test("sending posts one email to the claimant through Resend and reports success", async () => {
  configureEmail();
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const sent = await sendMerchantApprovalEmail({ stallName: "Ah Seng", to: "tan@example.test" });
  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.deepEqual(calls[0].body.to, ["tan@example.test"]);
  assert.equal(calls[0].body.reply_to, "usehungrysingapore@gmail.com");
});

test("a rejected or failed send, or missing email settings, returns false and never throws", async () => {
  configureEmail();
  const errors = console.error;
  console.error = () => undefined;
  try {
    globalThis.fetch = (async () => new Response("no", { status: 422 })) as typeof fetch;
    assert.equal(await sendMerchantApprovalEmail({ to: "a@example.test" }), false);

    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    assert.equal(await sendMerchantApprovalEmail({ to: "a@example.test" }), false);

    delete process.env.RESEND_API_KEY;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    assert.equal(await sendMerchantApprovalEmail({ to: "a@example.test" }), false);
    assert.equal(called, false, "no key, no request");
  } finally {
    console.error = errors;
  }
});

test("console review: email once on a first approval, kept out of the audit log; 409 when nothing changed", () => {
  const data = read("marketing/website/web-v2/src/lib/supabase/consoleData.ts");
  const route = read("marketing/website/web-v2/src/app/api/console/claims/[claimId]/route.ts");
  const client = read("marketing/website/web-v2/src/app/console/ConsoleRouteClient.tsx");

  assert.match(
    data,
    /const \{ email, venueName, \.\.\.approval \}/,
    "email is split off before the audit",
  );
  assert.match(data, /metadata: approval,/);
  assert.match(data, /!alreadyApproved &&/, "a repeat approval does not email again");
  assert.match(data, /return \{ \.\.\.approval, emailSent, rivalEmailsSent/);
  assert.match(data, /prefer: "return=representation"/);
  assert.match(data, /throw new MerchantClaimConflictError/);
  assert.match(
    route,
    /instanceof MerchantClaimConflictError\) return jsonError\(error\.message, 409\)/,
  );
  assert.match(client, /approval email did not send/, "ops are told when the email failed");
});

test("approve_merchant_claim rejects the stall's other open claims and returns what the console needs", () => {
  const sql = read("supabase/migrations/20261029160000_merchant_claim_approval.sql");
  assert.match(sql, /set status = 'rejected'/);
  assert.match(sql, /status in \('new', 'contacted', 'qualified'\)/);
  assert.match(sql, /'alreadyApproved', v_was_approved/);
  assert.match(sql, /'rejectedOthers', v_rejected/);
  assert.match(sql, /'email', v_email/);
  assert.match(sql, /'venueName', v_venue\.name/);
});

test("the not-approved email says why, invites proof and escapes the stall name", () => {
  const { html, subject, text } = buildClaimNotApprovedEmail({ stallName: "Ah <i>Seng</i>" });
  assert.equal(subject, "About your Hungry stall claim");
  assert.match(text, /Another claim for Ah <i>Seng<\/i> was approved first/);
  assert.match(text, /reply to this email/);
  assert.doesNotMatch(html, /<i>Seng<\/i>/);
  assert.match(buildClaimNotApprovedEmail({}).text, /for this stall was approved first/);
});

test("the not-approved email is sent through Resend and fails soft", async () => {
  configureEmail();
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  assert.equal(
    await sendClaimNotApprovedEmail({ stallName: "Ah Seng", to: "rival@example.test" }),
    true,
  );
  assert.deepEqual(bodies[0].to, ["rival@example.test"]);
  assert.equal(bodies[0].subject, "About your Hungry stall claim");

  const errors = console.error;
  console.error = () => undefined;
  try {
    globalThis.fetch = (async () => new Response("no", { status: 500 })) as typeof fetch;
    assert.equal(await sendClaimNotApprovedEmail({ to: "rival@example.test" }), false);
  } finally {
    console.error = errors;
  }
});

test("console review tells the rejected rival claimants once, from one read of the stall's claims", () => {
  const data = read("marketing/website/web-v2/src/lib/supabase/consoleData.ts");
  assert.match(
    data,
    /status: "in\.\(new,contacted,qualified\)"/,
    "open rival claims are read before the approval",
  );
  assert.match(data, /const rivalsToTell = alreadyApproved \? \[\] : await rejectedRivals/);
  assert.match(
    data,
    /status: eq\("rejected"\)/,
    "only claims the approval really rejected are emailed",
  );
  assert.match(data, /return \{ \.\.\.approval, emailSent, rivalEmailsSent, rivalsRejected/);
});
