// End-to-end waitlist check: starts a stand-in Supabase REST endpoint that
// enforces the website_waitlist_entries unique-email rule, starts the site
// against it, and submits through the real /api/waitlist route.
import { spawn } from "node:child_process";
import http from "node:http";

const mockPort = Number(process.env.HUNGRY_WAITLIST_E2E_MOCK_PORT || 54329);
const sitePort = Number(process.env.HUNGRY_WAITLIST_E2E_SITE_PORT || 3109);
const siteUrl = `http://127.0.0.1:${sitePort}`;
const rows = new Map();
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (req.method !== "POST" || !req.url.startsWith("/rest/v1/website_waitlist_entries")) {
      res.writeHead(404).end();
      return;
    }
    const row = JSON.parse(body);
    const merge = /merge-duplicates/.test(String(req.headers.prefer ?? ""));
    if (rows.has(row.email) && !merge) {
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }));
      return;
    }
    rows.set(row.email, row);
    res.writeHead(201).end();
  });
});

async function post(body, init = {}) {
  const response = await fetch(`${siteUrl}/api/waitlist`, {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    method: "POST",
  });
  return { payload: await response.json().catch(() => ({})), status: response.status };
}

async function waitForSite(deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${siteUrl}/join-waitlist`);
      if (response.ok) return true;
    } catch {
      // Server still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const site = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(sitePort)],
  {
    env: {
      ...process.env,
      NEXT_DISABLE_SWC: "1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "waitlist-e2e-anon-key",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    stdio: "ignore",
  },
);

try {
  if (!(await waitForSite(Date.now() + 120_000))) {
    failures.push("Site did not start for the waitlist e2e check.");
  } else {
    const foodie = await post({ audience: "foodie", email: "Foodie@Example.com", name: "Tester" });
    expect(foodie.status === 200 && foodie.payload.ok === true, "Foodie signup should succeed.");
    expect(rows.get("foodie@example.com")?.audience === "foodie", "Foodie row should be stored lowercased.");
    expect(rows.get("foodie@example.com")?.source === "web_v2", "Row should carry the web_v2 source.");

    const repeat = await post({ audience: "foodie", email: "foodie@example.com" });
    expect(repeat.status === 200 && repeat.payload.alreadyExists === true, "Repeat signup should report alreadyExists.");
    expect(rows.size === 1, "Repeat signup must not create a second row.");

    const merchant = await post({
      audience: "merchant",
      businessName: "Test Stall",
      email: "stall@example.com",
      establishmentType: "hawker",
    });
    expect(merchant.status === 200, "Merchant signup should succeed.");
    expect(rows.get("stall@example.com")?.business_name === "Test Stall", "Merchant business name should be stored.");

    const missingBusiness = await post({ audience: "merchant", email: "x@example.com" });
    expect(missingBusiness.status === 400, "Merchant signup without a business name should be rejected.");

    const badEmail = await post({ audience: "foodie", email: "nope" });
    expect(badEmail.status === 400, "Invalid email should be rejected.");

    const notJson = await fetch(`${siteUrl}/api/waitlist`, { body: "x", method: "POST" });
    expect(notJson.status === 415, "Non-JSON requests should be rejected.");
  }
} finally {
  site.kill("SIGTERM");
  mock.close();
}

if (failures.length > 0) {
  console.error("Waitlist e2e check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Waitlist e2e check passed.");
process.exit(0);
