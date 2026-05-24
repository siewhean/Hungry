import type {
  CustomerInteraction,
  DishDetail,
  MerchantAnalytics,
  MerchantOutlet,
  MerchantPromotion,
} from "@/types/domain";

export type MerchantOutletStatus = "open" | "closed" | "offline";

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

function hasLocation(outlet: MerchantOutlet): boolean {
  return hasText(outlet.buildingId) || hasText(outlet.unitNumber) || hasText(outlet.floor);
}

function menuHasDishImages(menu: DishDetail[]): boolean {
  if (menu.length === 0) return false;
  return menu.every((dish) => hasText(dish.imageUrl) || (dish.gallery ?? []).some(hasText));
}

export function formatBusinessType(value: MerchantOutlet["businessType"]): string {
  return BUSINESS_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}

export function getMerchantOutletStatus(outlet?: MerchantOutlet | null): MerchantOutletStatus {
  if (!outlet || !outlet.isLive) return "offline";
  if (hasText(outlet.temporaryClosure)) return "closed";
  return "open";
}

export function getMerchantOutletStatusLabel(status: MerchantOutletStatus): string {
  if (status === "open") return "Open";
  if (status === "offline") return "Offline";
  return "Closed";
}

export function getMerchantProfileGaps(
  outlet: MerchantOutlet,
  menu: DishDetail[],
): MerchantProfileGap[] {
  const gaps: MerchantProfileGap[] = [];

  if (!hasText(outlet.name)) gaps.push({ id: "name", label: "Stall/outlet name" });
  if (!outlet.businessType) gaps.push({ id: "business-type", label: "Business type" });
  if (!hasText(outlet.description)) gaps.push({ id: "description", label: "Description" });
  if (!hasText(outlet.profilePhotoUrl))
    gaps.push({ id: "profile-image", label: "Profile image/logo" });
  if (!hasText(outlet.coverPhotoUrl)) gaps.push({ id: "cover-image", label: "Cover image" });
  if (!hasLocation(outlet)) gaps.push({ id: "location", label: "Location/address" });
  if (!hasContact(outlet)) gaps.push({ id: "contact", label: "Contact information" });
  if (!hasText(outlet.operatingHours)) gaps.push({ id: "opening-hours", label: "Opening hours" });
  if (menu.length === 0) gaps.push({ id: "menu-items", label: "Menu items" });
  if (menu.length > 0 && !menuHasDishImages(menu)) {
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

export function buildMerchantDashboardMetrics(
  analytics: MerchantAnalytics,
  interactions: CustomerInteraction[],
): MerchantAnalytics {
  const reviewRatings = interactions
    .filter((interaction) => interaction.type === "review")
    .map((interaction) => interaction.rating)
    .filter((rating): rating is number => typeof rating === "number");

  return {
    ...analytics,
    averageRating:
      reviewRatings.length > 0
        ? reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length
        : analytics.averageRating,
    reviewCount: reviewRatings.length || analytics.reviewCount,
  };
}

export function resolvePromotionRuntimeStatus(
  promotion: Pick<MerchantPromotion, "startDate" | "endDate" | "status">,
  now = new Date(),
): MerchantPromotion["status"] {
  if (promotion.status === "draft") return "draft";
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
      label: `S$${originalPrice.toFixed(2)} -> S$${finalPrice.toFixed(2)}`,
    };
  }

  if (typeof discountPercentage === "number" && discountPercentage > 0) {
    return { discountPercentage, label: `${discountPercentage}% off` };
  }

  return { label: "No price change set" };
}
