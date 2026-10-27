import { useEffect, useRef, useState } from "react";
import { View, Animated, Pressable, ScrollView, useWindowDimensions } from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import { AppText, Button } from "@/components/ui";
import { WelcomeBackdrop } from "@/components/onboarding/WelcomeBackdrop";
import { WelcomePhoneMockup } from "@/components/onboarding/WelcomePhoneMockup";
import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { clearPendingDishSave } from "@/features/auth/pendingDishSave";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingWelcome">;

const VALUE_PROPS = [
  "Ranked by people who ate it",
  "Find the best hawker stalls near you",
  "Personalised to your taste",
];

const LOGO_SIZE = 72;

export function WelcomeScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  const [slide, setSlide] = useState(0);
  const slideChanged = useRef(false);
  // The phone is sized from the height left under the logo, headline and button.
  const phoneWidth = Math.round(Math.min(SCREEN_W * 0.56, SCREEN_H * 0.275, 260));

  const logoAnim = useRef(new Animated.Value(0)).current;
  const phoneAnim = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const captionAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    trackOnboardingStepViewed("welcome");
  }, []);

  // The CTA is never animated, so it is usable at once; the rest of the entrance
  // is skipped under Reduce Motion.
  useEffect(() => {
    if (reduceMotion) {
      logoAnim.setValue(1);
      phoneAnim.setValue(1);
      headlineAnim.setValue(1);
      captionAnim.setValue(1);
      return;
    }
    const entrance = Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(phoneAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(headlineAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(captionAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [captionAnim, headlineAnim, logoAnim, phoneAnim, reduceMotion]);

  // Each time the phone moves to its next screen, the line below fades back in.
  useEffect(() => {
    if (reduceMotion || !slideChanged.current) {
      slideChanged.current = true;
      return;
    }
    captionAnim.setValue(0);
    const fade = Animated.timing(captionAnim, { toValue: 1, duration: 400, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [captionAnim, reduceMotion, slide]);

  const handleStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("LocationPermission");
  };

  const handleExistingAccountSignIn = () => {
    // An existing account has already completed the account journey. Persist
    // that intent before leaving onboarding so protected deep links and an
    // app reload return to authentication rather than the welcome screen. It is not
    // the onboarding journey, and a dish saved earlier as a guest is not attached to it.
    clearPendingDishSave();
    completeOnboarding(false, { existingAccount: true });
    getRootNavigation(navigation).navigate("AuthStack", { screen: "Login" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WelcomeBackdrop />
      {/* The content scrolls (large text sizes); the Get started button stays pinned below it. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingTop: insets.top + 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
        }}
      >
        {/* Logo + wordmark */}
        <Animated.View
          style={{
            alignItems: "center",
            opacity: logoAnim,
            transform: [
              { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          }}
        >
          <Animated.Image
            source={HUNGRY_LOGO_ICON}
            resizeMode="contain"
            accessible
            accessibilityLabel="Hungry logo"
            accessibilityRole="image"
            style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          />
        </Animated.View>

        {/* Phone showing real Hungry screens */}
        <Animated.View
          style={{
            marginTop: 16,
            opacity: phoneAnim,
            transform: [
              { translateY: phoneAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) },
              { scale: phoneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          }}
        >
          <WelcomePhoneMockup width={phoneWidth} onSlideChange={setSlide} />
        </Animated.View>

        {/* Headline */}
        <Animated.View
          style={{
            marginTop: 24,
            opacity: headlineAnim,
            transform: [
              {
                translateY: headlineAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              },
            ],
          }}
        >
          <AppText variant="displaySm" accessibilityRole="header" style={{ textAlign: "center" }}>
            {"Find the dish.\nNot just the restaurant."}
          </AppText>
        </Animated.View>

        {/* Value props: one at a time with the phone, or all at once under Reduce Motion. */}
        <Animated.View
          accessible
          accessibilityLabel={VALUE_PROPS.join(". ")}
          style={{ marginTop: 12, minHeight: reduceMotion ? undefined : 24, opacity: captionAnim }}
        >
          {reduceMotion ? (
            VALUE_PROPS.map((text) => (
              <AppText
                key={text}
                variant="bodySmall"
                tone="secondary"
                style={{ textAlign: "center" }}
              >
                {text}
              </AppText>
            ))
          ) : (
            <AppText variant="bodyBold" tone="secondary" style={{ textAlign: "center" }}>
              {VALUE_PROPS[slide]}
            </AppText>
          )}
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
