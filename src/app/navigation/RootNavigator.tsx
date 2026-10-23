import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
  type Theme,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import NetInfo from "@react-native-community/netinfo";
import { ArrowLeft, WifiOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { AppText, FloatingToast } from "@/components/ui";
import { isNetworkOffline } from "@/lib/network/connectivity";
import { UserProfileScreen } from "@/app/screens/profile/UserProfileScreen";

import { useSessionStore } from "@/store/useSessionStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { isE2eDeveloperLauncherBuild } from "@/lib/runtime/e2eDeveloperLauncher";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";
import { SwipeableTabNavigator } from "./SwipeableTabNavigator";
import { useAccountDeletionGracePrompt } from "@/features/auth/useAccountDeletionGracePrompt";
import { createRootLinking } from "./linking";
import { getInitialNotificationUrl, subscribeToNotificationOpens } from "@/lib/notifications/push";

const RootStack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type RootRouteName = keyof RootStackParamList;
type MainTabRouteName = keyof MainTabParamList;

const MAIN_TAB_ROUTES = new Set<MainTabRouteName>(["Home", "Discover", "Review", "Profile"]);

const ROOT_ROUTE_NAMES = new Set<RootRouteName>([
  "Splash",
  "AuthStack",
  "OnboardingStack",
  "MainTabs",
  "MerchantTabs",
  "StallDetail",
  "MerchantClaimExplainer",
  "DishDetail",
  "CatalogRawDetail",
  "SearchHome",
  "SearchResults",
  "BrowseDishes",
  "BrowseStalls",
  "DiscoverMap",
  "DecideForMeResult",
  "MapZoomedIn",
  "Post",
  "ReviewStack",
  "WheelStack",
  "ActivityInbox",
  "ActivityPostDetail",
  "ReviewDetail",
  "FollowRequests",
  "BlockedAndHidden",
  "UserFollowers",
  "UserFollowing",
  "ChatDetail",
  "DirectMessages",
  "Crave",
  "MusicSelection",
  "QuickBites",
  "DeveloperLauncher",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "EditProfile",
  "ChangePassword",
  "DesignGallery",
  "PostComposerV2",
  "StoryViewer",
  "AddStory",
  "PassportScreen",
  "MissionsScreen",
  "PortfolioPublicView",
  "AdminPortfolioFlags",
  "Offline",
  "NotFound",
  "UserProfile",
]);

const PROTECTED_MAIN_TAB_ROUTES = new Set<MainTabRouteName>(["Profile"]);

const PROTECTED_ROOT_ROUTES = new Set<RootRouteName>([
  "MerchantTabs",
  "Post",
  "PostComposerV2",
  "ActivityInbox",
  "FollowRequests",
  "BlockedAndHidden",
  "UserFollowers",
  "UserFollowing",
  "ChatDetail",
  "DirectMessages",
  "EditProfile",
  "ChangePassword",
  "Favourites",
  "ReviewHistory",
  "ReviewStack",
  "AddStory",
  "MusicSelection",
  "MerchantClaimExplainer",
  "PassportScreen",
  "MissionsScreen",
  "AdminPortfolioFlags",
]);

function isMainTabRouteName(value: string): value is MainTabRouteName {
  return MAIN_TAB_ROUTES.has(value as MainTabRouteName);
}

function isRootRouteName(value: string): value is RootRouteName {
  return ROOT_ROUTE_NAMES.has(value as RootRouteName);
}

function isReleaseRouteAvailable(routeName: RootRouteName | MainTabRouteName): boolean {
  switch (routeName) {
    case "Review":
    case "ReviewHistory":
    case "ReviewStack":
      return FEATURE_FLAGS.reviewCreationEnabled;
    case "Favourites":
      return FEATURE_FLAGS.favouritesEnabled;
    case "UserProfile":
      return FEATURE_FLAGS.socialFeedEnabled;
    case "DiscoverMap":
    case "MapZoomedIn":
      return FEATURE_FLAGS.mapEnabled;
    case "Post":
      return FEATURE_FLAGS.postCreationEnabled;
    case "WheelStack":
      return FEATURE_FLAGS.hungryWheelEnabled;
    case "ActivityInbox":
    case "ActivityPostDetail":
      return FEATURE_FLAGS.activityEnabled;
    case "ChatDetail":
    case "DirectMessages":
      return FEATURE_FLAGS.directMessagesEnabled;
    case "Crave":
      return FEATURE_FLAGS.craveEnabled;
    default:
      return true;
  }
}

function getMainTabScreen(params: unknown): MainTabRouteName {
  if (params && typeof params === "object" && "screen" in params) {
    const screen = (params as { screen?: unknown }).screen;
    if (typeof screen === "string" && isMainTabRouteName(screen)) {
      return screen;
    }
  }
  return "Home";
}

function toPendingRoute(route: { name: string; params?: unknown }) {
  return {
    name: route.name,
    params:
      typeof route.params === "object" && route.params
        ? (route.params as Record<string, unknown>)
        : undefined,
  };
}

/** The current top route as a return route, or undefined on Splash/auth/onboarding. */
function getActiveReturnRoute() {
  const rootState = navigationRef.getRootState();
  const activeRoute = rootState?.routes[rootState.index];
  if (!activeRoute) return undefined;
  if (
    activeRoute.name === "Splash" ||
    activeRoute.name === "AuthStack" ||
    activeRoute.name === "OnboardingStack"
  ) {
    return undefined;
  }
  if (activeRoute.name === "MainTabs") return getMainTabScreen(activeRoute.params);
  return toPendingRoute(activeRoute);
}

function isAuthRequiredRoute(route: { name: string; params?: unknown }): boolean {
  if (route.name === "MainTabs") {
    return PROTECTED_MAIN_TAB_ROUTES.has(getMainTabScreen(route.params));
  }
  return PROTECTED_ROOT_ROUTES.has(route.name as RootRouteName);
}

const loadDishSearchScreen = () =>
  (
    require("@/app/screens/search/DishSearchScreen") as typeof import("@/app/screens/search/DishSearchScreen")
  ).DishSearchScreen;
const loadSearchResultsScreen = () =>
  (
    require("@/app/screens/search/SearchResultsScreen") as typeof import("@/app/screens/search/SearchResultsScreen")
  ).SearchResultsScreen;
const loadBrowseDishesScreen = () =>
  (
    require("@/app/screens/search/SearchResultsScreen") as typeof import("@/app/screens/search/SearchResultsScreen")
  ).BrowseDishesScreen;
const loadBrowseStallsScreen = () =>
  (
    require("@/app/screens/search/SearchResultsScreen") as typeof import("@/app/screens/search/SearchResultsScreen")
  ).BrowseStallsScreen;
const loadHomeMapScreen = () =>
  (
    require("@/app/screens/discover/HomeMapScreen") as typeof import("@/app/screens/discover/HomeMapScreen")
  ).HomeMapScreen;
const loadMapZoomedInScreen = () =>
  (
    require("@/app/screens/discover/MapZoomedInScreen") as typeof import("@/app/screens/discover/MapZoomedInScreen")
  ).MapZoomedInScreen;
const loadPostComposerScreen = () =>
  (
    require("@/app/screens/post/PostComposerScreen") as typeof import("@/app/screens/post/PostComposerScreen")
  ).PostComposerScreen;
const loadEditProfileScreen = () =>
  (
    require("@/app/screens/profile/EditProfileScreen") as typeof import("@/app/screens/profile/EditProfileScreen")
  ).EditProfileScreen;
const loadChangePasswordScreen = () =>
  (
    require("@/app/screens/profile/ChangePasswordScreen") as typeof import("@/app/screens/profile/ChangePasswordScreen")
  ).ChangePasswordScreen;
const loadFavouritesScreen = () =>
  (
    require("@/app/screens/profile/FavouritesScreen") as typeof import("@/app/screens/profile/FavouritesScreen")
  ).FavouritesScreen;
const loadReviewHistoryScreen = () =>
  (
    require("@/app/screens/profile/ReviewHistoryScreen") as typeof import("@/app/screens/profile/ReviewHistoryScreen")
  ).ReviewHistoryScreen;
const loadSettingsScreen = () =>
  (
    require("@/app/screens/profile/SettingsScreen") as typeof import("@/app/screens/profile/SettingsScreen")
  ).SettingsScreen;
const loadDishDetailScreenV2 = () =>
  (
    require("@/app/screens/detail/DishDetailScreenV2") as typeof import("@/app/screens/detail/DishDetailScreenV2")
  ).DishDetailScreenV2;
const loadCatalogRawDetailScreen = () =>
  (
    require("@/app/screens/catalog/CatalogRawDetailScreen") as typeof import("@/app/screens/catalog/CatalogRawDetailScreen")
  ).CatalogRawDetailScreen;
const loadStallDetailScreen = () =>
  (
    require("@/app/screens/detail/StallDetailScreen") as typeof import("@/app/screens/detail/StallDetailScreen")
  ).StallDetailScreen;
const loadMerchantClaimExplainerScreen = () =>
  (
    require("@/app/screens/detail/MerchantClaimExplainerScreen") as typeof import("@/app/screens/detail/MerchantClaimExplainerScreen")
  ).MerchantClaimExplainerScreen;
const loadReviewStack = () =>
  (require("@/app/screens/review/ReviewStack") as typeof import("@/app/screens/review/ReviewStack"))
    .ReviewStack;
const loadWheelStack = () =>
  (require("@/app/screens/wheel/WheelStack") as typeof import("@/app/screens/wheel/WheelStack"))
    .WheelStack;
const loadActivityInboxScreen = () =>
  (
    require("@/app/screens/home/ActivityInboxScreen") as typeof import("@/app/screens/home/ActivityInboxScreen")
  ).ActivityInboxScreen;
const loadActivityPostDetailScreen = () =>
  (
    require("@/app/screens/home/ActivityPostDetailScreen") as typeof import("@/app/screens/home/ActivityPostDetailScreen")
  ).ActivityPostDetailScreen;
const loadReviewDetailScreen = () =>
  (
    require("@/app/screens/review/ReviewDetailScreen") as typeof import("@/app/screens/review/ReviewDetailScreen")
  ).ReviewDetailScreen;
const loadFollowRequestsScreen = () =>
  (
    require("@/app/screens/profile/FollowRequestsScreen") as typeof import("@/app/screens/profile/FollowRequestsScreen")
  ).FollowRequestsScreen;
const loadBlockedAndHiddenScreen = () =>
  (
    require("@/app/screens/profile/BlockedAndHiddenScreen") as typeof import("@/app/screens/profile/BlockedAndHiddenScreen")
  ).BlockedAndHiddenScreen;
const loadUserFollowersScreen = () =>
  (
    require("@/app/screens/profile/ProfileConnectionsScreen") as typeof import("@/app/screens/profile/ProfileConnectionsScreen")
  ).FollowersScreen;
const loadUserFollowingScreen = () =>
  (
    require("@/app/screens/profile/ProfileConnectionsScreen") as typeof import("@/app/screens/profile/ProfileConnectionsScreen")
  ).FollowingScreen;
const loadChatDetailScreen = () =>
  (
    require("@/app/screens/home/ChatDetailScreen") as typeof import("@/app/screens/home/ChatDetailScreen")
  ).ChatDetailScreen;
const loadDirectMessagesScreen = () =>
  (
    require("@/app/screens/home/DirectMessagesScreen") as typeof import("@/app/screens/home/DirectMessagesScreen")
  ).DirectMessagesScreen;
const loadCraveScreen = () =>
  (
    require("@/app/screens/discover/CraveScreen") as typeof import("@/app/screens/discover/CraveScreen")
  ).CraveScreen;
const loadMusicSelectionScreen = () =>
  (
    require("@/app/screens/review/MusicSelectionScreen") as typeof import("@/app/screens/review/MusicSelectionScreen")
  ).MusicSelectionScreen;
const loadDecideForMeResultScreen = () =>
  (
    require("@/app/screens/discover/DecideForMeResultScreen") as typeof import("@/app/screens/discover/DecideForMeResultScreen")
  ).DecideForMeResultScreen;
const loadOfflineStateScreen = () =>
  (
    require("@/app/screens/detail/OfflineStateScreen") as typeof import("@/app/screens/detail/OfflineStateScreen")
  ).OfflineStateScreen;
const loadNotFoundScreen = () =>
  (
    require("@/app/screens/detail/NotFoundScreen") as typeof import("@/app/screens/detail/NotFoundScreen")
  ).NotFoundScreen;
const loadQuickBitesScreen = () =>
  (
    require("@/app/screens/discover/QuickBitesScreen") as typeof import("@/app/screens/discover/QuickBitesScreen")
  ).QuickBitesScreen;
const loadDesignGalleryScreen = () =>
  (
    require("@/app/screens/dev/DesignGalleryScreen") as typeof import("@/app/screens/dev/DesignGalleryScreen")
  ).DesignGalleryScreen;
const loadMerchantTabs = () =>
  (require("@/app/navigation/MerchantTabs") as typeof import("@/app/navigation/MerchantTabs"))
    .MerchantTabs;
const loadPostComposerScreenV2 = () =>
  (
    require("@/app/screens/post/PostComposerScreenV2") as typeof import("@/app/screens/post/PostComposerScreenV2")
  ).PostComposerScreenV2;
const loadStoryViewerScreen = () =>
  (
    require("@/app/screens/home/StoryViewerScreen") as typeof import("@/app/screens/home/StoryViewerScreen")
  ).StoryViewerScreen;
const loadAddStoryScreen = () =>
  (
    require("@/app/screens/home/AddStoryScreen") as typeof import("@/app/screens/home/AddStoryScreen")
  ).AddStoryScreen;
const loadDeveloperLauncherScreen = () =>
  (
    require("@/app/screens/dev/DeveloperLauncherScreen") as typeof import("@/app/screens/dev/DeveloperLauncherScreen")
  ).DeveloperLauncherScreen;
// Gamification screens
const loadPassportScreen = () =>
  (
    require("@/app/screens/profile/PassportScreen") as typeof import("@/app/screens/profile/PassportScreen")
  ).PassportScreen;
const loadMissionsScreen = () =>
  (
    require("@/app/screens/profile/MissionsScreen") as typeof import("@/app/screens/profile/MissionsScreen")
  ).MissionsScreen;
const loadPortfolioPublicViewScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioPublicViewScreen") as typeof import("@/app/screens/portfolio/PortfolioPublicViewScreen")
  ).PortfolioPublicViewScreen;
