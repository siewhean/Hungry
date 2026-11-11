/**
 * SplashScreen — animated brand intro and mandatory-auth entry router.
 *
 * The official logo springs into place (AnimatedHungryLogo, about 2.2 s) while auth/bootstrap and
 * Home's first stalls load behind it. The splash stays up until both the animation and the
 * bootstrap are done. Under Reduce Motion the finished logo shows with only the short minimum
 * (motion.splashTotal).
 * New users go to onboarding (which ends at sign-up/sign-in); signed-out
 * returning users go to Login. Main app screens never mount without a session.
 * A signed-in merchant who left the app in Merchant mode reopens in the Merchant Centre.
 */

import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { onboardingEntryRoute } from "@/app/navigation/onboardingEntry";
import { warmHomeFeed } from "@/features/discover/warmHomeFeed";
import { LOGO_SPLASH_DURATION_MS } from "@/features/splash/logoSplash";
import { reportError } from "@/lib/monitoring/reportError";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme, type HungryTheme } from "@/theme";
import { AnimatedHungryLogo, AppText } from "@/components/ui";

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
  "FoodStyles",
  "BrowseStalls",
  "DiscoverMap",
  "DecideForMeResult",
  "MapZoomedIn",
  "Post",
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

/** If session hydration never reports back (e.g. corrupt storage), stop waiting. */
const HYDRATION_FALLBACK_MS = 5000;

/** Splash waits this long at most (counted from when it appeared) for Home's first stalls. */
export const HOME_FEED_WAIT_CAP_MS = 4000;

export function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const returningAccountIntent = useSessionStore((state) => state.returningAccountIntent);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const returnRoute = useSessionStore((state) => state.returnRoute);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const merchantModeRestore = useMerchantStore((state) => state.merchantModeRestore);
  const dismissMerchantModeRestore = useMerchantStore((state) => state.dismissMerchantModeRestore);
  const { palette, motion, spacing } = useHungryTheme();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const reduceMotion = useReduceMotion();
  const styles = useMemo(() => createStyles({ palette }), [palette]);
  const [mountedAt] = useState(() => Date.now());
  // The logo animation plays out in full; Reduce Motion shows the finished logo for a moment.
  const minimumMs = reduceMotion ? motion.splashTotal : LOGO_SPLASH_DURATION_MS;
  const [homeFeedSettled, setHomeFeedSettled] = useState(false);
  // Only a signed-in diner who has finished onboarding lands on Home, so only they warm its feed.
  const opensHome =
    isAuthReady && isAuthenticated && hasCompletedOnboarding && merchantModeRestore !== "restore";

  useEffect(() => {
    if (isAuthReady) return;
    const timer = setTimeout(() => {
      const session = useSessionStore.getState();
      if (!session.hasHydrated) session.markHydrated();
    }, HYDRATION_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [isAuthReady]);

  // Start Home's first reads behind the splash and leave once the nearest stalls are in, or after
  // the cap so a slow network never holds the diner here.
  useEffect(() => {
    if (!opensHome) return;
    let isActive = true;
    void warmHomeFeed().then(() => {
      if (isActive) setHomeFeedSettled(true);
    });
    const capTimer = setTimeout(
      () => setHomeFeedSettled(true),
      Math.max(0, HOME_FEED_WAIT_CAP_MS - (Date.now() - mountedAt)),
    );
    return () => {
      isActive = false;
      clearTimeout(capTimer);
    };
  }, [mountedAt, opensHome]);

  // Leave as soon as auth/bootstrap is ready, keeping only a short minimum.
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    // Wait for Home's first stalls (see above); everyone else leaves at once.
    if (opensHome && !homeFeedSettled) {
      return;
    }
    // A remembered Merchant mode waits for the session's merchant account check.
    if (merchantModeRestore === "checking" && hasCompletedOnboarding) {
      return;
    }

    const remaining = Math.max(0, minimumMs - (Date.now() - mountedAt));
    const timer = setTimeout(() => {
      // Fresh users complete local onboarding before they are offered account
      // creation/sign-in. Main app screens never mount during either step.
      if (!hasCompletedOnboarding && returningAccountIntent && !isAuthenticated) {
        // Welcome's "Sign in" was tapped last: back to Login, not through onboarding again.
        dismissMerchantModeRestore();
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthStack", params: { screen: "Login" } }],
        });
        return;
      }

      if (!hasCompletedOnboarding) {
        // Onboarding comes first; a remembered Merchant mode is forgotten, not kept for later.
        // A run left unfinished in the last 24 hours reopens on its step, with its answers.
        dismissMerchantModeRestore();
        navigation.reset({
          index: 0,
          routes: [onboardingEntryRoute()],
        });
        return;
      }

      if (!isAuthenticated) {
        // Finished onboarding here but never made an account: back to the account
        // step, not a "Welcome back" sign-in screen.
        if (useSessionStore.getState().onboardingCompletionPending) {
          navigation.reset({
            index: 0,
            routes: [{ name: "OnboardingStack", params: { screen: "OnboardingAuth" } }],
          });
          return;
        }
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
    returningAccountIntent,
    isAuthenticated,
    isAuthReady,
    merchantModeRestore,
    minimumMs,
    homeFeedSettled,
    mountedAt,
    navigation,
    opensHome,
    returnRoute,
    setReturnRoute,
  ]);

  return (
    <View style={styles.root}>
      {/* Reduce Motion: the finished logo, no movement. */}
      <AnimatedHungryLogo
        animated={!reduceMotion}
        onImageError={(error) => reportError(error, { screen: "Splash", step: "logo-image" })}
      />

      {/* Version stamp: development builds only. */}
      {__DEV__ ? (
        <View style={{ position: "absolute", bottom: spacing[12] }}>
          <AppText variant="micro" tone="muted">
            Hungry v{appVersion} · Singapore
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = ({ palette }: Pick<HungryTheme, "palette">) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      // Always white: the official logo is drawn for white, and it matches the native launch screen.
      backgroundColor: palette.white,
    },
  });
