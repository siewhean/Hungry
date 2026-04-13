import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HungryThemeProvider } from "@/theme";
import { AppBody } from "@/app/AppBody";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HungryThemeProvider>
          <AppBody />
        </HungryThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
