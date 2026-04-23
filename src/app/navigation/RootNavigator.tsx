import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo } from "react";
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
import { DeveloperLauncherScreen } from "@/app/screens/dev/DeveloperLauncherScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { DishDetailScreen } from "@/app/screens/detail/DishDetailScreen";
import { NotFoundScreen } from "@/app/screens/detail/NotFoundScreen";
import { OfflineStateScreen } from "@/app/screens/detail/OfflineStateScreen";
import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { BuildingDrillDownScreen } from "@/app/screens/discover/BuildingDrillDownScreen";
import { BuildingDrillDownScreenV2 } from "@/app/screens/discover/BuildingDrillDownScreenV2";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { DiscoverHomeScreenV2 } from "@/app/screens/discover/DiscoverHomeScreenV2";
import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { MapZoomedInScreen } from "@/app/screens/discover/MapZoomedInScreen";
import { CraveScreen } from "@/app/screens/discover/CraveScreen";
import { DirectMessagesScreen } from "@/app/screens/home/DirectMessagesScreen";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { PostComposerScreen } from "@/app/screens/post/PostComposerScreen";
import { EditProfileScreen } from "@/app/screens/profile/EditProfileScreen";
import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import { ReviewHistoryScreen } from "@/app/screens/profile/ReviewHistoryScreen";
import { SettingsScreen } from "@/app/screens/profile/SettingsScreen";
import { UserProfileScreen } from "@/app/screens/profile/UserProfileScreen";
import { BlogPostWebViewScreen } from "@/app/screens/reads/BlogPostWebViewScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { MusicSelectionScreen } from "@/app/screens/review/MusicSelectionScreen";
import { ReviewSuccessModal } from "@/app/screens/review/ReviewSuccessModal";
import { QuickReviewModal } from "@/app/screens/review/QuickReviewModal";
import { QuickReviewSheetV2 } from "@/app/screens/review/QuickReviewSheetV2";
import { QuickBitesScreen } from "@/app/screens/discover/QuickBitesScreen";
import { SplashScreenV2 } from "@/app/screens/SplashScreenV2";
import { DesignGalleryScreen } from "@/app/screens/dev/DesignGalleryScreen";
import { MerchantTabs } from "@/app/navigation/MerchantTabs";
import { ReviewFeedScreenV2 } from "@/app/screens/review/ReviewFeedScreenV2";
import { PostComposerScreenV2 } from "@/app/screens/post/PostComposerScreenV2";
import { WheelStack } from "@/app/screens/wheel/WheelStack";
import { DishSearchScreen } from "@/app/screens/search/DishSearchScreen";
import { DishSearchScreenV2 } from "@/app/screens/search/DishSearchScreenV2";
import { SearchResultsScreen } from "@/app/screens/search/SearchResultsScreen";
import { StallDetailScreenV2 } from "@/app/screens/detail/StallDetailScreenV2";
import { TasteFilterScreen } from "@/app/screens/search/TasteFilterScreen";
import { FloatingToast } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { RootStackParamList } from "./navigationTypes";
import { SwipeableTabNavigator } from "./SwipeableTabNavigator";
import { createRootLinking } from "./linking";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const AUTH_REQUIRED_ROUTES = new Set([
  "MainTabs",
  "MerchantTabs",
  "SearchHome",
  "SearchHomeV2",
  "SearchResults",
  "MapZoomedIn",
  "Post",
  "PostComposerV2",
  "EditProfile",
  "BuildingDrillDown",
  "DecideForMeResult",
  "TasteFilter",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "SettingsV2",
  "DishDetail",
  "StallDetail",
  "StallDetailV2",
  "BlogPost",
  "ReviewStack",
]);

function BlogPostRouteScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "BlogPost">) {
  return (
    <BlogPostWebViewScreen
      onOpenVenue={(venueId) => navigation.navigate("StallDetail", { venueId })}
      postId={route.params?.postId ?? "blog-1"}
    />
  );
}

function GlobalScrollBackButton() {
  const insets = useSafeAreaInsets();
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const scrollBackVisible = useUIStore((state) => state.scrollBackVisible);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);
  const rootState = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
  const rootRouteName = rootState ? rootState.routes[rootState.index]?.name : undefined;

  if (
    !scrollBackVisible ||
    !navigationRef.isReady() ||
    !navigationRef.canGoBack() ||
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
            left: spacing[4],
            top: insets.top + spacing[1],
            zIndex: zIndex.globalBack,
          },
        ]}
      >
        <ArrowLeft color={palette.navy} size={18} />
      </Pressable>
    </View>
  );
}

