/**
 * SplashScreen — animated brand intro
 *
 * Sequence:
 *  0ms  – screen appears (dark bg)
 *  200ms – logo scales in
 *  700ms – tagline fades in
 *  ~600ms – orange dot pulses
 *
 * The splash only stays up until auth/bootstrap is ready, with a short
 * minimum (motion.splashTotal) so the logo animation does not flash.
 * New users go to onboarding; everyone else lands in the app (as a guest when
 * signed out). Sign-in is asked for on demand (Profile, save, post, review).
 * A signed-in merchant who left the app in Merchant mode reopens in the Merchant Centre.
 */

import { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme, type HungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const merchantModeRestore = useMerchantStore((state) => state.merchantModeRestore);
  const { palette, motion, spacing, radii, typography } = useHungryTheme();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const styles = createStyles({ palette, typography, spacing, radii });

  // ── Animated values ───────────────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.6)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const [mountedAt] = useState(() => Date.now());

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
  }, [
    dotOpacity,
    dotScale,
    logoOpacity,
    logoScale,
    motion.splashDot,
    motion.splashFast,
    motion.splashReveal,
    taglineOpacity,
  ]);

  // Leave as soon as auth/bootstrap is ready, keeping only a short minimum.
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    // A remembered Merchant mode waits for the session's merchant account check.
    if (merchantModeRestore === "checking") {
      return;
    }

    const remaining = Math.max(0, motion.splashTotal - (Date.now() - mountedAt));
    const timer = setTimeout(() => {
      if (!hasCompletedOnboarding) {
        navigation.reset({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "OnboardingWelcome" } }],
        });
        return;
      }

      if (merchantModeRestore === "restore") {
        navigation.reset({
          index: 0,
          routes: [{ name: "MerchantTabs", params: { screen: "Dashboard" } }],
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
    }, remaining);

    return () => clearTimeout(timer);
  }, [
    hasCompletedOnboarding,
    isAuthReady,
    merchantModeRestore,
    motion.splashTotal,
    mountedAt,
    navigation,
  ]);

  return (
    <View style={styles.root}>
      {/* Brand lockup */}
      <View style={styles.lockup}>
        <Animated.Image
          source={HUNGRY_LOGO_ICON}
          resizeMode="contain"
          accessibilityLabel="Hungry logo"
          accessibilityRole="image"
          style={{
            height: HUNGRY_LOGO_STANDARD_SIZE,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            width: HUNGRY_LOGO_STANDARD_SIZE,
          }}
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
}: Pick<HungryTheme, "palette" | "typography" | "spacing" | "radii">) =>
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
