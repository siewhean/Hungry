import * as Sentry from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppText } from "@/components/ui";
import { HungryThemeProvider, useHungryTheme } from "@/theme";
import { AppBody } from "@/app/AppBody";
import { sanitizeSentryEvent } from "@/lib/analytics/privacy";

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
  });
  sentryInitialized = true;
  globalForSentry.__hungrySentryInitialized = true;
}

function SentryFallback() {
  // Use hardcoded safe values and native Text in fallback to avoid crashing if provider fails
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: "600",
          marginBottom: 8,
          textAlign: "center",
          color: "#1A2E44",
        }}
      >
        Something went wrong
      </Text>
      <Text style={{ fontSize: 16, textAlign: "center", color: "#41566F" }}>
        The app hit an unexpected error. Please restart and try again.
      </Text>
    </View>
  );
}

function AppContent() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HungryThemeProvider>
          {shouldEnableSentry ? (
            <Sentry.ErrorBoundary fallback={<SentryFallback />}>
              <AppBody />
            </Sentry.ErrorBoundary>
          ) : (
            <AppBody />
          )}
        </HungryThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default shouldEnableSentry ? Sentry.wrap(AppContent) : AppContent;
