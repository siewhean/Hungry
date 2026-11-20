import { FEATURE_FLAGS, type AppEnvironment } from "@/constants/featureFlags";

/**
 * Tags every PostHog event with where it came from, so launch numbers can leave out the team's
 * own testing (audit ANA-2, package 0.6). The PostHog side filters on `is_internal` not being
 * true ("filter out internal and test users") and on `environment = production`.
 */

/** Staging test diners are created with an address on this domain (scripts/seed). */
export const INTERNAL_EMAIL_DOMAIN = "internal.hungry.test";

export function getAnalyticsEnvironment(): AppEnvironment {
  return FEATURE_FLAGS.appEnv;
}

/**
 * True for traffic that is never a real diner: any build that is not the production app, and a
 * production build made for the team (EXPO_PUBLIC_INTERNAL_BUILD=1, for example TestFlight
 * internal testing).
 */
export function isInternalBuild(
  environment: AppEnvironment = getAnalyticsEnvironment(),
  internalBuildFlag: string | undefined = process.env.EXPO_PUBLIC_INTERNAL_BUILD,
): boolean {
  return environment !== "production" || internalBuildFlag?.trim() === "1";
}

export function isInternalAccountEmail(email: string | null | undefined): boolean {
  return Boolean(email) && email!.trim().toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}
