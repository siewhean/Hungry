import { trackAnalyticsEvent } from "@/lib/analytics";

export type AuthFunnelScreen =
  | "login"
  | "sign_up"
  | "forgot_password"
  | "reset_password"
  | "email_verification"
  | "email_change"
  | "onboarding_auth";

export type AuthFunnelFlow =
  | "sign_in"
  | "sign_up"
  | "password_reset"
  | "email_confirm"
  | "email_code";

export function trackAuthScreenViewed(screen: AuthFunnelScreen) {
  trackAnalyticsEvent("auth_screen_viewed", { screen });
}

/**
 * Records why an auth attempt failed: a Supabase error code, "cancelled" or "unknown".
 * `screen` says where, so a failure can be set against that screen's views.
 */
export function trackAuthFailed(
  flow: AuthFunnelFlow,
  method: string,
  error: unknown,
  screen?: AuthFunnelScreen,
) {
  const code =
    (error as { error_code?: string; code?: string })?.error_code ??
    (error as { error_code?: string; code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? "").toLowerCase();
  const reason = message.includes("cancelled") ? "cancelled" : (code ?? "unknown");
  trackAnalyticsEvent(
    "auth_failed",
    screen ? { flow, method, reason, screen } : { flow, method, reason },
  );
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

/** A password sign-in was submitted (the denominator for sign_in_completed and auth_failed). */
export function trackSignInSubmitted(screen: AuthFunnelScreen, method: string) {
  trackAnalyticsEvent("sign_in_submitted", { screen, method });
}

/** The new password was saved at the end of a reset. */
export function trackPasswordResetCompleted() {
  trackAnalyticsEvent("password_reset_completed", {});
}

/** A new sign-up confirmation email was requested from the verify screen. */
export function trackVerificationEmailResent() {
  trackAnalyticsEvent("verification_email_resent", {});
}

/** A sign-in code was emailed (`resend` for a second or later send). */
export function trackEmailCodeRequested(screen: AuthFunnelScreen, resend: boolean) {
  trackAnalyticsEvent("email_code_requested", { screen, resend });
}

/**
 * An 8-digit code was submitted. `auto` is true when the field submitted it itself on the
 * eighth digit; `paste` when those digits arrived in one change (paste or autofill).
 */
export function trackEmailCodeSubmitted(
  screen: AuthFunnelScreen,
  options: { auto: boolean; paste: boolean },
) {
  trackAnalyticsEvent("email_code_submitted", { screen, ...options });
}
