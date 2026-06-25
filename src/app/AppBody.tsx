import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";

const APP_SHELL_FONT_GRACE_MS = 900;
const APP_ROOT_TEST_ID = "app-root";
const APP_ROOT_ACCESSIBILITY_LABEL = "app-root";
const APP_ROOT_READY_MARKER = "app-root-ready";

export function AppBody() {
  const isBootstrapReady = useAppBootstrap();
  const { colorScheme, theme, palette, spacing, fontsLoaded } = useHungryTheme();
  const [fontGraceReached, setFontGraceReached] = useState(false);
  const appRootReadyMarker = (
    <Text
      testID={APP_ROOT_READY_MARKER}
      accessibilityLabel={APP_ROOT_READY_MARKER}
      style={{
        fontSize: 1,
        lineHeight: 1,
        position: "absolute",
        left: 0,
        top: 0,
        opacity: 0.99,
      }}
    >
      {APP_ROOT_READY_MARKER}
    </Text>
  );

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
        testID={APP_ROOT_TEST_ID}
        accessibilityLabel={APP_ROOT_ACCESSIBILITY_LABEL}
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
        {!!APP_ROOT_READY_MARKER && appRootReadyMarker}
      </View>
    );
  }

  if (!isBootstrapReady) {
    return (
      <View
        testID={APP_ROOT_TEST_ID}
        accessibilityLabel={APP_ROOT_ACCESSIBILITY_LABEL}
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing[6],
        }}
      >
        <AppText variant="h3" style={{ textAlign: "center" }}>
          Connecting securely…
        </AppText>
        {!!APP_ROOT_READY_MARKER && appRootReadyMarker}
      </View>
    );
  }

  return (
    <View testID={APP_ROOT_TEST_ID} style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        accessibilityLabel={APP_ROOT_ACCESSIBILITY_LABEL}
        style={{ position: "absolute", height: 0, width: 0, opacity: 0 }}
      />
      <BottomSheetModalProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        {!!APP_ROOT_READY_MARKER && appRootReadyMarker}
        <RootNavigator theme={theme} />
      </BottomSheetModalProvider>
    </View>
  );
}
