import { useEffect } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const { palette, spacing } = useHungryTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && !hasCompletedOnboarding) {
        navigation.reset({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "TasteQuiz" } }],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, isAuthenticated, navigation]);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bg,
        flex: 1,
        gap: spacing[2],
        justifyContent: "center",
      }}
    >
      <AppText variant="display" style={{ color: palette.orange }}>
        Hungry
      </AppText>
      <AppText tone="secondary">Find the dish. Not just the restaurant.</AppText>
    </View>
  );
}
