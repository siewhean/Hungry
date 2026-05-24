/**
 * SplashScreen — animated brand intro
 *
 * Sequence:
 *  0ms  – screen appears (dark bg)
 *  200ms – logo scales in
 *  700ms – tagline fades in
 *  1000ms – orange dot pulses
 *  1800ms – navigate to onboarding or main tabs
 */

import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const { palette, motion, spacing, radii, typography } = useHungryTheme();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const styles = createStyles({ palette, typography, spacing, radii });

  // ── Animated values ───────────────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.6)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Logo scales in.
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

      // Tagline + dot fade in together
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: motion.splashReveal,
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
      if (!isAuthReady) {
        return;
      }

      if (isAuthenticated && !hasCompletedOnboarding) {
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
    isAuthReady,
    isAuthenticated,
    motion.splashDot,
    motion.splashFast,
    motion.splashReveal,
    motion.splashTotal,
    navigation,
  ]);

  return (
    <View style={styles.root}>
      {/* Brand lockup */}
      <View style={styles.lockup}>
        <Animated.Image
          source={HUNGRY_LOGO_ICON}
          resizeMode="contain"
          style={[styles.logoImage, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        />

        {/* Pulsing orange dot */}
        <Animated.View
          style={{
            opacity: dotOpacity,
            transform: [{ scale: dotScale }],
            alignSelf: "flex-end",
            marginBottom: spacing[2],
          }}
        >
          <View
            style={[styles.dot, { backgroundColor: palette.orange, borderRadius: radii.pill }]}
          />
        </Animated.View>
      </View>

      {/* Tagline */}
      <Animated.View style={{ opacity: taglineOpacity }}>
        <AppText variant="body" tone="secondary" style={styles.tagline}>
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

const createStyles = ({
  palette,
  typography,
  spacing,
  radii,
}: {
  palette: any;
  typography: any;
  spacing: any;
  radii: any;
}) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.bg,
      gap: spacing[4],
    },
    lockup: {
      alignItems: "center",
    },
    logoImage: {
      width: 116,
      height: 116,
    },
    dot: {
      width: 10,
      height: 10,
    },
    tagline: {
      ...typography.body,
      letterSpacing: 0.2,
      color: palette.textSecondary,
    },
  });