const loadAdminPortfolioFlagsScreen = () =>
  (
    require("@/app/screens/portfolio/AdminPortfolioFlagsScreen") as typeof import("@/app/screens/portfolio/AdminPortfolioFlagsScreen")
  ).AdminPortfolioFlagsScreen;

function GlobalScrollBackButton() {
  const insets = useSafeAreaInsets();
  const { componentSizes, palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const scrollBackVisible = useUIStore((state) => state.scrollBackVisible);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);
  const rootState = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
  const rootRouteName = rootState ? rootState.routes[rootState.index]?.name : undefined;

  if (
    !scrollBackVisible ||
    !navigationRef.isReady() ||
    !navigationRef.canGoBack() ||
    rootRouteName === "MainTabs" ||
    rootRouteName === "OnboardingStack"
  ) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.globalBackWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to the previous screen"
        onPress={() => {
          navigationRef.goBack();
          resetScrollBack();
        }}
        style={[
          styles.globalBackButton,
          {
            ...shadows.floating,
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.pill,
            height: componentSizes.bottomTabCreateButton,
            left: spacing[4],
            top: insets.top + spacing[1],
            width: componentSizes.bottomTabCreateButton,
            zIndex: zIndex.globalBack,
          },
        ]}
      >
        <ArrowLeft color={palette.text} size={18} />
      </Pressable>
    </View>
  );
}

