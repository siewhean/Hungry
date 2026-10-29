import * as Sentry from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "@/components/ui/ErrorBoundary";
import { HungryThemeProvider, useHungryTheme } from "@/theme";
import { AppBody } from "@/app/AppBody";
import { isAnalyticsEnabled } from "@/lib/analytics";
import {
  isUsageBreadcrumb,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from "@/lib/analytics/privacy";

const appEnv =
  process.env.EXPO_PUBLIC_APP_ENV ??
  (typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production");
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const shouldEnableSentry = Boolean(sentryDsn);
const globalForSentry = globalThis as typeof globalThis & {
  __hungrySentryInitialized?: boolean;
};

let sentryInitialized = false;
if (shouldEnableSentry && !sentryInitialized && !globalForSentry.__hungrySentryInitialized) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    debug: typeof __DEV__ !== "undefined" ? __DEV__ : false,
    environment: appEnv,
    tracesSampleRate: appEnv === "production" ? 0.1 : 0,
    beforeSend: (event) => sanitizeSentryEvent(event),
    // Screens and taps are usage data: dropped while "Share usage analytics" is off.
    beforeBreadcrumb: (breadcrumb) =>
      !isAnalyticsEnabled() && isUsageBreadcrumb(breadcrumb)
        ? null
        : sanitizeSentryBreadcrumb(breadcrumb),
  });
  sentryInitialized = true;
  globalForSentry.__hungrySentryInitialized = true;
}

function AppContent() {
  return (
    // Always mounted, outside the providers so it also catches provider crashes.
    // It reports to Sentry through reportError when a DSN is set.
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <HungryThemeProvider>
            <AppBody />
          </HungryThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

export default shouldEnableSentry ? Sentry.wrap(AppContent) : AppContent;
