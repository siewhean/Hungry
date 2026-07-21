import { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";
import { PreAuthNavigator } from "@/app/navigation/PreAuthNavigator";
import { getReleasedSupabaseConfigurationError } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";

const APP_SHELL_FONT_GRACE_MS = 900;

export function AppBody() {
  const isBootstrapReady = useAppBootstrap();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const { colorScheme, theme, palette, spacing, fontsLoaded } = useHungryTheme();
  const [fontGraceReached, setFontGraceReached] = useState(false);
  const configurationError = getReleasedSupabaseConfigurationError();

  useEffect(() => {
    if (fontsLoaded) {
      setFontGraceReached(false);
      return;
    }

    const timeout = setTimeout(() => setFontGraceReached(true), APP_SHELL_FONT_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  const centeredMessage = (title: string, body?: string) => (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[3],
        paddingHorizontal: spacing[6],
      }}
    >
      <AppText variant="h3" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {body ? (
        <AppText tone="secondary" style={{ textAlign: "center" }}>
          {body}
        </AppText>
      ) : null}
    </View>
  );

  if (!fontsLoaded && !fontGraceReached) {
    return centeredMessage("Loading fonts…");
  }

  if (configurationError) {
    return centeredMessage(
      "Hungry is temporarily unavailable",
      `${configurationError} Install the latest build or contact Hungry support.`,
    );
  }

  if (!isBootstrapReady || !isAuthReady) {
    return centeredMessage("Connecting securely…");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <BottomSheetModalProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        {isAuthenticated ? <RootNavigator theme={theme} /> : <PreAuthNavigator theme={theme} />}
      </BottomSheetModalProvider>
    </View>
  );
}
