// Merchant round-three fixes that have no cheap render path (a diner screen's claim flow, the
// access gate inside MerchantTabs, token colours). Behaviour is covered in
// src/app/screens/merchant/merchant-r3.render.test.tsx.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { colors } from "@/theme/tokens";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("MERCH-10: an existing claim shows its status, not 'Claim this stall'", () => {
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  const branch = stall.slice(stall.indexOf('result.status === "already_exists"'));
  assert.match(branch.slice(0, 400), /setClaimStatus\(/);
});

test("MERCH-15: the Settings card names what Settings actually holds", () => {
  const dashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");
  assert.doesNotMatch(dashboard, /Manage staff access/);
  assert.match(dashboard, /Alerts, verification and account\./);
});

test("MERCH-20: Sign out on the merchant gate asks first", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  assert.match(tabs, /showAlert\("Sign out\?"/);
});

test("MERCH-22: 'Verification pending' uses orangeText, which passes AA on the soft orange fill", () => {
  const screen = read("src/app/screens/merchant/VerificationCentreScreen.tsx");
  assert.match(screen, /color: palette\.orangeText[^\n]*\n\s*Verification pending/);
  const light = colors.light;
  assert.ok(contrast(light.orangeText, light.orangeLight) >= 4.5);
  assert.match(screen, /activeOutlet\?\.isLive/);
});
