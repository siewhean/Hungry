import * as Sentry from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppText } from "@/components/ui";
import { HungryThemeProvider, useHungryTheme } from "@/theme";
import { AppBody } from "@/app/AppBody";

const appEnv =
  process.env.EXPO_PUBLIC_APP_ENV ??
  (typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production");
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let sentryInitialized = false;
if (!sentryInitialized) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn),
    debug: typeof __DEV__ !== "undefined" ? __DEV__ : false,
    environment: appEnv,
    tracesSampleRate: appEnv === "production" ? 0.1 : 0,
    beforeSend: (event) => {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
  sentryInitialized = true;
}

function SentryFallback() {
  const { palette, spacing } = useHungryTheme();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bg,
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: spacing[6],
      }}
    >
      <AppText variant="h2" style={{ marginBottom: spacing[2], textAlign: "center" }}>
        Something went wrong
      </AppText>
      <AppText tone="secondary" style={{ textAlign: "center" }}>
        The app hit an unexpected error. Please restart and try again.
      </AppText>
    </View>
  );
}

export default Sentry.wrap(function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HungryThemeProvider>
          <Sentry.ErrorBoundary fallback={<SentryFallback />}>
            <AppBody />
          </Sentry.ErrorBoundary>
        </HungryThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
