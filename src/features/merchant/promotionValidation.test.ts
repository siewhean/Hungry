import assert from "node:assert/strict";
import test from "node:test";

import {
  promotionBoundaryToDateOnly,
  toSingaporeDateOnly,
  toSingaporePromotionBoundary,
  validateMerchantPromotionInput,
} from "./promotionValidation";
import type { MerchantPromotion } from "@/types/domain";

type PromotionDraft = Omit<MerchantPromotion, "id" | "outletId" | "createdAt" | "analytics">;

const basePromotion: PromotionDraft = {
  title: "Lunch set",
  description: "Valid for the lunch menu.",
  targetDishId: "dish-1",
  promotionItemType: "existing_menu_item",
  startDate: "2026-05-25",
  endDate: "2026-05-31",
  originalPrice: 8,
  promotionalPrice: 6,
  finalPrice: 6,
  discountPercentage: 25,
  isAvailable: true,
  targetAudience: ["nearby_users"],
  status: "active",
};

test("validateMerchantPromotionInput normalizes a valid existing-item promotion", () => {
  const result = validateMerchantPromotionInput(
    {
      ...basePromotion,
      title: "  Lunch set  ",
      description: "  Valid for the lunch menu.  ",
    },
    { outletDishIds: ["dish-1"] },
  );

  assert.equal(result.title, "Lunch set");
  assert.equal(result.description, "Valid for the lunch menu.");
  // Date-only promotions run on Singapore calendar days (UTC+8).
  assert.equal(result.startDate, "2026-05-24T16:00:00.000Z");
  assert.equal(result.endDate, "2026-05-31T15:59:59.000Z");
});

test("Singapore date helpers keep the local calendar day before 8am SGT", () => {
  // 2026-05-25 07:30 SGT is still 2026-05-24 in UTC.
  assert.equal(toSingaporeDateOnly(new Date("2026-05-24T23:30:00Z")), "2026-05-25");
  assert.equal(toSingaporeDateOnly("2026-05-24T16:00:00.000Z"), "2026-05-25");
  assert.equal(toSingaporePromotionBoundary("2026-05-25", "start"), "2026-05-25T00:00:00+08:00");
  assert.equal(toSingaporePromotionBoundary("2026-05-25", "end"), "2026-05-25T23:59:59+08:00");
});

test("promotionBoundaryToDateOnly keeps legacy UTC day boundaries on their day", () => {
  assert.equal(promotionBoundaryToDateOnly("2026-05-31T23:59:59.000Z", "end"), "2026-05-31");
  assert.equal(promotionBoundaryToDateOnly("2026-05-31T23:59:59+00:00", "end"), "2026-05-31");
  assert.equal(promotionBoundaryToDateOnly("2026-05-25T00:00:00Z", "start"), "2026-05-25");
  // New Singapore boundaries, as Postgres returns them in UTC.
  assert.equal(promotionBoundaryToDateOnly("2026-05-31T15:59:59+00:00", "end"), "2026-05-31");
  assert.equal(promotionBoundaryToDateOnly("2026-05-24T16:00:00+00:00", "start"), "2026-05-25");
  assert.equal(
    promotionBoundaryToDateOnly(toSingaporePromotionBoundary("2026-05-31", "end"), "end"),
    "2026-05-31",
  );
});

test("validateMerchantPromotionInput accepts timezone-qualified datetimes only", () => {
  const result = validateMerchantPromotionInput({
    ...basePromotion,
    startDate: "2026-05-25T11:30:00+08:00",
    endDate: "2026-05-31T14:00:00+08:00",
  });

  assert.equal(result.startDate, "2026-05-25T03:30:00.000Z");
  assert.equal(result.endDate, "2026-05-31T06:00:00.000Z");
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        startDate: "2026-05-25T11:30:00",
      }),
    /timezone/,
  );
});

test("validateMerchantPromotionInput rejects invalid promotion rules", () => {
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        targetDishId: undefined,
      }),
    /selected dish/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        endDate: "2026-05-24",
      }),
    /after the start date/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        discountPercentage: 150,
      }),
    /between 0 and 100/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        promotionalPrice: 9,
        finalPrice: 9,
      }),
    /higher than the original price/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        startDate: "2026-02-31",
      }),
    /calendar/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        startDate: "May 25, 2026",
      }),
    /YYYY-MM-DD/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput(
        {
          ...basePromotion,
          targetDishId: "dish-other-outlet",
        },
        { outletDishIds: ["dish-1"] },
      ),
    /this outlet/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        originalPrice: 0,
        promotionalPrice: 1,
        finalPrice: 1,
      }),
    /higher than the original price/,
  );
  assert.throws(
    () =>
      validateMerchantPromotionInput({
        ...basePromotion,
        isAvailable: false,
      }),
    /must be marked available/,
  );
});
