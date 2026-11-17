import type { MerchantPromotion } from "@/types/domain";

import { resolvePromotionRuntimeStatus } from "./merchantReadiness";

export function isCustomerVisiblePromotion(promotion: MerchantPromotion, now = new Date()) {
  return (
    promotion.status !== "ended" &&
    promotion.isAvailable !== false &&
    resolvePromotionRuntimeStatus(promotion, now) === "active"
  );
}

export function filterCustomerVisiblePromotions(
  promotions: MerchantPromotion[],
  input: { dishId?: string; now?: Date } = {},
) {
  return promotions.filter((promotion) => {
    if (!isCustomerVisiblePromotion(promotion, input.now)) return false;
    return !promotion.targetDishId || !input.dishId || promotion.targetDishId === input.dishId;
  });
}
