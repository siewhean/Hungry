import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";

export function AppBody() {
  useAppBootstrap();
  const { colorScheme, theme, palette } = useHungryTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <BottomSheetModalProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <RootNavigator theme={theme} />
      </BottomSheetModalProvider>
    </View>
  );
}
