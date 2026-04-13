import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";

export function AppBody() {
  useAppBootstrap();
  const themeContext = useHungryTheme();
  const { colorScheme, theme } = themeContext;

  return (
    <BottomSheetModalProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <RootNavigator theme={theme} />
    </BottomSheetModalProvider>
  );
}
