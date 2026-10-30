import type {
  AIBusinessInsight,
  MerchantAnalytics,
  MerchantInsightFacts,
  OpeningSchedule,
} from "@/types/domain";
import { OPENING_DAY_KEYS, hasWeeklyHours, parseClock } from "@/utils/openingSchedule";

/**
 * Rule-based tips for the Insights screen, built only from data the server holds: unreplied
 * reviews, dishes without a photo, dishes marked sold out, a rating drop and the busiest
 * discovery hour against the opening hours. Nothing here is generated or guessed, so every
 * card can be traced to a number on the merchant's own account.
 */

const DAY_MS = 86_400_000;
/** A rating needs at least this many reviews in both weeks before a drop is worth a card. */
const MIN_REVIEWS_FOR_RATING_CHANGE = 2;
const RATING_DROP_THRESHOLD = 0.5;

export interface InsightInput {
  outletId: string;
  facts: MerchantInsightFacts;
  analytics?: Pick<MerchantAnalytics, "profileVisits" | "reviewCount" | "peakDiscoveryHours"> & {
    previousPeriodComparison?: Pick<MerchantAnalytics["previousPeriodComparison"], "profileVisits">;
  };
  openingSchedule?: OpeningSchedule;
  now?: Date;
}

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

/** 13 -> "1 pm", 0 -> "12 am". */
export function formatInsightHour(hour: number): string {
  const normalized = ((Math.round(hour) % 24) + 24) % 24;
  const suffix = normalized < 12 ? "am" : "pm";
  const twelve = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${twelve} ${suffix}`;
}

/** True when some day of the week is open for the whole of that clock hour. */
export function isHourCoveredBySchedule(schedule: OpeningSchedule, hour: number): boolean {
  const start = hour * 60;
  const end = start + 60;
  return OPENING_DAY_KEYS.some((key) =>
    (schedule.weekly[key] ?? []).some((range) => {
      const open = parseClock(range.open);
      const close = parseClock(range.close, true);
      if (open === null || close === null) return false;
      // An overnight range (22:00 to 02:00) covers the evening and the early hours.
      return close > open ? open <= start && end <= close : start >= open || end <= close;
    }),
  );
}

function joinNames(names: readonly string[], total: number): string {
  const shown = names.slice(0, 3);
  const rest = total - shown.length;
  const list =
    shown.length <= 1
      ? shown.join("")
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${list} and ${rest} more` : list;
}

