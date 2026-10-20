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

/**
 * Can the merchant edit their business profile? Unverified merchants can prepare it: outlet edits
 * reach the diner venue only once the outlet is verified (app_private.sync_merchant_outlet_to_venue).
 */
export function canEditProfile(level: MerchantAccessLevel): boolean {
  return level === "unverified" || level === "verified";
}

/**
 * Can the merchant manage menu/dishes? Unverified merchants prepare drafts: the database keeps
 * them out of every diner read until the outlet is verified, and dishes diners already see stay
 * read-only until then (app_private.enforce_merchant_dish_draft_scope).
 */
export function canManageMenu(level: MerchantAccessLevel): boolean {
  return level === "unverified" || level === "verified";
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
 * - Prepare the stall profile and menu (hidden from diners until verified)
 * - Open Profile and Settings, which hold the "Switch to Customer Mode" and "Sign Out" exits
 */
export const UNVERIFIED_ALLOWED_SCREENS = [
  "VerificationCentre",
  "HomeBasedVerification",
  "Profile",
  "BusinessProfileEditor",
  "Menu",
  "DishEditor",
  "OCRDrafts",
  "MerchantSettings",
] as const;

/**
 * Actions blocked for unverified merchants:
 * - Edit live stall/business details, or dishes diners can already see
 * - Publish promotions
 * - Reply publicly as the business
 * - Access full merchant analytics
 */
export const VERIFIED_ONLY_SCREENS = [
  "Dashboard",
  "CustomerInbox",
  "FeaturedVisitors",
  "PromotionBuilder",
  "PromotionList",
  "AIAssistant",
  "Analytics",
] as const;
