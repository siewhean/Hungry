import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  formatAverageRating,
  formatBusinessType,
  formatPeakHour,
  formatRatingChange,
  formatReviewCountLabel,
  getAverageRatingFromReviews,
  getMerchantOutletStatus,
  getMerchantOutletStatusLabel,
  getMerchantProfileGaps,
  getMetricDelta,
  getPromotionPricing,
  getUnrepliedReviews,
  getVerificationStatusInfo,
  resolvePromotionRuntimeStatus,
} from "./merchantReadiness";
import type { CustomerInteraction } from "@/types/domain";
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

test("an empty outlet lists every profile gap, and dishes without photos count only with a menu", () => {
  const empty = { name: " ", businessType: undefined } as unknown as MerchantOutlet;
  assert.deepEqual(
    getMerchantProfileGaps(empty, { menuCount: 0, dishesWithoutImages: 0 }).map((gap) => gap.id),
    [
      "name",
      "business-type",
      "description",
      "profile-image",
      "cover-image",
      "location",
      "contact",
      "opening-hours",
      "menu-items",
    ],
  );
  const listed = {
    name: "Ah Seng",
    businessType: "hawker_stall",
    description: "Wonton mee",
    profilePhotoUrl: "a.jpg",
    coverPhotoUrl: "b.jpg",
    buildingId: "building-1",
    contactEmail: "hello@example.sg",
    operatingHours: "Mon-Sun 8am-2pm",
  } as unknown as MerchantOutlet;
  assert.deepEqual(
    getMerchantProfileGaps(listed, { menuCount: 4, dishesWithoutImages: 2 }).map((gap) => gap.id),
    ["dish-images"],
  );
});

test("each verification status names itself and the next step", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  const label = (status: string, expiresAt?: string) =>
    getVerificationStatusInfo(
      { status, expiresAt } as Parameters<typeof getVerificationStatusInfo>[0],
      now,
    ).label;
  assert.equal(getVerificationStatusInfo(undefined, now).label, "Not started");
  assert.equal(label("verified", "2027-01-01T00:00:00Z"), "Verified");
  assert.equal(label("verified", "2026-01-01T00:00:00Z"), "Expired");
  assert.equal(label("draft"), "Not submitted");
  assert.equal(label("submitted"), "Submitted");
  assert.equal(label("in_review"), "In review");
  assert.equal(label("rejected"), "Rejected");
  assert.equal(label("more_info_needed"), "More info needed");
  assert.equal(getVerificationStatusInfo({ status: "submitted" }, now).nextStep.length > 0, true);
});

test("outlet status: offline when not live, closed for a temporary closure, live without hours", () => {
  assert.equal(getMerchantOutletStatus(undefined), "offline");
  assert.equal(getMerchantOutletStatus({ isLive: false } as MerchantOutlet), "offline");
  assert.equal(
    getMerchantOutletStatus({ isLive: true, temporaryClosure: "Away" } as MerchantOutlet),
    "closed",
  );
  assert.equal(getMerchantOutletStatus({ isLive: true } as MerchantOutlet), "live");
  assert.equal(getMerchantOutletStatusLabel("open"), "Open now");
  assert.equal(getMerchantOutletStatusLabel("live"), "Live on Hungry");
  assert.equal(getMerchantOutletStatusLabel("offline"), "Offline");
  assert.equal(getMerchantOutletStatusLabel("closed"), "Closed");
  assert.equal(formatBusinessType("hawker_stall"), "Hawker Stall");
  assert.equal(formatBusinessType("food_truck" as MerchantOutlet["businessType"]), "food truck");
});

test("review helpers count only reviews, and the rating tiles never invent a number", () => {
  const interactions = [
    { type: "review", rating: 4 },
    { type: "review", rating: 2, reply: { text: "Thanks" } },
    { type: "review" },
    { type: "question", rating: 5 },
  ] as unknown as CustomerInteraction[];
  assert.equal(getUnrepliedReviews(interactions).length, 2);
  assert.equal(getAverageRatingFromReviews(interactions), 3);
  assert.equal(getAverageRatingFromReviews([]), 0);
  assert.equal(formatAverageRating(4.25, 3), "4.3");
  assert.equal(formatAverageRating(0, 0), "–");
  assert.equal(formatReviewCountLabel(0, "this week"), "No reviews yet");
  assert.equal(
    formatReviewCountLabel(0, "this week", { zeroLabel: "None this week" }),
    "None this week",
  );
  assert.equal(formatReviewCountLabel(1, "this week"), "1 review this week");
  assert.equal(formatReviewCountLabel(3, "this week"), "3 reviews this week");
  assert.equal(formatRatingChange(4, 3, 0, 2), "No reviews yet");
  assert.equal(formatRatingChange(4, 3, 2, 0), "New");
  assert.equal(formatRatingChange(4.2, 4, 2, 2), "+0.2★");
  assert.equal(formatRatingChange(3.5, 4, 2, 2), "-0.5★");
  assert.equal(formatRatingChange(4, 4, 2, 2), "0.0★");
  assert.deepEqual(getMetricDelta(0, 0), { label: "0%", trend: "flat" });
  assert.deepEqual(getMetricDelta(5, 0), { label: "New", trend: "up" });
});

test("peak hours read as 12-hour clock times, wrapping out-of-range hours", () => {
  assert.equal(formatPeakHour(0), "12 AM");
  assert.equal(formatPeakHour(9), "9 AM");
  assert.equal(formatPeakHour(12), "12 PM");
  assert.equal(formatPeakHour(15), "3 PM");
  assert.equal(formatPeakHour(-1), "11 PM");
  assert.equal(formatPeakHour(25.7), "1 AM");
});

test("promotion status follows its dates unless it is a draft or was ended early", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  const promo = (status: string, startDate: string, endDate: string) =>
    resolvePromotionRuntimeStatus(
      { status, startDate, endDate } as Parameters<typeof resolvePromotionRuntimeStatus>[0],
      now,
    );
  assert.equal(promo("draft", "2026-10-01", "2026-12-01"), "draft");
  assert.equal(promo("ended", "2026-10-01", "2026-12-01"), "ended");
  assert.equal(promo("active", "2026-10-01", "2026-10-02"), "ended");
  assert.equal(promo("active", "2026-11-01", "2026-12-01"), "scheduled");
  assert.equal(promo("active", "2026-10-01", "2026-12-01"), "active");
  assert.equal(promo("scheduled", "not a date", "not a date"), "active");
});

test("promotion pricing shows the price change, else the discount, else nothing", () => {
  assert.deepEqual(getPromotionPricing({ originalPrice: 10, finalPrice: 8 }), {
    originalPrice: 10,
    finalPrice: 8,
    discountPercentage: 20,
    label: "S$10.00 → S$8.00",
  });
  assert.equal(
    getPromotionPricing({ originalPrice: 10, promotionalPrice: 9 }).label,
    "S$10.00 → S$9.00",
  );
  assert.equal(
    getPromotionPricing({ originalPrice: 0, finalPrice: 0 }).discountPercentage,
    undefined,
  );
  assert.deepEqual(getPromotionPricing({ discountPercentage: 15 }), {
    discountPercentage: 15,
    label: "15% off",
  });
  assert.deepEqual(getPromotionPricing({ discountPercentage: 0 }), { label: "" });
  assert.deepEqual(getPromotionPricing({}), { label: "" });
});
