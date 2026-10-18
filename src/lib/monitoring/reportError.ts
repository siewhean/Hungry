import * as Sentry from "@sentry/react-native";

// Sentry is only initialised in App.tsx when a DSN is configured.
const sentryEnabled = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);

export type ErrorReportContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Report an unexpected error. Sends it to Sentry when Sentry is enabled and logs it in
 * development builds. Never throws.
 */
export function reportError(error: unknown, context: ErrorReportContext = {}): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.error("[reportError]", error, context);
  }

  if (!sentryEnabled) {
    return;
  }

  try {
    Sentry.captureException(error, { extra: context });
  } catch {
    // Reporting must never crash the caller.
  }
}
