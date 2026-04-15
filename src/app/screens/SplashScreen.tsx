/**
 * SplashScreen — animated brand intro
 *
 * Sequence:
 *  0ms  – screen appears (dark bg)
 *  200ms – "H" bites in from above (scale + opacity)
 *  450ms – "ungry" types in from the right
 *  700ms – tagline fades in
 *  1000ms – orange dot pulses
 *  1800ms – navigate to onboarding or main tabs
 */

import { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const { palette, motion, spacing, radii } = useHungryTheme();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  // ── Animated values ───────────────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const suffixTranslateX = useRef(new Animated.Value(24)).current;
  const suffixOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.6)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // H bite down
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          damping: 12,
          mass: 0.8,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: motion.splashFast,
          useNativeDriver: true,
        }),
      ]),

      // "ungry" slides in
      Animated.parallel([
        Animated.timing(suffixTranslateX, {
          toValue: 0,
          duration: motion.splashMedium,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(suffixOpacity, {
          toValue: 1,
          duration: motion.splashFast,
          useNativeDriver: true,
        }),
      ]),

      // Tagline + dot fade in together
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: motion.splashReveal,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(dotScale, {
          toValue: 1,
          damping: 8,
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: motion.splashDot,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Navigate after full animation
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthStack", params: { screen: "Login" } }],
        });
        return;
      }

      if (!hasCompletedOnboarding) {
        navigation.reset({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "OnboardingIntro1" } }],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "MainTabs",
            params: { screen: "Home" },
          },
        ],
      });
    }, motion.splashTotal);

    return () => clearTimeout(timer);
  }, [
    hasCompletedOnboarding,
    isAuthenticated,
    motion.splashDot,
    motion.splashFast,
    motion.splashMedium,
    motion.splashReveal,
    motion.splashTotal,
    navigation,
  ]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, gap: spacing[4] }]}>
      {/* Brand lockup */}
      <View style={[styles.lockup, { gap: 0 }]}>
        {/* "H" — the "bite" letter */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <View style={[styles.hContainer, { backgroundColor: palette.orange, borderRadius: radii.xl }]}>
            <AppText tone="inverse" style={styles.hLetter}>H</AppText>
            {/* Bite notch */}
            <View style={[styles.biteNotch, { backgroundColor: palette.bg, borderRadius: radii.md }]} />
          </View>
        </Animated.View>

        {/* "ungry" */}
        <Animated.View
          style={{
            opacity: suffixOpacity,
            transform: [{ translateX: suffixTranslateX }],
            justifyContent: "center",
          }}
        >
          <AppText style={[styles.brandSuffix, { color: palette.text }]}>ungry</AppText>
        </Animated.View>

        {/* Pulsing orange dot */}
        <Animated.View
          style={{
            opacity: dotOpacity,
            transform: [{ scale: dotScale }],
            alignSelf: "flex-end",
            marginBottom: spacing[2],
          }}
        >
          <View style={[styles.dot, { backgroundColor: palette.orange, borderRadius: radii.pill }]} />
        </Animated.View>
      </View>

      {/* Tagline */}
      <Animated.View style={{ opacity: taglineOpacity }}>
        <AppText style={[styles.tagline, { color: palette.textSecondary }]}>
          Find the dish. Not just the restaurant.
        </AppText>
      </Animated.View>

      {/* Version stamp */}
      <Animated.View
        style={{
          opacity: taglineOpacity,
          position: "absolute",
          bottom: spacing[12],
        }}
      >
        <AppText variant="micro" tone="muted">
          Hungry v{appVersion} · Singapore
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
  },
  hContainer: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  hLetter: {
    fontSize: 48,
    lineHeight: 56,
    fontFamily: "Nunito_800ExtraBold",
  },
  biteNotch: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
  },
  brandSuffix: {
    fontSize: 48,
    lineHeight: 56,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -1,
  },
  dot: {
    width: 10,
    height: 10,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    letterSpacing: 0.2,
  },
});
