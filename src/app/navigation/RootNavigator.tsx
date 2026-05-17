import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, type ComponentType } from "react";
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
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { FloatingToast } from "@/components/ui";
import { UserProfileScreen } from "@/app/screens/profile/UserProfileScreen";

import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";
import { SwipeableTabNavigator } from "./SwipeableTabNavigator";
import { createRootLinking } from "./linking";
import * as CredEarnedToastModule from "@/components/gamification/CredEarnedToast";

const CredEarnedToastComponent =
  (CredEarnedToastModule as { CredEarnedToast?: ComponentType }).CredEarnedToast ??
  (CredEarnedToastModule as { default?: ComponentType }).default;

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
  "DishDetailV2",
  "SearchHome",
  "SearchHomeV2",
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
  "ChatDetail",
  "DirectMessages",
  "Crave",
  "MusicSelection",
  "BuildingDrillDown",
  "QuickBites",
  "DeveloperLauncher",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "EditProfile",
  "SplashV2",
  "DesignGallery",
  "ReviewFeedV2",
  "PostComposerV2",
  "DiscoverV2",
  "SearchHomeV2",
  "StallDetailV2",
  "BuildingDrillDownV2",
  "QuickReviewV2",
  "VenueDirectory",
  "StoryViewer",
  "AddStory",
  "PassportScreen",
  "MissionsScreen",
  "CollectionList",
  "CollectionDetail",
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
  "ActivityPostDetail",
  "ChatDetail",
  "DirectMessages",
  "EditProfile",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "ReviewStack",
  "QuickReviewV2",
  "AddStory",
  "MusicSelection",
  "MerchantClaimExplainer",
  "PassportScreen",
  "MissionsScreen",
]);

function isMainTabRouteName(value: string): value is MainTabRouteName {
  return MAIN_TAB_ROUTES.has(value as MainTabRouteName);
}

function isRootRouteName(value: string): value is RootRouteName {
  return ROOT_ROUTE_NAMES.has(value as RootRouteName);
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
const loadTasteFilterScreen = () =>
  (
    require("@/app/screens/search/TasteFilterScreen") as typeof import("@/app/screens/search/TasteFilterScreen")
  ).TasteFilterScreen;
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
const loadBuildingDrillDownScreen = () =>
  (
    require("@/app/screens/discover/BuildingDrillDownScreen") as typeof import("@/app/screens/discover/BuildingDrillDownScreen")
  ).BuildingDrillDownScreen;
const loadOfflineStateScreen = () =>
  (
    require("@/app/screens/detail/OfflineStateScreen") as typeof import("@/app/screens/detail/OfflineStateScreen")
  ).OfflineStateScreen;
const loadNotFoundScreen = () =>
  (
    require("@/app/screens/detail/NotFoundScreen") as typeof import("@/app/screens/detail/NotFoundScreen")
  ).NotFoundScreen;
const loadDiscoverHomeScreenV2 = () =>
  (
    require("@/app/screens/discover/DiscoverHomeScreenV2") as typeof import("@/app/screens/discover/DiscoverHomeScreenV2")
  ).DiscoverHomeScreenV2;
const loadDishSearchScreenV2 = () =>
  (
    require("@/app/screens/search/DishSearchScreenV2") as typeof import("@/app/screens/search/DishSearchScreenV2")
  ).DishSearchScreenV2;
const loadStallDetailScreenV2 = () =>
  (
    require("@/app/screens/detail/StallDetailScreenV2") as typeof import("@/app/screens/detail/StallDetailScreenV2")
  ).StallDetailScreenV2;
const loadBuildingDrillDownScreenV2 = () =>
  (
    require("@/app/screens/discover/BuildingDrillDownScreenV2") as typeof import("@/app/screens/discover/BuildingDrillDownScreenV2")
  ).BuildingDrillDownScreenV2;
const loadQuickReviewSheetV2 = () =>
  (
    require("@/app/screens/review/QuickReviewSheetV2") as typeof import("@/app/screens/review/QuickReviewSheetV2")
  ).QuickReviewSheetV2;
const loadQuickBitesScreen = () =>
  (
    require("@/app/screens/discover/QuickBitesScreen") as typeof import("@/app/screens/discover/QuickBitesScreen")
  ).QuickBitesScreen;
const loadSplashScreenV2 = () =>
  (require("@/app/screens/SplashScreenV2") as typeof import("@/app/screens/SplashScreenV2"))
    .SplashScreenV2;
const loadDesignGalleryScreen = () =>
  (
    require("@/app/screens/dev/DesignGalleryScreen") as typeof import("@/app/screens/dev/DesignGalleryScreen")
  ).DesignGalleryScreen;
const loadMerchantTabs = () =>
  (require("@/app/navigation/MerchantTabs") as typeof import("@/app/navigation/MerchantTabs"))
    .MerchantTabs;
const loadReviewFeedScreenV2 = () =>
  (
    require("@/app/screens/review/ReviewFeedScreenV2") as typeof import("@/app/screens/review/ReviewFeedScreenV2")
  ).ReviewFeedScreenV2;
const loadPostComposerScreenV2 = () =>
  (
    require("@/app/screens/post/PostComposerScreenV2") as typeof import("@/app/screens/post/PostComposerScreenV2")
  ).PostComposerScreenV2;
const loadVenueDirectoryScreen = () =>
  (
    require("@/app/screens/discover/VenueDirectoryScreen") as typeof import("@/app/screens/discover/VenueDirectoryScreen")
  ).VenueDirectoryScreen;
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
const loadCollectionListScreen = () =>
  (
    require("@/app/screens/discover/CollectionListScreen") as typeof import("@/app/screens/discover/CollectionListScreen")
  ).CollectionListScreen;
const loadCollectionDetailScreen = () =>
  (
    require("@/app/screens/discover/CollectionDetailScreen") as typeof import("@/app/screens/discover/CollectionDetailScreen")
  ).CollectionDetailScreen;

function BlogPostRouteScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "BlogPost">) {
  const { BlogPostWebViewScreen } =
    require("@/app/screens/reads/BlogPostWebViewScreen") as typeof import("@/app/screens/reads/BlogPostWebViewScreen");

  return (
    <BlogPostWebViewScreen
      onOpenVenue={(venueId) => navigation.navigate("StallDetail", { venueId })}
      postId={route.params?.postId}
    />
  );
}

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

