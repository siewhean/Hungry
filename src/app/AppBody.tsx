import { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";

export function AppBody() {
  useAppBootstrap();
  const { colorScheme, theme, palette, spacing, fontsLoaded } = useHungryTheme();
  const [fontTimeoutReached, setFontTimeoutReached] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      setFontTimeoutReached(false);
      return;
    }

    const timeout = setTimeout(() => setFontTimeoutReached(true), 5000);
    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  if (!fontsLoaded && !fontTimeoutReached) {
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

  if (!fontsLoaded && fontTimeoutReached) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing[6],
          gap: spacing[2],
        }}
      >
        <AppText variant="h3" style={{ textAlign: "center" }}>
          Font load delayed
        </AppText>
        <AppText tone="secondary" style={{ textAlign: "center" }}>
          Continue using system fonts while assets finish loading.
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
