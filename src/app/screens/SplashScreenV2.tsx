/**
 * SplashScreenV2 — advanced animated brand intro with two options.
 *
 * Option A: Bite + Crumbs physics-like scatter.
 * Option B: Letter-by-letter build + Gravity crumbs rain.
 */

import { useEffect, useRef, useState } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";
import { WordmarkLogoV2 } from "@/components/icons/brand/WordmarkLogoV2";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";

type Props = NativeStackScreenProps<RootStackParamList, "SplashV2">;

export function SplashScreenV2({ navigation, route }: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const { palette, motion, spacing, radii, typography } = useHungryTheme();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const styles = createStyles({ palette, typography, spacing, radii });

  // Navigation param or default to Option A
  const variant = (route.params as any)?.variant || "A";

  // ── Animated values ───────────────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  // Crumbs - 8 small circles
  const crumbs = useRef(
    Array.from({ length: 8 }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    if (variant === "A") {
      runOptionA();
    } else {
      runOptionB();
    }

    const timer = setTimeout(() => {
      // For testing, stay on splash if it's launched manually via dev panel
      if ((route.params as any)?.stay) return;

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
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [variant]);

  const runOptionA = () => {
    Animated.sequence([
      // 1. Logo fades and scales in
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, useNativeDriver: true }),
      ]),
      // 2. Crumbs scatter (simulating the bite in the logo component)
      Animated.parallel([
        ...crumbs.map((c, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const dist = 60 + Math.random() * 60;
          return Animated.parallel([
            Animated.timing(c.opacity, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.spring(c.x, {
              toValue: Math.cos(angle) * dist,
              friction: 4,
              useNativeDriver: true,
            }),
            Animated.spring(c.y, {
              toValue: Math.sin(angle) * dist,
              friction: 4,
              useNativeDriver: true,
            }),
            Animated.timing(c.opacity, {
              toValue: 0,
              duration: 600,
              delay: 200,
              useNativeDriver: true,
            }),
          ]);
        }),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const runOptionB = () => {
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      // Crumbs rain down
      Animated.parallel([
        ...crumbs.map((c, i) => {
          const startX = -40 + Math.random() * 80;
          return Animated.parallel([
            Animated.timing(c.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(c.x, { toValue: startX, duration: 0, useNativeDriver: true }),
            Animated.timing(c.y, {
              toValue: 150,
              duration: 1000,
              easing: Easing.in(Easing.exp),
              useNativeDriver: true,
            }),
            Animated.timing(c.opacity, {
              toValue: 0,
              duration: 400,
              delay: 600,
              useNativeDriver: true,
            }),
          ]);
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 600,
          delay: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <Animated.View
          style={[styles.lockup, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        >
          <WordmarkLogoV2 size={HUNGRY_LOGO_STANDARD_WORDMARK_SIZE} />

          {/* Crumbs Overlay */}
          {crumbs.map((c, i) => (
            <Animated.View
              key={i}
              style={[
                styles.crumb,
                {
                  opacity: c.opacity,
                  transform: [{ translateX: c.x }, { translateY: c.y }, { scale: c.scale }],
                },
              ]}
            />
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: taglineOpacity, marginTop: spacing[8] }}>
          <AppText variant="bodyLarge" tone="secondary">
            Find the dish. Not just the restaurant.
          </AppText>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: taglineOpacity }]}>
        <AppText variant="micro" tone="muted">
          Hungry v{appVersion} · Variant {variant}
        </AppText>
      </Animated.View>
    </View>
  );
}

const createStyles = ({ palette, spacing }: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    container: { flex: 1, alignItems: "center", justifyContent: "center" },
    lockup: { alignItems: "center", justifyContent: "center", position: "relative" },
    crumb: {
      position: "absolute",
      width: 6,
      height: 6,
      backgroundColor: palette.orange,
      borderRadius: 3,
    },
    footer: { position: "absolute", bottom: 48, alignSelf: "center" },
  });
