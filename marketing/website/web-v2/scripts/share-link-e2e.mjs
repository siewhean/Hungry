// Browser check for a shared link opened on a phone with no app: starts a stand-in for the
// Supabase REST API, starts the site against it, and loads /dish/:id in a phone and a desktop
// browser. The page must show the dish, its price and its stall, and offer a next step that
// works: "Get early access" (or the App Store badge once the listing exists). "Open in Hungry"
// shows only on a phone, and when the app does not open, the page says so.
//
//   node scripts/share-link-e2e.mjs                 run the checks
//   SHARE_E2E_SHOTS=<dir> SHARE_E2E_LABEL=before …  also save phone screenshots (no assertions
//                                                    about the new behaviour when LABEL=before)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const requireFrom = (base) => createRequire(path.join(base, "package.json"));

function loadPlaywright() {
  // The repo root installs Playwright for the app's own suite; the website does not.
  for (const base of [path.resolve(here, "../../../.."), path.resolve(here, "..")]) {
    for (const name of ["playwright", "@playwright/test"]) {
      try {
        return requireFrom(base)(name);
      } catch {
        // try the next location
      }
    }
  }
  try {
    return createRequire(import.meta.url)("playwright");
  } catch {
    return null;
  }
}

const playwright = loadPlaywright();
if (!playwright) {
  console.error("Share-link e2e check failed: Playwright is not installed.");
  process.exit(1);
}
const { chromium, devices } = playwright;

const mockPort = Number(process.env.HUNGRY_SHARE_E2E_MOCK_PORT || 54339);
const sitePort = Number(process.env.HUNGRY_SHARE_E2E_SITE_PORT || 3119);
const shotsDir = process.env.SHARE_E2E_SHOTS || "";
const shotLabel = process.env.SHARE_E2E_LABEL || "after";
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const DISH_ID = "11111111-1111-4111-8111-111111111111";
const VENUE_ID = "22222222-2222-4222-8222-222222222222";
const dish = {
  id: DISH_ID,
  name: "Hainanese chicken rice",
  description: "Poached chicken over fragrant rice, with chilli and ginger.",
  price: 4.5,
  image_url: null,
  media_approved_for_display: false,
  updated_at: "2026-11-10T04:00:00Z",
  venue_id: VENUE_ID,
};
const venue = {
  id: VENUE_ID,
  name: "Ah Heng Chicken Rice",
  unit_number: "#01-23",
  floor: "Level 1",
  operating_hours: "7am to 3pm",
  address: "50 Jurong West Street 61",
  postal_code: "640050",
  building_id: null,
};

const mock = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://stand-in");
  const send = (rows) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(rows));
  if (url.pathname === "/rest/v1/dishes") {
    return send(url.searchParams.get("id") === `eq.${DISH_ID}` ? [dish] : []);
  }
  if (url.pathname === "/rest/v1/venues") {
    return send(url.searchParams.get("id") === `eq.${VENUE_ID}` ? [venue] : []);
  }
  send([]);
});

const site = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(sitePort)],
  {
    cwd: path.resolve(here, ".."),
    env: {
      ...process.env,
      NEXT_DISABLE_SWC: "1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "share-e2e-anon-key",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    },
    stdio: "ignore",
  },
);

const siteUrl = `http://127.0.0.1:${sitePort}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSite() {
  for (let deadline = Date.now() + 120_000; Date.now() < deadline; ) {
    try {
      if ((await fetch(`${siteUrl}/join-waitlist`)).ok) return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function shot(page, name) {
  if (!shotsDir) return;
  fs.mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: path.join(shotsDir, `${shotLabel}-${name}.png`), fullPage: true });
}

await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
let browser;
try {
  if (!(await waitForSite())) {
    failures.push("Site did not start.");
  } else {
    browser = await chromium.launch();
    const link = `${siteUrl}/dish/${DISH_ID}?src=whatsapp`;

    // A phone with no app.
    const phone = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2 });
    const mobile = await phone.newPage();
    // The custom scheme goes nowhere on a phone without the app: record the attempt and stay put.
    await mobile.route(/^hungry:/, (route) => route.abort());
    await mobile.goto(link, { waitUntil: "networkidle" });
    await mobile.waitForTimeout(500);
    await shot(mobile, "phone-dish");

    if (shotLabel !== "before") {
      const body = await mobile.locator("main").innerText();
      expect(/Hainanese chicken rice/.test(body), "Phone: the dish name should show.");
      expect(/S\$4\.50/.test(body), "Phone: the price should show.");
      expect(/Ah Heng Chicken Rice/.test(body), "Phone: the stall should show.");
      expect(/#01-23/.test(body), "Phone: the unit should show.");

      const early = mobile.getByRole("link", { name: "Get early access" }).first();
      expect(await early.isVisible(), "Phone: 'Get early access' should be offered.");
      expect(
        (await early.getAttribute("href")) === "/join-waitlist",
        "Phone: 'Get early access' should go to the waitlist.",
      );
      expect(
        (await mobile.getByRole("link", { name: "Get Hungry" }).count()) === 0,
        "Phone: the old bottom 'Get Hungry' button should be gone.",
      );

      const open = mobile.getByRole("link", { name: "Open in Hungry" });
      expect(await open.isVisible(), "Phone: 'Open in Hungry' should show on a phone.");
      expect(
        (await open.getAttribute("href")) === `hungry://dish/${DISH_ID}?src=whatsapp`,
        "Phone: 'Open in Hungry' should carry the app link and the share tag.",
      );
      expect(
        (await mobile.getByText("Hungry did not open").count()) === 0,
        "Phone: no 'did not open' note before the button is tapped.",
      );
      await open.click();
      await mobile.getByText(/didn.t open/i).waitFor({ timeout: 6000 }).catch(() => {});
      expect(
        (await mobile.getByText(/didn.t open/i).count()) > 0,
        "Phone: when the app does not open, the page should say so and point to early access.",
      );
      await shot(mobile, "phone-dish-no-app");
    }
    await phone.close();

    // A desktop browser: the app link cannot work there, so it is not shown.
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const wide = await desktop.newPage();
    await wide.goto(link, { waitUntil: "networkidle" });
    await wide.waitForTimeout(500);
    await shot(wide, "desktop-dish");
    if (shotLabel !== "before") {
      expect(
        (await wide.getByRole("link", { name: "Open in Hungry" }).count()) === 0,
        "Desktop: 'Open in Hungry' should not show.",
      );
      expect(
        await wide.getByRole("link", { name: "Get early access" }).first().isVisible(),
        "Desktop: 'Get early access' should be offered.",
      );
    }
    await desktop.close();

    // A removed dish keeps a friendly page with a next step.
    const gone = await fetch(`${siteUrl}/dish/33333333-3333-4333-8333-333333333333`);
    expect(gone.status === 404, "An unknown dish should be a 404.");
  }
} finally {
  await browser?.close();
  site.kill("SIGTERM");
  mock.close();
}

if (failures.length > 0) {
  console.error("Share-link e2e check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Share-link e2e check passed.");
process.exit(0);