function QuickReviewModalHost() {
  const payload = useUIStore((state) => state.quickReview);
  if (!payload) {
    return null;
  }

  const { QuickReviewModal } =
    require("@/app/screens/review/QuickReviewModal") as typeof import("@/app/screens/review/QuickReviewModal");
  return <QuickReviewModal />;
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

export function RootNavigator({ theme }: { theme: Theme }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const dismissSessionExpiry = useSessionStore((state) => state.dismissSessionExpiry);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);
  const isOffline = useUIStore((state) => state.isOffline);

  const prefix = Linking.createURL("/");
  const linking = useMemo(() => createRootLinking(prefix), [prefix]);

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
      if (isMainTabRouteName(returnRoute)) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: returnRoute } }],
        });
      } else if (isRootRouteName(returnRoute)) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: returnRoute }],
        });
      } else {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: "Home" } }],
        });
      }
    } else if (isRootRouteName(returnRoute.name)) {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: returnRoute.name, params: returnRoute.params }],
      });
    } else {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }
  }, [setReturnRoute]);

  useEffect(() => {
    if (sessionExpired && navigationRef.isReady()) {
      setReturnRoute("Home");
      navigationRef.navigate("AuthStack", { screen: "Login" });
      dismissSessionExpiry();
    }
  }, [dismissSessionExpiry, sessionExpired, setReturnRoute]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    if (!isAuthReady) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const currentTopRoute = rootState.routes[rootState.index]?.name;
    if (currentTopRoute === "AuthStack") {
      if (isAuthenticated && !hasCompletedOnboarding) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "OnboardingIntro1" } }],
        });
        return;
      }

      if (isAuthenticated && hasCompletedOnboarding) {
        navigateHome();
      }
    }

    if (currentTopRoute === "OnboardingStack" && hasCompletedOnboarding) {
      navigateHome();
    }
  }, [hasCompletedOnboarding, isAuthenticated, isAuthReady, navigateHome]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    if (!isAuthReady) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const activeRoute = rootState.routes[rootState.index];

    if (!isAuthenticated && activeRoute && isAuthRequiredRoute(activeRoute)) {
      const mainTabScreen =
        activeRoute.name === "MainTabs" ? getMainTabScreen(activeRoute.params) : "Home";

      setReturnRoute(
        activeRoute.name === "MainTabs"
          ? mainTabScreen
          : {
              name: activeRoute.name,
              params:
                typeof activeRoute.params === "object" && activeRoute.params
                  ? (activeRoute.params as Record<string, unknown>)
                  : undefined,
            },
      );

      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "AuthStack", params: { screen: "Login" } }],
      });
    }
  }, [isAuthenticated, isAuthReady, setReturnRoute]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const currentTopRoute = rootState.routes[rootState.index]?.name;

    if (isOffline && currentTopRoute !== "Offline") {
      navigationRef.navigate("Offline");
      return;
    }

    if (!isOffline && currentTopRoute === "Offline") {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }
  }, [isOffline]);

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={theme}
        linking={linking}
        onStateChange={() => {
          resetScrollBack();
        }}
      >
        <RootStack.Navigator
          id="Root"
          initialRouteName={__DEV__ ? "DeveloperLauncher" : "Splash"}
          screenOptions={{ headerShown: false }}
        >
          {__DEV__ ? (
            <RootStack.Screen getComponent={loadDeveloperLauncherScreen} name="DeveloperLauncher" />
          ) : null}
          <RootStack.Screen component={SplashScreen} name="Splash" />
          <RootStack.Screen component={AuthStack} name="AuthStack" />
          <RootStack.Screen component={OnboardingStack} name="OnboardingStack" />
          <RootStack.Screen component={SwipeableTabNavigator} name="MainTabs" />
          <RootStack.Screen
            getComponent={loadDishSearchScreen}
            name="SearchHome"
            options={{ animation: "none" }}
          />
          <RootStack.Screen
            getComponent={loadSearchResultsScreen}
            name="SearchResults"
            options={{ animation: "none" }}
          />
          <RootStack.Screen
            getComponent={loadBrowseDishesScreen}
            name="BrowseDishes"
            options={{ animation: "none" }}
          />
          <RootStack.Screen
            getComponent={loadBrowseStallsScreen}
            name="BrowseStalls"
            options={{ animation: "none" }}
          />
          <RootStack.Screen getComponent={loadTasteFilterScreen} name="TasteFilter" />
          <RootStack.Screen
            getComponent={loadHomeMapScreen}
            name="DiscoverMap"
            options={{ gestureEnabled: true }}
          />
          <RootStack.Screen getComponent={loadMapZoomedInScreen} name="MapZoomedIn" />
          <RootStack.Screen getComponent={loadPostComposerScreen} name="Post" />
          <RootStack.Screen getComponent={loadEditProfileScreen} name="EditProfile" />
          <RootStack.Screen getComponent={loadFavouritesScreen} name="Favourites" />
          <RootStack.Screen getComponent={loadReviewHistoryScreen} name="ReviewHistory" />
          <RootStack.Screen getComponent={loadSettingsScreen} name="Settings" />
          <RootStack.Screen component={UserProfileScreen} name="UserProfile" />
          <RootStack.Screen getComponent={loadDishDetailScreenV2} name="DishDetail" />
          <RootStack.Screen getComponent={loadStallDetailScreen} name="StallDetail" />
          <RootStack.Screen
            getComponent={loadMerchantClaimExplainerScreen}
            name="MerchantClaimExplainer"
          />
          <RootStack.Screen component={BlogPostRouteScreen} name="BlogPost" />
          <RootStack.Screen getComponent={loadReviewStack} name="ReviewStack" />
          <RootStack.Screen getComponent={loadWheelStack} name="WheelStack" />
          <RootStack.Screen getComponent={loadActivityInboxScreen} name="ActivityInbox" />
          <RootStack.Screen getComponent={loadActivityPostDetailScreen} name="ActivityPostDetail" />
          {FEATURE_FLAGS.directMessagesEnabled ? (
            <>
              <RootStack.Screen getComponent={loadChatDetailScreen} name="ChatDetail" />
              <RootStack.Screen getComponent={loadDirectMessagesScreen} name="DirectMessages" />
            </>
          ) : null}
          {FEATURE_FLAGS.craveEnabled ? (
            <RootStack.Screen getComponent={loadCraveScreen} name="Crave" />
          ) : null}
          <RootStack.Screen getComponent={loadMusicSelectionScreen} name="MusicSelection" />
          <RootStack.Screen getComponent={loadDecideForMeResultScreen} name="DecideForMeResult" />
          <RootStack.Screen getComponent={loadBuildingDrillDownScreen} name="BuildingDrillDown" />
          <RootStack.Screen getComponent={loadOfflineStateScreen} name="Offline" />
          <RootStack.Screen getComponent={loadNotFoundScreen} name="NotFound" />
          <RootStack.Screen getComponent={loadQuickBitesScreen} name="QuickBites" />
          {FEATURE_FLAGS.prototypeRoutesEnabled ? (
            <>
              <RootStack.Screen getComponent={loadDiscoverHomeScreenV2} name="DiscoverV2" />
              <RootStack.Screen getComponent={loadDishDetailScreenV2} name="DishDetailV2" />
              <RootStack.Screen getComponent={loadDishSearchScreenV2} name="SearchHomeV2" />
              <RootStack.Screen getComponent={loadStallDetailScreenV2} name="StallDetailV2" />
              <RootStack.Screen
                getComponent={loadBuildingDrillDownScreenV2}
                name="BuildingDrillDownV2"
              />
              <RootStack.Screen getComponent={loadQuickReviewSheetV2} name="QuickReviewV2" />
              <RootStack.Screen getComponent={loadSplashScreenV2} name="SplashV2" />
              <RootStack.Screen getComponent={loadDesignGalleryScreen} name="DesignGallery" />
              <RootStack.Screen getComponent={loadReviewFeedScreenV2} name="ReviewFeedV2" />
              <RootStack.Screen
                getComponent={loadPostComposerScreenV2}
                name="PostComposerV2"
                options={{ gestureEnabled: false }}
              />
              <RootStack.Screen getComponent={loadVenueDirectoryScreen} name="VenueDirectory" />
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
          {FEATURE_FLAGS.collectionsEnabled ? (
            <>
              <RootStack.Screen getComponent={loadCollectionListScreen} name="CollectionList" />
              <RootStack.Screen getComponent={loadCollectionDetailScreen} name="CollectionDetail" />
            </>
          ) : null}
        </RootStack.Navigator>
      </NavigationContainer>
      <GlobalScrollBackButton />
      <QuickReviewModalHost />
      <ReviewSuccessModalHost onOpenHistory={() => navigationRef.navigate("ReviewHistory")} />
      <FloatingToast />
      {CredEarnedToastComponent ? <CredEarnedToastComponent /> : null}
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
  globalBackButton: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    position: "absolute",
  },
});
