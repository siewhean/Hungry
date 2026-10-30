import { useEffect } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import { AccessibleImage, AppSymbol, AppText, Button, type AppSymbolName } from "@/components/ui";
import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { clearPendingDishSave } from "@/features/auth/pendingDishSave";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useRiseIn } from "@/lib/motion/uiMotion";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingWelcome">;

const VALUE_PROPS: { symbol: AppSymbolName; text: string }[] = [
  { symbol: "rankedByPeople", text: "Ranked by people who ate it" },
  { symbol: "nearYou", text: "Find the best hawker stalls near you" },
  { symbol: "yourTaste", text: "Personalised to your taste" },
];

export function WelcomeScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const setReturningAccountIntent = useSessionStore((state) => state.setReturningAccountIntent);
  const { height: SCREEN_H } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  // One short rise of the whole block (the CTA is never animated, so it is usable at once).
  // Shown without motion under Reduce Motion.
  const entrance = useRiseIn(reduceMotion, { duration: 300, distance: 12 });

  useEffect(() => {
    trackOnboardingStepViewed("welcome");
  }, []);

  const handleStart = () => {
    setReturningAccountIntent(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("LocationPermission");
  };

  const handleExistingAccountSignIn = () => {
    // Onboarding is not marked done here: a relaunch returns to Login through this intent, and
    // the account decides after sign-in whether onboarding runs (an existing account goes Home,
    // a new one goes through it). A dish saved earlier as a guest is not attached to this account.
    clearPendingDishSave();
    setReturningAccountIntent(true);
    getRootNavigation(navigation).navigate("AuthStack", { screen: "Login" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* The content scrolls (large text sizes); the Get started button stays pinned below it. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: 16,
          paddingHorizontal: 28,
        }}
      >
        <Animated.View style={entrance}>
          {/* Logo + wordmark */}
          <View style={{ alignItems: "center", marginTop: SCREEN_H * 0.06 }}>
            <AccessibleImage
              source={HUNGRY_LOGO_ICON}
              contentFit="contain"
              accessibilityLabel="Hungry logo"
              style={{
                width: HUNGRY_LOGO_STANDARD_SIZE,
                height: HUNGRY_LOGO_STANDARD_SIZE,
                marginBottom: 12,
              }}
            />
            <AppText variant="displaySm" style={{ letterSpacing: -0.5 }}>
              Hungry
            </AppText>
            <AppText variant="bodySmall" tone="secondary" style={{ marginTop: 4 }}>
              {"Singapore's dish-first food app"}
            </AppText>
          </View>

          {/* Headline */}
          <View style={{ marginTop: SCREEN_H * 0.07 }}>
            <AppText variant="display" accessibilityRole="header" style={{ marginBottom: 10 }}>
              {"Find the dish.\nNot just the\nrestaurant."}
            </AppText>
          </View>

          {/* Value props */}
          <View style={{ marginTop: 28, gap: 14 }}>
            {VALUE_PROPS.map((item) => (
              <View key={item.text} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {/* Decorative symbol: screen readers read the text beside it only. */}
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${palette.orange}18`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppSymbol name={item.symbol} color={palette.orange} size={20} />
                </View>
                <AppText variant="bodyBold" style={{ flex: 1 }}>
                  {item.text}
                </AppText>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA: visible and tappable immediately. */}
      <View style={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 28, paddingTop: 16 }}>
        <Button label="Get started" onPress={handleStart} variant="primary" />
        {isAuthenticated ? null : (
          <Pressable
            onPress={handleExistingAccountSignIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in to existing account"
            style={{ alignItems: "center", justifyContent: "center", marginTop: 8, minHeight: 44 }}
          >
            <AppText variant="bodySmall" tone="secondary">
              Already have an account?{" "}
              <AppText variant="bodySmall" style={{ color: palette.accentText, fontWeight: "700" }}>
                Sign in
              </AppText>
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
