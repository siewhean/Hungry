import { reportError } from "@/lib/monitoring/reportError";

import { setAnalyticsEnabled } from "./mockAnalytics";

/**
 * Applies the "Share usage analytics" setting: stops (or resumes) our own event tracking and
 * tells PostHog to stop capturing, including its app-lifecycle events. Crash reports are
 * separate and keep going.
 */
export function applyAnalyticsPreference(enabled: boolean): void {
  setAnalyticsEnabled(enabled);
  try {
    // Loaded here, not at the top, so the PostHog SDK is only touched when the setting changes.
    const { setPostHogOptOut } = require("./posthogSink") as typeof import("./posthogSink");
    setPostHogOptOut(!enabled);
  } catch (error) {
    reportError(error, { area: "analytics_preference" });
  }
}