/**
 * Non-blocking offline notice. Going offline used to replace the whole app with
 * the Offline screen and reset to Home on reconnect, losing drafts and progress;
 * now the current screen stays put and this banner sits on top until the
 * connection returns.
 */
function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const isOffline = useUIStore((state) => state.isOffline);
  const setOffline = useUIStore((state) => state.setOffline);

  if (!isOffline) {
    return null;
  }

  const retryConnection = async () => {
    const state = await NetInfo.refresh();
    setOffline(isNetworkOffline(state));
  };

  return (
    <View pointerEvents="box-none" style={[styles.offlineBannerWrap, { zIndex: zIndex.toast }]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.offlineBanner,
          {
            ...shadows.floating,
            backgroundColor: palette.navy,
            borderRadius: radii.pill,
            gap: spacing[2],
            marginHorizontal: spacing[4],
            marginTop: insets.top + spacing[1],
            paddingLeft: spacing[3],
          },
        ]}
      >
        <WifiOff color={palette.textOnDark} size={16} />
        <AppText variant="bodySmall" style={{ color: palette.textOnDark, flex: 1 }}>
          {"You're offline. Saved content stays visible."}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          hitSlop={4}
          onPress={() => void retryConnection()}
          style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[3] }}
        >
          <AppText variant="bodySmallBold" style={{ color: palette.textOnDark }}>
            Retry
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function ReviewSuccessModalHost({ onOpenHistory }: { onOpenHistory: () => void }) {
  const payload = useUIStore((state) => state.reviewSuccess);
  if (!payload) {
    return null;
  }

  const { ReviewSuccessModal } =
    require("@/app/screens/review/ReviewSuccessModal") as typeof import("@/app/screens/review/ReviewSuccessModal");
  return <ReviewSuccessModal onOpenHistory={onOpenHistory} />;
}

