import type {
  CustomerInteraction,
  MerchantDashboardSummary,
  MerchantOutlet,
  MerchantPromotion,
  MerchantVerification,
} from "@/types/domain";
import { isVerificationCurrent } from "@/features/merchant/merchantGuards";
import { getVenueOpenState } from "@/utils/operatingHours";
import { getScheduleOpenState, hasWeeklyHours } from "@/utils/openingSchedule";
import { isClosureActive } from "@/features/merchant/closure";

/** Longest public reply a merchant can post under a review (also a database CHECK). */
export const MERCHANT_REPLY_MAX_LENGTH = 1000;

export type MerchantOutletStatus = "open" | "closed" | "live" | "offline";

export type MerchantProfileGap = {
  id: string;
  label: string;
};

export type PromotionPricing = {
  originalPrice?: number;
  finalPrice?: number;
  discountPercentage?: number;
  label: string;
};

const BUSINESS_TYPE_LABELS: Record<MerchantOutlet["businessType"], string> = {
  cafe: "Cafe",
  food_court_stall: "Food Court Stall",
  hawker_stall: "Hawker Stall",
  home_based: "Home-Based Business",
  mall_tenant: "Mall Tenant",
  restaurant: "Restaurant",
};

function hasText(value?: string): boolean {
  return Boolean(value?.trim());
}

function hasContact(outlet: MerchantOutlet): boolean {
  return hasText(outlet.contactEmail) || hasText(outlet.contactPhone);
}

/** A floor on its own does not tell diners where the stall is. */
function hasLocation(outlet: MerchantOutlet): boolean {
  return hasText(outlet.buildingId) || hasText(outlet.unitNumber);
}

export function formatBusinessType(value: MerchantOutlet["businessType"]): string {
  return BUSINESS_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}

/**
 * "open"/"closed" come from the opening hours in Singapore time (the weekly schedule with special
 * hours when set, else readable listed hours). "live" means live on Hungry with hours we cannot
 * read, so the badge never claims "Open now" without hours.
 */
export function getMerchantOutletStatus(
  outlet?: MerchantOutlet | null,
  now: Date = new Date(),
): MerchantOutletStatus {
  if (!outlet || !outlet.isLive) return "offline";
  if (hasText(outlet.temporaryClosure) || isClosureActive(outlet.closedUntil, now)) return "closed";
  const state = hasWeeklyHours(outlet.openingSchedule)
    ? getScheduleOpenState(outlet.openingSchedule, true, now)
    : getVenueOpenState(outlet.operatingHours, true, now);
  return state.status === "unknown" ? "live" : state.status;
}

export function getMerchantOutletStatusLabel(status: MerchantOutletStatus): string {
  if (status === "open") return "Open now";
  if (status === "live") return "Live on Hungry";
  if (status === "offline") return "Offline";
  return "Closed";
}

export type VerificationStatusInfo = {
  /** Short word for a settings row. */
  label: string;
  /** Sentence for the profile header. */
  profileLabel: string;
  /** What the merchant can do next; empty when nothing is needed. */
  nextStep: string;
};

/** Each verification status says what it is and what to do, instead of one shared "Pending". */
export function getVerificationStatusInfo(
  verification: Pick<MerchantVerification, "status" | "expiresAt"> | undefined,
  now: Date = new Date(),
): VerificationStatusInfo {
  const status = verification?.status ?? "not_started";
  if (status === "verified") {
    return isVerificationCurrent(verification, now)
      ? { label: "Verified", profileLabel: "Verified Merchant", nextStep: "" }
      : {
          label: "Expired",
          profileLabel: "Verification expired",
          nextStep: "Resubmit your evidence in Verification to be verified again.",
        };
  }
  switch (status) {
    case "draft":
      return {
        label: "Not submitted",
        profileLabel: "Verification not submitted",
        nextStep: "Finish and submit your evidence in Verification.",
      };
    case "submitted":
      return {
        label: "Submitted",
        profileLabel: "Verification submitted",
        nextStep: "Hungry will review it. There is nothing to do yet.",
      };
    case "in_review":
      return {
        label: "In review",
        profileLabel: "Verification in review",
        nextStep: "Hungry is reviewing it. There is nothing to do yet.",
      };
    case "rejected":
      return {
        label: "Rejected",
        profileLabel: "Verification rejected",
        nextStep: "Open Verification to see why and resubmit.",
      };
    case "more_info_needed":
      return {
        label: "More info needed",
        profileLabel: "More info needed for verification",
        nextStep: "Open Verification to see what to add, then resubmit.",
      };
    default:
      return {
        label: "Not started",
        profileLabel: "Not verified yet",
        nextStep: "Open Verification to start.",
      };
  }
}

export function getMerchantProfileGaps(
  outlet: MerchantOutlet,
  menu: Pick<MerchantDashboardSummary, "menuCount" | "dishesWithoutImages">,
  /**
   * False while the outlet comes from the cached account restored at launch: contact details
   * are never persisted, so a missing phone/email then means "not loaded", not "not set".
   */
  options: { contactKnown?: boolean } = {},
): MerchantProfileGap[] {
  const gaps: MerchantProfileGap[] = [];

  if (!hasText(outlet.name)) gaps.push({ id: "name", label: "Stall/outlet name" });
  if (!outlet.businessType) gaps.push({ id: "business-type", label: "Business type" });
  if (!hasText(outlet.description)) gaps.push({ id: "description", label: "Description" });
  if (!hasText(outlet.profilePhotoUrl))
    gaps.push({ id: "profile-image", label: "Profile image/logo" });
  if (!hasText(outlet.coverPhotoUrl)) gaps.push({ id: "cover-image", label: "Cover image" });
  if (!hasLocation(outlet)) gaps.push({ id: "location", label: "Location/address" });
  if ((options.contactKnown ?? true) && !hasContact(outlet))
    gaps.push({ id: "contact", label: "Contact information" });
  if (!hasText(outlet.operatingHours) && !hasWeeklyHours(outlet.openingSchedule))
    gaps.push({ id: "opening-hours", label: "Opening hours" });
  if (menu.menuCount === 0) gaps.push({ id: "menu-items", label: "Menu items" });
  if (menu.menuCount > 0 && menu.dishesWithoutImages > 0) {
    gaps.push({ id: "dish-images", label: "Dish images" });
  }

  return gaps;
}

