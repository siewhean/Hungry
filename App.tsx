import * as Sentry from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppText } from "@/components/ui";
import { HungryThemeProvider, useHungryTheme } from "@/theme";
import { AppBody } from "@/app/AppBody";

const sentryDsn = process.env.SENTRY_DSN ?? process.env.EXPO_PUBLIC_SENTRY_DSN;

let sentryInitialized = false;
if (!sentryInitialized) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn),
    debug: typeof __DEV__ !== "undefined" ? __DEV__ : false,
    tracesSampleRate: 0.1,
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
      <AppText
        variant="h2"
        style={{ marginBottom: spacing[2], textAlign: "center" }}
      >
        Something went wrong
      </AppText>
      <AppText tone="secondary" style={{ textAlign: "center" }}>
        The app hit an unexpected error. Please restart and try again.
      </AppText>
    </View>
  );
}

export default function App() {
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
}