export function buildMerchantInsights(input: InsightInput): AIBusinessInsight[] {
  const { facts, outletId, analytics, openingSchedule } = input;
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const insights: AIBusinessInsight[] = [];
  const add = (
    id: string,
    type: AIBusinessInsight["type"],
    title: string,
    body: string,
    action?: { label: string; target: string },
  ) =>
    insights.push({
      id: `${id}:${outletId}`,
      outletId,
      type,
      title,
      body,
      actionLabel: action?.label,
      actionTarget: action?.target,
      createdAt,
      isDismissed: false,
    });

  if (facts.unrepliedReviews > 0) {
    const oldestDays = facts.oldestUnrepliedAt
      ? Math.floor((now.getTime() - new Date(facts.oldestUnrepliedAt).getTime()) / DAY_MS)
      : 0;
    add(
      `unreplied-${facts.unrepliedReviews}`,
      "review_attention",
      `${facts.unrepliedReviews} ${plural(facts.unrepliedReviews, "review")} waiting for a reply`,
      oldestDays >= 2
        ? `The oldest has been waiting ${oldestDays} days. A short thank-you shows diners you read their review.`
        : "A short thank-you shows diners you read their review.",
      { label: "Reply now", target: "CustomerInboxUnreplied" },
    );
  }

  const ratingNow = facts.ratingLast7Days;
  const ratingBefore = facts.ratingPrevious7Days;
  if (
    ratingNow !== undefined &&
    ratingBefore !== undefined &&
    facts.reviewsLast7Days >= MIN_REVIEWS_FOR_RATING_CHANGE &&
    facts.reviewsPrevious7Days >= MIN_REVIEWS_FOR_RATING_CHANGE &&
    ratingBefore - ratingNow >= RATING_DROP_THRESHOLD
  ) {
    add(
      `rating-${ratingNow.toFixed(1)}-${ratingBefore.toFixed(1)}`,
      "review_attention",
      "Your rating dipped this week",
      `It averaged ${ratingNow.toFixed(1)} over ${facts.reviewsLast7Days} reviews, down from ${ratingBefore.toFixed(1)}. Read the latest reviews and reply where you can.`,
      { label: "Read reviews", target: "CustomerInbox" },
    );
  }

  if (facts.dishCount > 0 && facts.dishesWithoutPhoto > 0) {
    add(
      `photos-${facts.dishesWithoutPhoto}`,
      "photo_enhancement",
      `${facts.dishesWithoutPhoto} of ${facts.dishCount} ${plural(facts.dishCount, "dish", "dishes")} ${plural(facts.dishesWithoutPhoto, "has", "have")} no photo`,
      "Diners cannot see what these dishes look like. Add a photo to each one.",
      { label: "Add photos", target: "Menu" },
    );
  }

  if (facts.soldOutCount > 0) {
    add(
      `soldout-${facts.soldOutNames.join("|")}-${facts.soldOutCount}`,
      "menu_cleanup",
      `${facts.soldOutCount} ${plural(facts.soldOutCount, "dish", "dishes")} marked sold out`,
      `${joinNames(facts.soldOutNames, facts.soldOutCount)} ${plural(facts.soldOutCount, "shows", "show")} as sold out to diners. Turn ${plural(facts.soldOutCount, "it", "them")} back on when ${plural(facts.soldOutCount, "it is", "they are")} ready.`,
      { label: "Open menu", target: "Menu" },
    );
  }

  if (!hasWeeklyHours(openingSchedule)) {
    add(
      "hours-missing",
      "profile_improvement",
      "Add your opening hours",
      "Diners cannot see when you are open, and the stall cannot show as open now.",
      { label: "Add hours", target: "BusinessProfileEditor" },
    );
  } else {
    const peak = analytics?.peakDiscoveryHours?.[0];
    if (peak !== undefined && !isHourCoveredBySchedule(openingSchedule, peak)) {
      add(
        `hours-peak-${peak}`,
        "demand_insight",
        `Diners look for you around ${formatInsightHour(peak)}`,
        "Your opening hours do not cover that time on any day. If you can open then, update your hours.",
        { label: "Update hours", target: "BusinessProfileEditor" },
      );
    }
  }

  return insights;
}

/** The "Last 7 days" card: the numbers the Performance screen already shows. */
export function buildWeeklySummaryInsight(
  outletId: string,
  analytics: NonNullable<InsightInput["analytics"]>,
  now: Date = new Date(),
): AIBusinessInsight {
  const visits = analytics.profileVisits;
  const before = analytics.previousPeriodComparison?.profileVisits ?? 0;
  const change =
    before > 0
      ? ` That is ${Math.round((Math.abs(visits - before) / before) * 100)}% ${visits >= before ? "more" : "fewer"} visits than the week before.`
      : "";
  return {
    id: `weekly-${outletId}`,
    outletId,
    type: "weekly_summary",
    title: "Last 7 days",
    body: `${visits.toLocaleString("en-SG")} profile ${plural(visits, "visit")} and ${analytics.reviewCount} customer ${plural(analytics.reviewCount, "review")}.${change}`,
    actionLabel: "Open performance",
    actionTarget: "Analytics",
    createdAt: now.toISOString(),
    isDismissed: false,
  };
}

/** Reads the get_merchant_insight_facts payload; a missing or odd field counts as zero. */
export function parseMerchantInsightFacts(raw: unknown): MerchantInsightFacts {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);
  const average = (value: unknown) => {
    const parsed = typeof value === "string" ? Number(value) : value;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    dishCount: count(row.dishCount),
    dishesWithoutPhoto: count(row.dishesWithoutPhoto),
    soldOutCount: count(row.soldOutCount),
    soldOutNames: Array.isArray(row.soldOutNames)
      ? row.soldOutNames.filter((name): name is string => typeof name === "string")
      : [],
    unrepliedReviews: count(row.unrepliedReviews),
    oldestUnrepliedAt:
      typeof row.oldestUnrepliedAt === "string" ? row.oldestUnrepliedAt : undefined,
    reviewsLast7Days: count(row.reviewsLast7Days),
    ratingLast7Days: average(row.ratingLast7Days),
    reviewsPrevious7Days: count(row.reviewsPrevious7Days),
    ratingPrevious7Days: average(row.ratingPrevious7Days),
  };
}
