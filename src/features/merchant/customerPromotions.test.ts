import test from "node:test";
import assert from "node:assert/strict";

import { filterCustomerVisiblePromotions, isCustomerVisiblePromotion } from "./customerPromotions";
import type { MerchantPromotion } from "@/types/domain";

const basePromotion: MerchantPromotion = {
  id: "promo-active",
  outletId: "outlet-1",
  title: "Lunch offer",
  description: "A real active promotion.",
  startDate: "2026-06-01T00:00:00Z",
  endDate: "2026-06-30T23:59:59Z",
  targetAudience: ["nearby_users"],
  status: "active",
  isAvailable: true,
  createdAt: "2026-06-01T00:00:00Z",
};

test("isCustomerVisiblePromotion only allows available active-window promotions", () => {
  const now = new Date("2026-06-07T12:00:00Z");

  assert.equal(isCustomerVisiblePromotion(basePromotion, now), true);
  assert.equal(isCustomerVisiblePromotion({ ...basePromotion, isAvailable: false }, now), false);
  assert.equal(
    isCustomerVisiblePromotion({ ...basePromotion, startDate: "2026-07-01T00:00:00Z" }, now),
    false,
  );
  assert.equal(
    isCustomerVisiblePromotion({ ...basePromotion, endDate: "2026-06-01T00:00:00Z" }, now),
    false,
  );
  assert.equal(isCustomerVisiblePromotion({ ...basePromotion, status: "draft" }, now), false);
});

test("filterCustomerVisiblePromotions keeps outlet-level and matching dish offers only", () => {
  const now = new Date("2026-06-07T12:00:00Z");
  const promotions = [
    basePromotion,
    { ...basePromotion, id: "promo-dish", targetDishId: "dish-1" },
    { ...basePromotion, id: "promo-other-dish", targetDishId: "dish-2" },
    { ...basePromotion, id: "promo-ended", status: "ended" as const },
  ];

  assert.deepEqual(
    filterCustomerVisiblePromotions(promotions, { dishId: "dish-1", now }).map((promo) => promo.id),
    ["promo-active", "promo-dish"],
  );
});
