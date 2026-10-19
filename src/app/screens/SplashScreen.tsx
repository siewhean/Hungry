/**
 * SplashScreen — animated brand intro and mandatory-auth entry router.
 *
 * The splash only stays up until auth/bootstrap is ready, with a short
 * minimum (motion.splashTotal) so the logo animation does not flash.
 * New users go to onboarding (which ends at sign-up/sign-in); signed-out
 * returning users go to Login. Main app screens never mount without a session.
 * A signed-in merchant who left the app in Merchant mode reopens in the Merchant Centre.
 */

import { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme, type HungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

const SAFE_MAIN_TAB_RETURNS = new Set<keyof MainTabParamList>([
  "Home",
  "Discover",
  "Review",
  "Profile",
]);
const SAFE_ROOT_RETURNS = new Set<keyof RootStackParamList>([
  "StallDetail",
  "DishDetail",
  "CatalogRawDetail",
  "SearchHome",
  "SearchResults",
  "BrowseDishes",
  "BrowseStalls",
  "TasteFilter",
  "DiscoverMap",
  "DecideForMeResult",
  "MapZoomedIn",
  "Post",
  "BlogPost",
  "ReviewStack",
  "WheelStack",
  "ActivityInbox",
  "ActivityPostDetail",
  "Crave",
  "PortfolioPublicView",
  "QuickBites",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "EditProfile",
  "UserProfile",
]);

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const returnRoute = useSessionStore((state) => state.returnRoute);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const merchantModeRestore = useMerchantStore((state) => state.merchantModeRestore);
  const dismissMerchantModeRestore = useMerchantStore((state) => state.dismissMerchantModeRestore);
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
    if (merchantModeRestore === "checking" && hasCompletedOnboarding) {
      return;
    }

    const remaining = Math.max(0, motion.splashTotal - (Date.now() - mountedAt));
    const timer = setTimeout(() => {
      // Fresh users complete local onboarding before they are offered account
      // creation/sign-in. Main app screens never mount during either step.
      if (!hasCompletedOnboarding) {
        // Onboarding comes first; a remembered Merchant mode is forgotten, not kept for later.
        dismissMerchantModeRestore();
        navigation.reset({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "OnboardingWelcome" } }],
        });
        return;
      }

      if (!isAuthenticated) {
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthStack", params: { screen: "Login" } }],
        });
        return;
      }

      const pending = returnRoute;
      setReturnRoute(undefined);
      if (merchantModeRestore === "restore") {
        navigation.reset({
          index: 0,
          routes: [{ name: "MerchantTabs", params: { screen: "Dashboard" } }],
        });
        return;
      }

      if (
        typeof pending === "string" &&
        SAFE_MAIN_TAB_RETURNS.has(pending as keyof MainTabParamList)
      ) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "MainTabs",
              params: { screen: pending as keyof MainTabParamList },
            },
          ],
        });
        return;
      }

      if (
        pending &&
        typeof pending === "object" &&
        SAFE_ROOT_RETURNS.has(pending.name as keyof RootStackParamList)
      ) {
        navigation.reset({
          index: 1,
          routes: [
            { name: "MainTabs", params: { screen: "Home" } },
            {
              name: pending.name as keyof RootStackParamList,
              params: pending.params,
            } as never,
          ],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }, remaining);

    return () => clearTimeout(timer);
  }, [
    dismissMerchantModeRestore,
    hasCompletedOnboarding,
    isAuthenticated,
    isAuthReady,
    merchantModeRestore,
    motion.splashTotal,
    mountedAt,
    navigation,
    returnRoute,
    setReturnRoute,
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