export function RootNavigator({ theme }: { theme: Theme }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const dismissSessionExpiry = useSessionStore((state) => state.dismissSessionExpiry);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);
  const isOffline = useUIStore((state) => state.isOffline);

  const prefix = Linking.createURL("/");
  const linking = useMemo(() => createRootLinking(prefix), [prefix]);

  const navigateHome = useCallback(() => {
    setReturnRoute(undefined);
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Home" } }],
    });
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
  }, [hasCompletedOnboarding, isAuthenticated, navigateHome]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const currentTopRoute = rootState.routes[rootState.index]?.name;

    if (!isAuthenticated && currentTopRoute && AUTH_REQUIRED_ROUTES.has(currentTopRoute)) {
      const activeRoute = rootState.routes[rootState.index];
      const mainTabScreen =
        activeRoute.name === "MainTabs" &&
        typeof activeRoute.params === "object" &&
        activeRoute.params &&
        "screen" in activeRoute.params
          ? String(activeRoute.params.screen)
          : "Home";

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
  }, [isAuthenticated, setReturnRoute]);

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
            <RootStack.Screen component={DeveloperLauncherScreen} name="DeveloperLauncher" />
          ) : null}
          <RootStack.Screen component={SplashScreen} name="Splash" />
          <RootStack.Screen component={AuthStack} name="AuthStack" />
          <RootStack.Screen component={OnboardingStack} name="OnboardingStack" />
          <RootStack.Screen component={SwipeableTabNavigator} name="MainTabs" />
          <RootStack.Screen
            component={DishSearchScreen}
            name="SearchHome"
            options={{ animation: "none" }}
          />
          <RootStack.Screen
            component={SearchResultsScreen}
            name="SearchResults"
            options={{ animation: "none" }}
          />
          <RootStack.Screen component={TasteFilterScreen} name="TasteFilter" />
          <RootStack.Screen component={HomeMapScreen} name="DiscoverMap" />
          <RootStack.Screen component={MapZoomedInScreen} name="MapZoomedIn" />
          <RootStack.Screen component={PostComposerScreen} name="Post" />
          <RootStack.Screen component={EditProfileScreen} name="EditProfile" />
          <RootStack.Screen component={FavouritesScreen} name="Favourites" />
          <RootStack.Screen component={ReviewHistoryScreen} name="ReviewHistory" />
          <RootStack.Screen component={SettingsScreen} name="Settings" />
          <RootStack.Screen component={UserProfileScreen} name="UserProfile" />
          <RootStack.Screen component={DishDetailScreen} name="DishDetail" />
          <RootStack.Screen component={StallDetailScreen} name="StallDetail" />
          <RootStack.Screen component={BlogPostRouteScreen} name="BlogPost" />
          <RootStack.Screen component={ReviewStack} name="ReviewStack" />
          <RootStack.Screen component={WheelStack} name="WheelStack" />
          {FEATURE_FLAGS.directMessagesEnabled ? (
            <RootStack.Screen component={DirectMessagesScreen} name="DirectMessages" />
          ) : null}
          {FEATURE_FLAGS.craveEnabled ? (
            <RootStack.Screen component={CraveScreen} name="Crave" />
          ) : null}
          <RootStack.Screen component={MusicSelectionScreen} name="MusicSelection" />
          <RootStack.Screen component={DecideForMeResultScreen} name="DecideForMeResult" />
          <RootStack.Screen component={BuildingDrillDownScreen} name="BuildingDrillDown" />
          <RootStack.Screen component={OfflineStateScreen} name="Offline" />
          <RootStack.Screen component={NotFoundScreen} name="NotFound" />
          {/* V2 Prototypes */}
          <RootStack.Screen component={DiscoverHomeScreenV2} name="DiscoverV2" />
          <RootStack.Screen component={DishSearchScreenV2} name="SearchHomeV2" />
          <RootStack.Screen component={StallDetailScreenV2} name="StallDetailV2" />
          <RootStack.Screen component={BuildingDrillDownScreenV2} name="BuildingDrillDownV2" />
          <RootStack.Screen component={QuickReviewSheetV2} name="QuickReviewV2" />
          <RootStack.Screen component={QuickBitesScreen} name="QuickBites" />
          <RootStack.Screen component={SplashScreenV2} name="SplashV2" />
          <RootStack.Screen component={DesignGalleryScreen} name="DesignGallery" />
          <RootStack.Screen component={MerchantTabs} name="MerchantTabs" />
          <RootStack.Screen component={ReviewFeedScreenV2} name="ReviewFeedV2" />
          <RootStack.Screen component={PostComposerScreenV2} name="PostComposerV2" />
        </RootStack.Navigator>
      </NavigationContainer>
      <GlobalScrollBackButton />
      <QuickReviewModal />
      <ReviewSuccessModal onOpenHistory={() => navigationRef.navigate("ReviewHistory")} />
      <FloatingToast />
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
    height: 40,
    justifyContent: "center",
    position: "absolute",
    width: 40,
  },
});
