// End-to-end waitlist check: starts stand-ins for the Supabase REST API (with
// the unique-email rule of website_waitlist_entries) and the Resend email API,
// starts the site against them, and submits through the real /api/waitlist
// route. Runs twice: with the service-role key (production path) and without
// it (public-key fallback).
import { spawn } from "node:child_process";
import http from "node:http";

const mockPort = Number(process.env.HUNGRY_WAITLIST_E2E_MOCK_PORT || 54329);
const baseSitePort = Number(process.env.HUNGRY_WAITLIST_E2E_SITE_PORT || 3109);
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

let rows = new Map();
let emails = [];

const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const prefer = String(req.headers.prefer ?? "");

    if (req.method === "POST" && req.url === "/emails") {
      const email = JSON.parse(body);
      if (email.to?.[0] === "failmail@example.com") {
        res.writeHead(500).end();
        return;
      }
      emails.push(email);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: "mock" }));
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/rest/v1/website_waitlist_entries")) {
      const row = JSON.parse(body);
      const exists = rows.has(row.email);
      if (prefer.includes("ignore-duplicates")) {
        if (!exists) rows.set(row.email, row);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify(exists ? [] : [row]));
        return;
      }
      if (prefer.includes("merge-duplicates")) {
        rows.set(row.email, { ...rows.get(row.email), ...row });
        res.writeHead(201).end();
        return;
      }
      if (exists) {
        res.writeHead(409, { "content-type": "application/json" });
        res.end(JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }));
        return;
      }
      rows.set(row.email, row);
      res.writeHead(201).end();
      return;
    }

    res.writeHead(404).end();
  });
});

async function runMode(label, serviceRoleKey, sitePort) {
  rows = new Map();
  emails = [];
  const siteUrl = `http://127.0.0.1:${sitePort}`;
  const check = (condition, message) => expect(condition, `[${label}] ${message}`);

  const post = async (body) => {
    const response = await fetch(`${siteUrl}/api/waitlist`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return { payload: await response.json().catch(() => ({})), status: response.status };
  };

  const site = spawn(
    process.execPath,
    ["./node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(sitePort)],
    {
      env: {
        ...process.env,
        HUNGRY_EMAIL_API_URL: `http://127.0.0.1:${mockPort}`,
        NEXT_DISABLE_SWC: "1",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "waitlist-e2e-anon-key",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
        RESEND_API_KEY: "re_test",
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        WAITLIST_EMAIL_FROM: "Hungry <hello@example.com>",
      },
      stdio: "ignore",
    },
  );

  try {
    let started = false;
    for (let deadline = Date.now() + 120_000; Date.now() < deadline && !started; ) {
      try {
        started = (await fetch(`${siteUrl}/join-waitlist`)).ok;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!started) {
      failures.push(`[${label}] Site did not start.`);
      return;
    }

    const foodie = await post({
      attribution: { landing_path: "/", utm_campaign: "launch", utm_source: "tiktok", ignored: "x" },
      audience: "foodie",
      email: "Foodie@Example.com",
      name: "Tester",
    });
    check(foodie.status === 200 && foodie.payload.ok === true, "Foodie signup should succeed.");
    const stored = rows.get("foodie@example.com");
    check(stored?.audience === "foodie", "Foodie row should be stored lowercased.");
    check(stored?.source === "web_v2", "Row should carry the web_v2 source.");
    check(stored?.metadata?.attribution?.utm_source === "tiktok", "UTM source should be stored.");
    check(stored?.metadata?.attribution?.ignored === undefined, "Unknown attribution keys should be dropped.");
    check(emails.length === 1, "A new signup should send one welcome email.");
    check(emails[0]?.to?.[0] === "foodie@example.com", "Welcome email should go to the signup.");
    check(/Hungry list/.test(emails[0]?.subject ?? ""), "Foodie welcome subject should mention the list.");
    check(emails[0]?.reply_to === "usehungrysingapore@gmail.com", "Welcome email should reply to support.");

    const repeat = await post({ audience: "foodie", email: "foodie@example.com" });
    check(repeat.status === 200 && repeat.payload.alreadyExists === true, "Repeat signup should report alreadyExists.");
    check(rows.size === 1, "Repeat signup must not create a second row.");
    check(emails.length === 1, "Repeat signup must not send a second welcome email.");

    const merchant = await post({
      audience: "merchant",
      businessName: "Test Stall",
      email: "stall@example.com",
      establishmentType: "hawker",
    });
    check(merchant.status === 200, "Merchant signup should succeed.");
    check(rows.get("stall@example.com")?.business_name === "Test Stall", "Merchant business name should be stored.");
    check(emails.length === 2 && /merchant/.test(emails[1]?.subject ?? ""), "Merchant welcome email should be sent.");

    const upgrade = await post({
      audience: "merchant",
      businessName: "Ah Heng Stall",
      email: "foodie@example.com",
      establishmentType: "hawker",
    });
    check(upgrade.status === 200 && upgrade.payload.alreadyExists === true, "Upgrading an existing email should succeed.");
    if (serviceRoleKey) {
      check(rows.get("foodie@example.com")?.audience === "merchant", "Service path should update the repeat signup details.");
    }
    check(emails.length === 2, "Upgrading an existing email must not send another welcome email.");

    const emailDown = await post({ audience: "foodie", email: "failmail@example.com" });
    check(emailDown.status === 200 && rows.has("failmail@example.com"), "Signup should still succeed when the email provider fails.");

    const missingBusiness = await post({ audience: "merchant", email: "x@example.com" });
    check(missingBusiness.status === 400, "Merchant signup without a business name should be rejected.");

    const badEmail = await post({ audience: "foodie", email: "nope" });
    check(badEmail.status === 400, "Invalid email should be rejected.");

    const notJson = await fetch(`${siteUrl}/api/waitlist`, { body: "x", method: "POST" });
    check(notJson.status === 415, "Non-JSON requests should be rejected.");
  } finally {
    site.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
try {
  await runMode("service-role", "waitlist-e2e-service-key", baseSitePort);
  await runMode("public-key", "", baseSitePort + 1);
} finally {
  mock.close();
}

if (failures.length > 0) {
  console.error("Waitlist e2e check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Waitlist e2e check passed.");
process.exit(0);
