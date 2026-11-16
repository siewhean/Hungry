import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_OPEN_WAIT_MS,
  isPhoneUserAgent,
} from "../../../marketing/website/web-v2/src/lib/share/openInApp";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const web = "marketing/website/web-v2/src";

test("Open in Hungry is offered on phones only", () => {
  assert.equal(
    isPhoneUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    ),
    true,
  );
  assert.equal(
    isPhoneUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36"),
    true,
  );
  assert.equal(
    isPhoneUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"),
    false,
  );
  assert.equal(isPhoneUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"), false);
  assert.equal(isPhoneUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel Tablet) Safari/537.36"), false);
  assert.equal(isPhoneUserAgent(""), false);
  assert.equal(isPhoneUserAgent(null), false);
  assert.ok(APP_OPEN_WAIT_MS >= 1000 && APP_OPEN_WAIT_MS <= 3000);
});

test("shared-link page leads with one working next step", () => {
  const preview = read(`${web}/components/share/SharePreview.tsx`);
  assert.match(preview, /Get early access/);
  assert.match(preview, /href="\/join-waitlist"/);
  assert.match(preview, /siteConfig\.appStoreUrl/);
  assert.doesNotMatch(preview, /Get Hungry/);
  assert.match(read(`${web}/app/seo.ts`), /appStoreUrl: \(process\.env\.NEXT_PUBLIC_APP_STORE_URL/);
  const open = read(`${web}/components/share/OpenInHungry.tsx`);
  assert.match(open, /isPhoneUserAgent\(navigator\.userAgent\)/);
  assert.match(open, /Hungry didn't open/);
});