function CredEarnedToastHost() {
  if (!FEATURE_FLAGS.gamificationEnabled) {
    return null;
  }

  const { CredEarnedToast } =
    require("@/components/gamification/CredEarnedToast") as typeof import("@/components/gamification/CredEarnedToast");

  return <CredEarnedToast />;
}

export function RootNavigator({ theme }: { theme: Theme }) {
  const isDeveloperLauncherAvailable = __DEV__ || isE2eDeveloperLauncherBuild();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const authDataSource = useSessionStore((state) => state.authDataSource);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const passwordRecoveryInProgress = useSessionStore((state) => state.passwordRecoveryInProgress);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const merchantModeRestore = useMerchantStore((state) => state.merchantModeRestore);
  const dismissMerchantModeRestore = useMerchantStore((state) => state.dismissMerchantModeRestore);
  const [launchSkippedSplash, setLaunchSkippedSplash] = useState(false);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);

  const prefix = Linking.createURL("/");
  const linking = useMemo(
    () => ({
      ...createRootLinking(prefix, () => {
        const state = useSessionStore.getState();
        return {
          isAuthReady: state.isAuthReady,
          isAuthenticated: state.isAuthenticated,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          onAuthRedirect: (route) => {
            state.setReturnRoute({ name: route.name, params: route.params });
          },
        };
      }),
      // Tapped push notifications open their deep link through the same linking rules.
      getInitialURL: async () => (await Linking.getInitialURL()) ?? getInitialNotificationUrl(),
      subscribe: (listener: (url: string) => void) => {
        const urlSubscription = Linking.addEventListener("url", ({ url }) => listener(url));
        const unsubscribeNotifications = subscribeToNotificationOpens(listener);
        return () => {
          urlSubscription.remove();
          unsubscribeNotifications();
        };
      },
    }),
    [prefix],
  );

  const navigateHome = useCallback(() => {
    const returnRoute = useSessionStore.getState().returnRoute;
    setReturnRoute(undefined);

    if (!returnRoute) {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
      return;
    }

    if (typeof returnRoute === "string") {
      if (isMainTabRouteName(returnRoute) && isReleaseRouteAvailable(returnRoute)) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: returnRoute } }],
        });
      } else if (isRootRouteName(returnRoute) && isReleaseRouteAvailable(returnRoute)) {
        navigationRef.resetRoot({
          index: 1,
          routes: [{ name: "MainTabs", params: { screen: "Home" } }, { name: returnRoute }],
        });
      } else {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: "Home" } }],
        });
      }
    } else if (returnRoute.name === "MainTabs") {
      // A tab return route is a tab switch, not a second MainTabs on the stack.
      const params = returnRoute.params as { screen?: unknown } | undefined;
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: getMainTabScreen(params) } }],
      });
    } else if (isRootRouteName(returnRoute.name) && isReleaseRouteAvailable(returnRoute.name)) {
      navigationRef.resetRoot({
        index: 1,
        routes: [
          { name: "MainTabs", params: { screen: "Home" } },
          { name: returnRoute.name, params: returnRoute.params },
        ],
      });
    } else {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }
  }, [setReturnRoute]);

  useAccountDeletionGracePrompt(() => {
    if (!navigationRef.isReady()) return;
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
  });

  // A deep link or tapped notification opens past Splash, so no launch route decides a remembered
  // Merchant mode: the app opens where the link points (customer mode) and forgets it.
  useEffect(() => {
    if (launchSkippedSplash && merchantModeRestore !== "none") {
      dismissMerchantModeRestore();
    }
  }, [dismissMerchantModeRestore, launchSkippedSplash, merchantModeRestore]);

  useEffect(() => {
    if (sessionExpired && navigationRef.isReady()) {
      // Keep the user's place (a dish, the composer) so the next sign-in returns there.
      // The app is sign-in only, so an expired session goes to Login, which says why.
      setReturnRoute(getActiveReturnRoute() ?? "Home");
      navigationRef.navigate("AuthStack", { screen: "Login" });
    }
  }, [sessionExpired, setReturnRoute]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    if (!isAuthReady) {
      return;
    }
    // Keep a signed-in user on the reset form while a recovery update is running.
    if (passwordRecoveryInProgress) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const currentTopRoute = rootState?.routes[rootState.index]?.name;
    if (
      isDeveloperLauncherAvailable &&
      currentTopRoute === "DeveloperLauncher" &&
      isAuthenticated &&
      hasCompletedOnboarding &&
      authDataSource === "supabase" &&
      !isDeveloperMode &&
      !isMerchantMode
    ) {
      // Same launch rule as Splash: a remembered Merchant mode reopens the Merchant Centre.
      if (merchantModeRestore === "checking") return;
      if (merchantModeRestore === "restore") {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "MerchantTabs", params: { screen: "Dashboard" } }],
        });
        return;
      }
      navigateHome();
      return;
    }

    if (currentTopRoute === "AuthStack") {
      // The recovery code exchange signs the user in mid-reset; stay on the reset flow.
      if (passwordRecoveryInProgress) {
        return;
      }
      if (isAuthenticated && !hasCompletedOnboarding) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "OnboardingWelcome" } }],
        });
        return;
      }

      if (isAuthenticated && hasCompletedOnboarding) {
        navigateHome();
      }
    }

    if (currentTopRoute === "OnboardingStack" && hasCompletedOnboarding) {
      if (isAuthenticated) {
        navigateHome();
      } else {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "AuthStack", params: { screen: "Login" } }],
        });
      }
    }
  }, [
    hasCompletedOnboarding,
    authDataSource,
    isAuthenticated,
    isAuthReady,
    isDeveloperMode,
    isMerchantMode,
    merchantModeRestore,
    navigateHome,
    passwordRecoveryInProgress,
  ]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    if (!isAuthReady) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const activeRoute = rootState?.routes[rootState.index];

    if (!isAuthenticated && activeRoute && isAuthRequiredRoute(activeRoute)) {
      const mainTabScreen =
        activeRoute.name === "MainTabs" ? getMainTabScreen(activeRoute.params) : "Home";

      setReturnRoute(activeRoute.name === "MainTabs" ? mainTabScreen : toPendingRoute(activeRoute));

      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "AuthStack", params: { screen: "Login" } }],
      });
    }
  }, [isAuthenticated, isAuthReady, setReturnRoute]);

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={theme}
        linking={linking}
        onReady={() => {
          const launchRoute = navigationRef.getRootState()?.routes[0]?.name;
          if (launchRoute !== "Splash" && launchRoute !== "DeveloperLauncher") {
            setLaunchSkippedSplash(true);
          }
        }}
        onStateChange={() => {
          resetScrollBack();
        }}
      >
        <RootStack.Navigator
          id="Root"
          initialRouteName={isDeveloperLauncherAvailable ? "DeveloperLauncher" : "Splash"}
          screenOptions={{ headerShown: false }}
        >
          {isDeveloperLauncherAvailable ? (
            <RootStack.Screen getComponent={loadDeveloperLauncherScreen} name="DeveloperLauncher" />
          ) : null}
          <RootStack.Screen component={SplashScreen} name="Splash" />
          <RootStack.Screen component={AuthStack} name="AuthStack" />
          <RootStack.Screen component={OnboardingStack} name="OnboardingStack" />
          <RootStack.Screen component={SwipeableTabNavigator} name="MainTabs" />
          {/* Search home animates its own entry; the results and browse grids use the default push. */}
          <RootStack.Screen
            getComponent={loadDishSearchScreen}
            name="SearchHome"
            options={{ animation: "none" }}
          />
          <RootStack.Screen getComponent={loadSearchResultsScreen} name="SearchResults" />
          <RootStack.Screen getComponent={loadBrowseDishesScreen} name="BrowseDishes" />
          <RootStack.Screen getComponent={loadBrowseStallsScreen} name="BrowseStalls" />
          {FEATURE_FLAGS.mapEnabled ? (
            <>
              <RootStack.Screen
                getComponent={loadHomeMapScreen}
                name="DiscoverMap"
                options={{ gestureEnabled: true }}
              />
              <RootStack.Screen getComponent={loadMapZoomedInScreen} name="MapZoomedIn" />
            </>
          ) : null}
          {FEATURE_FLAGS.postCreationEnabled ? (
            <RootStack.Screen getComponent={loadPostComposerScreen} name="Post" />
          ) : null}
          <RootStack.Screen getComponent={loadEditProfileScreen} name="EditProfile" />
          <RootStack.Screen getComponent={loadChangePasswordScreen} name="ChangePassword" />
          {FEATURE_FLAGS.favouritesEnabled ? (
            <RootStack.Screen getComponent={loadFavouritesScreen} name="Favourites" />
          ) : null}
          {FEATURE_FLAGS.reviewCreationEnabled ? (
            <RootStack.Screen getComponent={loadReviewHistoryScreen} name="ReviewHistory" />
          ) : null}
          <RootStack.Screen getComponent={loadSettingsScreen} name="Settings" />
          {FEATURE_FLAGS.socialFeedEnabled ? (
            <RootStack.Screen component={UserProfileScreen} name="UserProfile" />
          ) : null}
          <RootStack.Screen getComponent={loadDishDetailScreenV2} name="DishDetail" />
          <RootStack.Screen getComponent={loadCatalogRawDetailScreen} name="CatalogRawDetail" />
          <RootStack.Screen getComponent={loadStallDetailScreen} name="StallDetail" />
          {FEATURE_FLAGS.merchantClaimCtaEnabled ? (
            <RootStack.Screen
              getComponent={loadMerchantClaimExplainerScreen}
              name="MerchantClaimExplainer"
              options={{
                presentation: "transparentModal",
                animation: "fade",
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
          ) : null}
          {FEATURE_FLAGS.reviewCreationEnabled ? (
            <RootStack.Screen getComponent={loadReviewStack} name="ReviewStack" />
          ) : null}
          {FEATURE_FLAGS.hungryWheelEnabled ? (
            <RootStack.Screen getComponent={loadWheelStack} name="WheelStack" />
          ) : null}
          {FEATURE_FLAGS.activityEnabled ? (
            <>
              <RootStack.Screen getComponent={loadActivityInboxScreen} name="ActivityInbox" />
              <RootStack.Screen
                getComponent={loadActivityPostDetailScreen}
                name="ActivityPostDetail"
              />
            </>
          ) : null}
          {FEATURE_FLAGS.reviewCreationEnabled ? (
            <RootStack.Screen getComponent={loadReviewDetailScreen} name="ReviewDetail" />
          ) : null}
          <RootStack.Screen getComponent={loadFollowRequestsScreen} name="FollowRequests" />
          <RootStack.Screen getComponent={loadBlockedAndHiddenScreen} name="BlockedAndHidden" />
          <RootStack.Screen getComponent={loadUserFollowersScreen} name="UserFollowers" />
          <RootStack.Screen getComponent={loadUserFollowingScreen} name="UserFollowing" />
          {FEATURE_FLAGS.directMessagesEnabled ? (
            <>
              <RootStack.Screen getComponent={loadChatDetailScreen} name="ChatDetail" />
              <RootStack.Screen getComponent={loadDirectMessagesScreen} name="DirectMessages" />
            </>
          ) : null}
          {FEATURE_FLAGS.craveEnabled ? (
            <RootStack.Screen getComponent={loadCraveScreen} name="Crave" />
          ) : null}
          {/* Music is never saved with a review: prototype builds only. */}
          {FEATURE_FLAGS.prototypeRoutesEnabled ? (
            <RootStack.Screen getComponent={loadMusicSelectionScreen} name="MusicSelection" />
          ) : null}
          <RootStack.Screen getComponent={loadDecideForMeResultScreen} name="DecideForMeResult" />
          <RootStack.Screen getComponent={loadOfflineStateScreen} name="Offline" />
          <RootStack.Screen getComponent={loadNotFoundScreen} name="NotFound" />
          {!FEATURE_FLAGS.release01CoreOnly ? (
            <RootStack.Screen getComponent={loadQuickBitesScreen} name="QuickBites" />
          ) : null}
          {FEATURE_FLAGS.prototypeRoutesEnabled ? (
            <>
              <RootStack.Screen getComponent={loadDesignGalleryScreen} name="DesignGallery" />
              <RootStack.Screen
                getComponent={loadPostComposerScreenV2}
                name="PostComposerV2"
                options={{ gestureEnabled: false }}
              />
            </>
          ) : null}
          {FEATURE_FLAGS.merchantCentreEnabled ? (
            <RootStack.Screen getComponent={loadMerchantTabs} name="MerchantTabs" />
          ) : null}
          {FEATURE_FLAGS.storiesEnabled ? (
            <>
              <RootStack.Screen
                getComponent={loadStoryViewerScreen}
                name="StoryViewer"
                options={{ presentation: "fullScreenModal", animation: "fade" }}
              />
              <RootStack.Screen
                getComponent={loadAddStoryScreen}
                name="AddStory"
                options={{ presentation: "modal" }}
              />
            </>
          ) : null}
          {FEATURE_FLAGS.gamificationEnabled ? (
            <>
              <RootStack.Screen getComponent={loadPassportScreen} name="PassportScreen" />
              <RootStack.Screen getComponent={loadMissionsScreen} name="MissionsScreen" />
            </>
          ) : null}
          {FEATURE_FLAGS.portfoliosEnabled ? (
            <RootStack.Screen
              getComponent={loadPortfolioPublicViewScreen}
              name="PortfolioPublicView"
            />
          ) : null}
          {FEATURE_FLAGS.prototypeRoutesEnabled ? (
            <>
              <RootStack.Screen
                getComponent={loadAdminPortfolioFlagsScreen}
                name="AdminPortfolioFlags"
              />
            </>
          ) : null}
        </RootStack.Navigator>
      </NavigationContainer>
      <GlobalScrollBackButton />
      <OfflineBanner />
      {FEATURE_FLAGS.reviewCreationEnabled ? (
        <ReviewSuccessModalHost onOpenHistory={() => navigationRef.navigate("ReviewHistory")} />
      ) : null}
      <FloatingToast />
      <CredEarnedToastHost />
    </>
  );
}

const styles = StyleSheet.create({
  globalBackWrap: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  offlineBannerWrap: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  offlineBanner: {
    alignItems: "center",
    flexDirection: "row",
  },
  globalBackButton: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    position: "absolute",
  },
});
