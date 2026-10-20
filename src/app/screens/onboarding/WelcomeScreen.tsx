import { useEffect, useRef } from "react";
import { View, Animated, Pressable, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import { AppText, Button } from "@/components/ui";
import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingWelcome">;

const VALUE_PROPS = [
  { emoji: "🍜", text: "Discover dishes, not just restaurants" },
  { emoji: "📍", text: "Find the best hawker stalls near you" },
  { emoji: "🎯", text: "Personalised to your taste" },
];

export function WelcomeScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const { height: SCREEN_H } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const pillsAnim = useRef(VALUE_PROPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    trackOnboardingStepViewed("welcome");
  }, []);

  // The CTA is never animated, so it is usable at once; the rest of the entrance
  // is skipped under Reduce Motion.
  useEffect(() => {
    if (reduceMotion) {
      logoAnim.setValue(1);
      headlineAnim.setValue(1);
      pillsAnim.forEach((anim) => anim.setValue(1));
      return;
    }
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headlineAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.stagger(
        80,
        pillsAnim.map((a) =>
          Animated.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }),
        ),
      ),
    ]).start();
  }, [headlineAnim, logoAnim, pillsAnim, reduceMotion]);

  const handleStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("LocationPermission");
  };

  const handleExistingAccountSignIn = () => {
    // An existing account has already completed the account journey. Persist
    // that intent before leaving onboarding so protected deep links and an
    // app reload return to authentication rather than the welcome screen.
    completeOnboarding();
    getRootNavigation(navigation).navigate("AuthStack", { screen: "Login" });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
      }}
    >
      <OnboardingProgress step="welcome" />

      {/* Logo + wordmark */}
      <Animated.View
        style={{
          alignItems: "center",
          marginTop: SCREEN_H * 0.06,
          opacity: logoAnim,
          transform: [
            {
              translateY: logoAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}
      >
        <Animated.Image
          source={HUNGRY_LOGO_ICON}
          resizeMode="contain"
          accessible
          accessibilityLabel="Hungry logo"
          accessibilityRole="image"
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
      </Animated.View>

      {/* Headline */}
      <Animated.View
        style={{
          marginTop: SCREEN_H * 0.07,
          opacity: headlineAnim,
          transform: [
            {
              translateY: headlineAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        }}
      >
        <AppText variant="display" accessibilityRole="header" style={{ marginBottom: 10 }}>
          {"Find the dish.\nNot just the\nrestaurant."}
        </AppText>
      </Animated.View>

      {/* Value props */}
      <View style={{ marginTop: 28, gap: 14 }}>
        {VALUE_PROPS.map((item, i) => (
          <Animated.View
            key={item.text}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              opacity: pillsAnim[i],
              transform: [
                {
                  translateX: pillsAnim[i]!.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            }}
          >
            {/* Decorative emoji: screen readers read the text beside it only. */}
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
              <AppText style={{ fontSize: 20 }}>{item.emoji}</AppText>
            </View>
            <AppText variant="bodyBold" style={{ flex: 1 }}>
              {item.text}
            </AppText>
          </Animated.View>
        ))}
      </View>

      {/* CTA: visible and tappable immediately. */}
      <View style={{ marginTop: "auto", paddingTop: 32 }}>
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
              <AppText variant="bodySmall" style={{ color: palette.orange, fontWeight: "700" }}>
                Sign in
              </AppText>
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
