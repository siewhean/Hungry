import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { HungryThemeProvider, useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";

function AppBody() {
  useAppBootstrap();
  const { colorScheme, theme } = useHungryTheme();

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <RootNavigator theme={theme} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HungryThemeProvider>
          <BottomSheetModalProvider>
            <AppBody />
          </BottomSheetModalProvider>
        </HungryThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
