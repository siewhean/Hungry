/**
 * Merchant access gate — determines what a merchant can and cannot do
 * based on their verification status and feature flag state.
 */

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { VerificationStatus } from "@/types/domain";

export type MerchantAccessLevel = "none" | "unverified" | "verified";

/**
 * Resolve the merchant access level from current state.
 * - "none": feature disabled or no merchant account
 * - "unverified": merchant exists but not verified
 * - "verified": merchant is verified — full access
 */
export function resolveMerchantAccess(
  isMerchant: boolean,
  verificationStatus: VerificationStatus | undefined,
): MerchantAccessLevel {
  if (!FEATURE_FLAGS.merchantCentreEnabled) return "none";
  if (!isMerchant) return "none";
  if (verificationStatus === "verified") return "verified";
  return "unverified";
}

// ─── Permission checks ───────────────────────────────────────────────────────

/** Can the merchant view the full Merchant Centre dashboard? */
export function canAccessDashboard(level: MerchantAccessLevel): boolean {
  return level === "verified";
}

/** Can the merchant edit their business profile? */
export function canEditProfile(level: MerchantAccessLevel): boolean {
  return level === "verified";
}

/** Can the merchant manage menu/dishes? */
export function canManageMenu(level: MerchantAccessLevel): boolean {
  return level === "verified";
}

/** Can the merchant publish promotions? */
export function canPublishPromotions(level: MerchantAccessLevel): boolean {
  return level === "verified";
}

/** Can the merchant reply to reviews/comments as the business? */
export function canReplyAsBusiness(level: MerchantAccessLevel): boolean {
  return level === "verified";
}

/** @deprecated Use canReplyAsBusiness */
export const canReplyAsBusinesss = canReplyAsBusiness;

/** Can the merchant view analytics? */
export function canViewAnalytics(level: MerchantAccessLevel): boolean {
  return level === "verified";
}

/** Can the merchant access verification flow? (even unverified can) */
export function canAccessVerification(level: MerchantAccessLevel): boolean {
  return level === "unverified" || level === "verified";
}

/** Can the merchant view limited onboarding? */
export function canViewOnboarding(level: MerchantAccessLevel): boolean {
  return level === "unverified";
}

/**
 * Actions available for unverified merchants:
 * - Start verification
 * - View verification status
 * - Submit/resubmit evidence
 * - View limited onboarding instructions
 */
export const UNVERIFIED_ALLOWED_SCREENS = ["VerificationCentre", "HomeBasedVerification"] as const;

/**
 * Actions blocked for unverified merchants:
 * - Edit live stall/business details
 * - Publish promotions
 * - Reply publicly as the business
 * - Access full merchant analytics
 * - Access advanced merchant settings
 */
export const VERIFIED_ONLY_SCREENS = [
  "Dashboard",
  "Menu",
  "Profile",
  "DishEditor",
  "OCRDrafts",
  "CustomerInbox",
  "FeaturedVisitors",
  "PromotionBuilder",
  "PromotionList",
  "AIAssistant",
  "BusinessProfileEditor",
  "OrdersComingSoon",
  "MerchantSettings",
  "Analytics",
] as const;
