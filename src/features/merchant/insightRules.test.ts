import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMerchantInsights,
  buildWeeklySummaryInsight,
  formatInsightHour,
  isHourCoveredBySchedule,
  parseMerchantInsightFacts,
} from "@/features/merchant/insightRules";
import type { MerchantInsightFacts, OpeningSchedule } from "@/types/domain";

const NOW = new Date("2026-10-29T04:00:00Z");
const quiet: MerchantInsightFacts = {
  dishCount: 4,
  dishesWithoutPhoto: 0,
  soldOutCount: 0,
  soldOutNames: [],
  unrepliedReviews: 0,
  reviewsLast7Days: 0,
  reviewsPrevious7Days: 0,
};
const hours: OpeningSchedule = { weekly: { mon: [{ open: "08:00", close: "15:00" }] } };

const build = (
  facts: Partial<MerchantInsightFacts>,
  schedule: OpeningSchedule | null = hours,
  peak?: number,
) =>
  buildMerchantInsights({
    outletId: "o1",
    facts: { ...quiet, ...facts },
    openingSchedule: schedule ?? undefined,
    analytics: {
      profileVisits: 1,
      reviewCount: 0,
      peakDiscoveryHours: peak === undefined ? [] : [peak],
    },
    now: NOW,
  });

test("a quiet, complete stall gets no tips", () => {
  assert.deepEqual(build({}), []);
});

test("unreplied reviews say how long the oldest has waited", () => {
  const [tip] = build({ unrepliedReviews: 1, oldestUnrepliedAt: "2026-10-25T04:00:00Z" });
  assert.equal(tip.title, "1 review waiting for a reply");
  assert.match(tip.body, /waiting 4 days/);
  assert.equal(tip.actionTarget, "CustomerInboxUnreplied");
  assert.equal(tip.isDismissed, false);
});

test("a rating dip needs two reviews in both weeks and a drop of half a star", () => {
  const dip = {
    reviewsLast7Days: 3,
    ratingLast7Days: 3.5,
    reviewsPrevious7Days: 3,
    ratingPrevious7Days: 4.2,
  };
  assert.equal(build(dip).length, 1);
  assert.equal(build({ ...dip, ratingPrevious7Days: 3.9 }).length, 0, "a drop under 0.5 is noise");
  assert.equal(build({ ...dip, reviewsLast7Days: 1 }).length, 0, "one review is not a trend");
});

test("photo gaps and sold-out dishes name what they found", () => {
  const tips = build({
    dishesWithoutPhoto: 4,
    dishCount: 4,
    soldOutCount: 2,
    soldOutNames: ["Laksa", "Rojak"],
  });
  assert.equal(tips[0].title, "4 of 4 dishes have no photo");
  assert.equal(tips[1].title, "2 dishes marked sold out");
  assert.match(tips[1].body, /Laksa and Rojak show as sold out/);
});

test("a stall without opening hours is asked for them; with hours the peak hour is checked", () => {
  assert.equal(build({}, null)[0].id, "hours-missing:o1");
  assert.equal(build({}, hours, 20)[0].title, "Diners look for you around 8 pm");
  assert.equal(build({}, hours, 9).length, 0);
});

test("R5-1: hours typed as text are not reported as missing", () => {
  const withText = (operatingHours?: string) =>
    buildMerchantInsights({
      outletId: "o1",
      facts: quiet,
      operatingHours,
      now: NOW,
    });
  const textOnly = withText("7:00 AM – 3:00 PM");
  assert.equal(textOnly.length, 1);
  assert.equal(textOnly[0].id, "hours-text-only:o1");
  assert.equal(textOnly[0].title, "Set hours for each day");
  assert.match(textOnly[0].body, /Diners see "7:00 AM – 3:00 PM"/);
  assert.match(textOnly[0].body, /open now/);
  assert.equal(textOnly[0].actionTarget, "BusinessProfileEditor");
  // Blank text still counts as no hours.
  assert.equal(withText("   ")[0].id, "hours-missing:o1");
  assert.equal(withText(undefined)[0].id, "hours-missing:o1");
  // A real weekly schedule wins over the text.
  assert.equal(
    buildMerchantInsights({
      outletId: "o1",
      facts: quiet,
      openingSchedule: hours,
      operatingHours: "7:00 AM – 3:00 PM",
      now: NOW,
    }).length,
    0,
  );
});

test("hour coverage handles overnight ranges and the end of the day", () => {
  const night: OpeningSchedule = { weekly: { fri: [{ open: "22:00", close: "02:00" }] } };
  assert.equal(isHourCoveredBySchedule(night, 23), true);
  assert.equal(isHourCoveredBySchedule(night, 1), true);
  assert.equal(isHourCoveredBySchedule(night, 12), false);
  const late: OpeningSchedule = { weekly: { sat: [{ open: "18:00", close: "24:00" }] } };
  assert.equal(isHourCoveredBySchedule(late, 23), true);
  assert.equal(formatInsightHour(0), "12 am");
  assert.equal(formatInsightHour(12), "12 pm");
  assert.equal(formatInsightHour(13), "1 pm");
});

test("the weekly card uses thousands separators and a percentage against the week before", () => {
  const card = buildWeeklySummaryInsight(
    "o1",
    {
      profileVisits: 1200,
      reviewCount: 1,
      peakDiscoveryHours: [],
      previousPeriodComparison: { profileVisits: 1000 },
    },
    NOW,
  );
  assert.match(card.body, /1,200 profile visits and 1 customer review\./);
  assert.match(card.body, /20% more visits/);
});

test("the facts payload tolerates missing and odd fields", () => {
  assert.deepEqual(parseMerchantInsightFacts(null).soldOutNames, []);
  const parsed = parseMerchantInsightFacts({
    dishCount: 3,
    ratingLast7Days: "4.50",
    soldOutNames: ["A", 7],
  });
  assert.equal(parsed.dishCount, 3);
  assert.equal(parsed.ratingLast7Days, 4.5);
  assert.deepEqual(parsed.soldOutNames, ["A"]);
  assert.equal(parsed.unrepliedReviews, 0);
});
