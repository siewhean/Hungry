import { trackAnalyticsEvent } from "@/lib/analytics";

export type AuthFunnelScreen =
  | "login"
  | "sign_up"
  | "forgot_password"
  | "reset_password"
  | "email_verification"
  | "email_change"
  | "onboarding_auth";

export type AuthFunnelFlow = "sign_in" | "sign_up" | "password_reset" | "email_confirm";

export function trackAuthScreenViewed(screen: AuthFunnelScreen) {
  trackAnalyticsEvent("auth_screen_viewed", { screen });
}

/** Records why an auth attempt failed: a Supabase error code, "cancelled" or "unknown". */
export function trackAuthFailed(flow: AuthFunnelFlow, method: string, error: unknown) {
  const code =
    (error as { error_code?: string; code?: string })?.error_code ??
    (error as { error_code?: string; code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? "").toLowerCase();
  const reason = message.includes("cancelled") ? "cancelled" : (code ?? "unknown");
  trackAnalyticsEvent("auth_failed", { flow, method, reason });
}

export function trackGuestContinued(screen: AuthFunnelScreen) {
  trackAnalyticsEvent("auth_guest_continued", { screen });
}

/**
 * The sign-up form was accepted and a confirmation email is on its way (or, with
 * auto-confirm, the account is live). Leading metric for sign-up tests, before the email
 * step can hide an effect.
 */
export function trackSignUpSubmitted(screen: AuthFunnelScreen, method: string) {
  trackAnalyticsEvent("sign_up_submitted", { screen, method });
}

/** The sign-up email was confirmed in the app, by the 8-digit code or the link. */
export function trackEmailVerified(via: "code" | "link") {
  trackAnalyticsEvent("email_verified", { via });
}

export function trackPasswordResetRequested() {
  trackAnalyticsEvent("password_reset_requested", {});
}
