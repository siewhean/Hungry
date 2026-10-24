export type AuthErrorKind = "offline" | "rate_limited" | "other";

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
]);

export function getAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const { error_code: errorCode, code } = error as { error_code?: unknown; code?: unknown };
  if (typeof errorCode === "string") return errorCode;
  return typeof code === "string" ? code : undefined;
}

/**
 * Separates the failures a person can act on (no connection, too many tries) from the
 * rest, so every auth screen says "You're offline" instead of a generic failure.
 * supabase-js reports a dropped connection as AuthRetryableFetchError (status 0); React
 * Native's fetch rejects with a TypeError "Network request failed".
 */
export function getAuthErrorKind(error: unknown): AuthErrorKind {
  if (!error || typeof error !== "object") return "other";
  const { name, status, message } = error as {
    name?: unknown;
    status?: unknown;
    message?: unknown;
  };
  if (status === 429) return "rate_limited";
  const code = getAuthErrorCode(error);
  if (code && RATE_LIMIT_CODES.has(code)) return "rate_limited";
  if (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    (typeof message === "string" &&
      /network request failed|failed to fetch|network error/i.test(message))
  ) {
    return "offline";
  }
  return "other";
}

export const AUTH_OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";
export const AUTH_RATE_LIMITED_MESSAGE = "Too many attempts. Wait a minute, then try again.";
// Supabase caps auth emails per hour for the whole project (config.toml `email_sent`), so
// "wait a minute" is wrong for this one.
export const AUTH_EMAIL_RATE_LIMITED_MESSAGE =
  "We can't send another email right now. Please try again in a little while.";

/** The offline / too-many-attempts message for an error, or `fallback` for anything else. */
export function getAuthFailureMessage(error: unknown, fallback: string): string {
  const kind = getAuthErrorKind(error);
  if (kind === "offline") return AUTH_OFFLINE_MESSAGE;
  if (kind === "rate_limited") {
    return getAuthErrorCode(error) === "over_email_send_rate_limit"
      ? AUTH_EMAIL_RATE_LIMITED_MESSAGE
      : AUTH_RATE_LIMITED_MESSAGE;
  }
  return fallback;
}

// Answers a person can act on: wrong password, unconfirmed or taken email, a bad or old
// code, a weak password. They are not bugs, so they stay out of Sentry.
const EXPECTED_AUTH_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "email_exists",
  "email_address_invalid",
  "user_banned",
  "user_not_found",
  "weak_password",
  "same_password",
  "otp_expired",
  "flow_state_expired",
  "flow_state_not_found",
  "validation_failed",
  "reauthentication_needed",
  "reauthentication_not_valid",
]);

/**
 * True for an auth failure that should reach Sentry (rule 11): not offline, not rate
 * limited, not cancelled by the person, and not one of the expected answers above. A GoTrue
 * 500, a broken send-email hook (`email_hook_not_configured`) or a failed code exchange is.
 */
export function isUnexpectedAuthError(error: unknown): boolean {
  if (getAuthErrorKind(error) !== "other") return false;
  const code = getAuthErrorCode(error);
  if (code && EXPECTED_AUTH_CODES.has(code)) return false;
  const { name, message } = (error ?? {}) as { name?: unknown; message?: unknown };
  if (name === "AuthWeakPasswordError") return false;
  return !(typeof message === "string" && /cancel/i.test(message));
}
