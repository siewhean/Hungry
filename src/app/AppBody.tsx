import { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";

const APP_SHELL_FONT_GRACE_MS = 900;

export function AppBody() {
  useAppBootstrap();
  const { colorScheme, theme, palette, spacing, fontsLoaded } = useHungryTheme();
  const [fontGraceReached, setFontGraceReached] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      setFontGraceReached(false);
      return;
    }

    const timeout = setTimeout(() => setFontGraceReached(true), APP_SHELL_FONT_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  if (!fontsLoaded && !fontGraceReached) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing[6],
        }}
      >
        <AppText variant="h3" style={{ textAlign: "center" }}>
          Loading fonts…
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <BottomSheetModalProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <RootNavigator theme={theme} />
      </BottomSheetModalProvider>
    </View>
  );
}
