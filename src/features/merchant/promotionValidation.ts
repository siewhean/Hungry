import type { MerchantPromotion } from "@/types/domain";

const MAX_PROMOTION_TITLE_LENGTH = 80;
const MAX_PROMOTION_DESCRIPTION_LENGTH = 600;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_WITH_ZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const DISCOUNT_TOLERANCE_PERCENT = 1;
// Promotions run on Singapore calendar days (UTC+8, no DST).
const SINGAPORE_OFFSET = "+08:00";
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

/** YYYY-MM-DD of the given instant in Asia/Singapore. */
export function toSingaporeDateOnly(value: Date | string = new Date()): string {
  const instant = typeof value === "string" ? new Date(value) : value;
  return new Date(instant.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10);
}

/** Inclusive Singapore-day boundary for a YYYY-MM-DD promotion date. */
export function toSingaporePromotionBoundary(date: string, boundary: "start" | "end"): string {
  return `${date}T${boundary === "start" ? "00:00:00" : "23:59:59"}${SINGAPORE_OFFSET}`;
}

type PromotionDraft = Omit<MerchantPromotion, "id" | "outletId" | "createdAt" | "analytics">;

interface PromotionValidationOptions {
  outletDishIds?: readonly string[];
}

function normalizeText(value: string | undefined): string | undefined {
  return typeof value === "string" ? value.trim() : value;
}

function assertValidCalendarDate(value: string): void {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Promotion dates must be valid calendar dates.");
  }
}

function parsePromotionDate(value: string, boundary: "start" | "end"): Date {
  if (DATE_ONLY_PATTERN.test(value)) {
    assertValidCalendarDate(value);
    return new Date(toSingaporePromotionBoundary(value, boundary));
  }

  if (!ISO_DATE_TIME_WITH_ZONE_PATTERN.test(value)) {
    throw new Error("Promotion dates must use YYYY-MM-DD or ISO datetimes with a timezone.");
  }

  assertValidCalendarDate(value.slice(0, 10));
  const isoValue = value;
  const parsed = new Date(isoValue);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Promotion dates must be valid ISO datetimes.");
  }
  return parsed;
}

function assertNonNegative(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
}

export function validateMerchantPromotionInput(
  input: PromotionDraft,
  options: PromotionValidationOptions = {},
): PromotionDraft {
  const title = normalizeText(input.title) ?? "";
  const description = normalizeText(input.description) ?? "";
  const targetDishId = normalizeText(input.targetDishId);
  const promotionItemType = input.promotionItemType ?? "new_item";
  const originalPrice = input.originalPrice;
  const promotionalPrice = input.promotionalPrice;
  const finalPrice = input.finalPrice ?? promotionalPrice ?? originalPrice;
  const discountPercentage = input.discountPercentage;
  const isAvailable = input.isAvailable ?? input.status === "active";

  if (!title) throw new Error("Promotion title is required.");
  if (title.length > MAX_PROMOTION_TITLE_LENGTH) {
    throw new Error(`Promotion title must be at most ${MAX_PROMOTION_TITLE_LENGTH} characters.`);
  }
  if (!description) throw new Error("Promotion description is required.");
  if (description.length > MAX_PROMOTION_DESCRIPTION_LENGTH) {
    throw new Error(
      `Promotion description must be at most ${MAX_PROMOTION_DESCRIPTION_LENGTH} characters.`,
    );
  }

  const startAt = parsePromotionDate(input.startDate, "start");
  const endAt = parsePromotionDate(input.endDate, "end");
  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error("Promotion end date must be after the start date.");
  }

  assertNonNegative(originalPrice, "Original price");
  assertNonNegative(promotionalPrice, "Promotional price");
  assertNonNegative(finalPrice, "Final price");

  if (
    discountPercentage !== undefined &&
    (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100)
  ) {
    throw new Error("Discount percentage must be between 0 and 100.");
  }

  if (promotionItemType === "existing_menu_item" && !targetDishId) {
    throw new Error("Existing menu item promotions require a selected dish.");
  }
  if (
    promotionItemType === "existing_menu_item" &&
    targetDishId &&
    options.outletDishIds &&
    !options.outletDishIds.includes(targetDishId)
  ) {
    throw new Error("Existing menu item promotions must target a dish from this outlet.");
  }

  if (input.status === "active" && !isAvailable) {
    throw new Error("Active promotions must be marked available.");
  }

  if (originalPrice !== undefined && finalPrice !== undefined && finalPrice > originalPrice) {
    throw new Error("Final price cannot be higher than the original price.");
  }

  if (
    originalPrice !== undefined &&
    finalPrice !== undefined &&
    discountPercentage !== undefined &&
    originalPrice > 0
  ) {
    const computedDiscount = ((originalPrice - finalPrice) / originalPrice) * 100;
    if (Math.abs(computedDiscount - discountPercentage) > DISCOUNT_TOLERANCE_PERCENT) {
      throw new Error("Discount percentage must match the original and final prices.");
    }
  }

  return {
    ...input,
    title,
    description,
    targetDishId,
    promotionItemType,
    originalPrice,
    promotionalPrice,
    finalPrice,
    discountPercentage,
    isAvailable,
    startDate: startAt.toISOString(),
    endDate: endAt.toISOString(),
    targetAudience: input.targetAudience,
  };
}