export function getUnrepliedReviews(interactions: CustomerInteraction[]): CustomerInteraction[] {
  return interactions.filter((interaction) => interaction.type === "review" && !interaction.reply);
}

export function getAverageRatingFromReviews(interactions: CustomerInteraction[]): number {
  const ratings = interactions
    .filter((interaction) => interaction.type === "review")
    .map((interaction) => interaction.rating)
    .filter((rating): rating is number => typeof rating === "number");
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

/** Hour of day (0-23, Singapore time from the analytics RPC) as "12 AM", "9 AM", "12 PM", "3 PM". */
export function formatPeakHour(hour: number): string {
  const normalized = ((Math.trunc(hour) % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const twelveHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${twelveHour} ${suffix}`;
}

export type MetricTrend = "up" | "down" | "flat";

/** Real period-over-period change for a dashboard metric, e.g. "+12%" and "up". */
export function getMetricDelta(
  current: number,
  previous: number,
): { label: string; trend: MetricTrend } {
  if (previous <= 0) {
    return current > 0 ? { label: "New", trend: "up" } : { label: "0%", trend: "flat" };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { label: `+${change}%`, trend: "up" };
  if (change < 0) return { label: `${change}%`, trend: "down" };
  return { label: "0%", trend: "flat" };
}

/** Rating tile value: a stall with no reviews in the range has no rating, not a 0.0 one. */
export function formatAverageRating(average: number, reviewCount: number): string {
  return reviewCount > 0 ? average.toFixed(1) : "–";
}

/**
 * Subtext under the rating: "No reviews yet" or the count for the range. Pass `zeroLabel` where
 * the stall may have older reviews (a weekly summary next to an all-time unreplied count).
 */
export function formatReviewCountLabel(
  reviewCount: number,
  rangeLabel: string,
  options: { zeroLabel?: string } = {},
): string {
  if (reviewCount <= 0) return options.zeroLabel ?? "No reviews yet";
  return `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"} ${rangeLabel}`;
}

/**
 * A Singapore number as "+65 9123 4567". The 8 digits may arrive with or without +65 or spaces;
 * anything that is not a Singapore number is shown as typed.
 */
export function formatContactPhone(phone?: string | null): string {
  const text = phone?.trim() ?? "";
  const digits = text.replace(/[\s-]/g, "").replace(/^\+?65(?=\d{8}$)/, "");
  return /^[3689]\d{7}$/.test(digits) ? `+65 ${digits.slice(0, 4)} ${digits.slice(4)}` : text;
}

/**
 * Rating change in stars ("+0.2"), not a percentage; a rating has no percent scale. The screen
 * draws the star symbol after a number.
 */
export function formatRatingChange(
  current: number,
  previous: number,
  currentCount: number,
  previousCount: number,
): string {
  if (currentCount <= 0) return "No reviews yet";
  if (previousCount <= 0) return "New";
  const change = Math.round((current - previous) * 10) / 10;
  if (change > 0) return `+${change.toFixed(1)}`;
  if (change < 0) return `-${Math.abs(change).toFixed(1)}`;
  return "0.0";
}

export function resolvePromotionRuntimeStatus(
  promotion: Pick<MerchantPromotion, "startDate" | "endDate" | "status">,
  now = new Date(),
): MerchantPromotion["status"] {
  // "End now" stores status "ended" with the old end date, which can still be in the future.
  if (promotion.status === "draft" || promotion.status === "ended") return promotion.status;
  const startsAt = new Date(promotion.startDate).getTime();
  const endsAt = new Date(promotion.endDate).getTime();
  const nowMs = now.getTime();
  if (Number.isFinite(endsAt) && endsAt < nowMs) return "ended";
  if (Number.isFinite(startsAt) && startsAt > nowMs) return "scheduled";
  return "active";
}

export function getPromotionPricing(
  promotion: Pick<
    MerchantPromotion,
    "discountPercentage" | "finalPrice" | "originalPrice" | "promotionalPrice"
  >,
): PromotionPricing {
  const originalPrice = promotion.originalPrice;
  const finalPrice = promotion.finalPrice ?? promotion.promotionalPrice;
  const discountPercentage =
    promotion.discountPercentage ??
    (typeof originalPrice === "number" && typeof finalPrice === "number" && originalPrice > 0
      ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
      : undefined);

  if (typeof originalPrice === "number" && typeof finalPrice === "number") {
    return {
      originalPrice,
      finalPrice,
      discountPercentage,
      label: `S$${originalPrice.toFixed(2)} → S$${finalPrice.toFixed(2)}`,
    };
  }

  if (typeof discountPercentage === "number" && discountPercentage > 0) {
    return { discountPercentage, label: `${discountPercentage}% off` };
  }

  // No price row: callers hide it rather than show merchant-facing filler to diners.
  return { label: "" };
}
