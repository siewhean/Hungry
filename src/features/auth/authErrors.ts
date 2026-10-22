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

/** The offline / too-many-attempts message for an error, or `fallback` for anything else. */
export function getAuthFailureMessage(error: unknown, fallback: string): string {
  const kind = getAuthErrorKind(error);
  if (kind === "offline") return AUTH_OFFLINE_MESSAGE;
  if (kind === "rate_limited") return AUTH_RATE_LIMITED_MESSAGE;
  return fallback;
}
