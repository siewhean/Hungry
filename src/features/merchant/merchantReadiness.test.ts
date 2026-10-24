import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getMerchantProfileGaps, getMetricDelta } from "./merchantReadiness";
import type { MerchantOutlet } from "@/types/domain";

test("getMetricDelta reports the real change and its direction", () => {
  assert.deepEqual(getMetricDelta(120, 100), { label: "+20%", trend: "up" });
  assert.deepEqual(getMetricDelta(80, 100), { label: "-20%", trend: "down" });
  assert.deepEqual(getMetricDelta(100, 100), { label: "0%", trend: "flat" });
  assert.deepEqual(getMetricDelta(5, 0), { label: "New", trend: "up" });
  assert.deepEqual(getMetricDelta(0, 0), { label: "0%", trend: "flat" });
});

test("dashboard metric cards show a trend only from real comparison data", () => {
  const dashboard = readFileSync(
    path.join(process.cwd(), "src/app/screens/merchant/MerchantDashboardScreen.tsx"),
    "utf8",
  );
  assert.match(dashboard, /getMetricDelta\(/);
  assert.match(dashboard, /previousPeriodComparison/);
  assert.match(dashboard, /trend === "up" \? \(\s*<TrendingUp/);
  assert.match(dashboard, /<TrendingDown/);
  assert.doesNotMatch(dashboard, /"vs last week"/);
});

test("MERCH-X2: no 'contact' gap while contact details are not loaded this session", () => {
  const outlet = {
    name: "Ah Seng",
    businessType: "hawker_stall",
    description: "Wonton mee",
    profilePhotoUrl: "a.jpg",
    coverPhotoUrl: "b.jpg",
    unitNumber: "#01-02",
    operatingHours: "Mon-Sun 8am-2pm",
    contactPhone: undefined,
    contactEmail: undefined,
  } as unknown as MerchantOutlet;
  const menu = { menuCount: 3, dishesWithoutImages: 0 };
  assert.deepEqual(getMerchantProfileGaps(outlet, menu, { contactKnown: false }), []);
  assert.deepEqual(
    getMerchantProfileGaps(outlet, menu).map((gap) => gap.id),
    ["contact"],
    "once synced, a missing contact is a real gap",
  );
});
