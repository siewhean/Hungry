import type { UserProfile } from "@/types/domain";

/**
 * An account older than this was not made by the code that has just been entered. A new
 * account's profile row is written moments before its first sign-in, so the margin only has
 * to cover a slow inbox.
 */
export const RETURNING_ACCOUNT_MIN_AGE_MS = 10 * 60 * 1000;

/**
 * Create account and Sign in share one emailed-code form, so "Create account" with an address
 * that already has an account signs that account in. The name typed on the form is dropped (an
 * existing account keeps its own), which would look like a new account without a greeting.
 */
export function isReturningAccount(
  profile: Pick<UserProfile, "createdAt">,
  now: number = Date.now(),
): boolean {
  const createdAt = profile.createdAt ? Date.parse(profile.createdAt) : Number.NaN;
  return Number.isFinite(createdAt) && now - createdAt > RETURNING_ACCOUNT_MIN_AGE_MS;
}
