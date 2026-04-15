import * as Linking from "expo-linking";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
  type Theme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import {
  ArrowLeft,
  Compass,
  House,
  NotebookPen,
  User,
  BookOpenText,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { DeveloperLauncherScreen } from "@/app/screens/dev/DeveloperLauncherScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { DishDetailScreen } from "@/app/screens/detail/DishDetailScreen";
import { NotFoundScreen } from "@/app/screens/detail/NotFoundScreen";
import { OfflineStateScreen } from "@/app/screens/detail/OfflineStateScreen";
import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { BuildingDrillDownScreen } from "@/app/screens/discover/BuildingDrillDownScreen";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { DiscoverHomeScreen } from "@/app/screens/discover/DiscoverHomeScreen";
import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { MapZoomedInScreen } from "@/app/screens/discover/MapZoomedInScreen";
import { CraveScreen } from "@/app/screens/discover/CraveScreen";
import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { DirectMessagesScreen } from "@/app/screens/home/DirectMessagesScreen";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { PostComposerScreen } from "@/app/screens/post/PostComposerScreen";
import { EditProfileScreen } from "@/app/screens/profile/EditProfileScreen";
import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import { ProfileStack } from "@/app/screens/profile/ProfileStack";
import { ReviewHistoryScreen } from "@/app/screens/profile/ReviewHistoryScreen";
import { SettingsScreen } from "@/app/screens/profile/SettingsScreen";
import { UserProfileScreen } from "@/app/screens/profile/UserProfileScreen";
import { BlogPostWebViewScreen } from "@/app/screens/reads/BlogPostWebViewScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { ReviewSuccessModal } from "@/app/screens/review/ReviewSuccessModal";
import { QuickReviewModal } from "@/app/screens/review/QuickReviewModal";
import { WheelStack } from "@/app/screens/wheel/WheelStack";
import { DishSearchScreen } from "@/app/screens/search/DishSearchScreen";
import { SearchResultsScreen } from "@/app/screens/search/SearchResultsScreen";
import { TasteFilterScreen } from "@/app/screens/search/TasteFilterScreen";
import { FloatingToast } from "@/components/ui";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const AUTH_REQUIRED_ROUTES = new Set([
  "MainTabs",
  "SearchHome",
  "SearchResults",
  "MapZoomedIn",
  "Post",
  "EditProfile",
  "BuildingDrillDown",
  "DecideForMeResult",
  "TasteFilter",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "DishDetail",
  "StallDetail",
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
  const rootState = navigationRef.isReady()
    ? navigationRef.getRootState()
    : undefined;
  const rootRouteName = rootState
    ? rootState.routes[rootState.index]?.name
    : undefined;

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

function TabNavigator() {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: palette.orange,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopWidth: 0,
          borderTopColor: "transparent",
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
          height: 60 + Math.max(insets.bottom, spacing[2]),
          paddingBottom: Math.max(insets.bottom, spacing[2]),
          paddingTop: spacing[2],
        },
        tabBarIcon: ({ color, size }) => {
          const Icon =
            route.name === "Home"
              ? House
              : route.name === "Discover"
                ? Compass
                : route.name === "Review"
                  ? BookOpenText
                  : route.name === "Rate"
                    ? NotebookPen
                    : User;

          return <Icon color={color} size={Math.max(size + 7, 30)} />;
        },
      })}
    >
      <Tabs.Screen name="Home">
        {() => <HomeFeedScreen mode="social" />}
      </Tabs.Screen>
      <Tabs.Screen component={DiscoverHomeScreen} name="Discover" />
      <Tabs.Screen name="Review">
        {() => <HomeFeedScreen mode="review" />}
      </Tabs.Screen>
      <Tabs.Screen
        component={ReviewStack}
        listeners={{
          tabPress: (event) => {
            if (!isAuthenticated) {
              event.preventDefault();
              setReturnRoute("Rate");
              if (navigationRef.isReady()) {
                navigationRef.navigate("AuthStack", { screen: "Login" });
              }
            }
          },
        }}
        name="Rate"
      />
      <Tabs.Screen
        component={ProfileStack}
        listeners={{
          tabPress: (event) => {
            if (!isAuthenticated) {
              event.preventDefault();
              setReturnRoute("Profile");
              if (navigationRef.isReady()) {
                navigationRef.navigate("AuthStack", { screen: "Login" });
              }
            }
          },
        }}
        name="Profile"
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator({ theme }: { theme: Theme }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const hasCompletedOnboarding = useSessionStore(
    (state) => state.hasCompletedOnboarding,
  );
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const dismissSessionExpiry = useSessionStore(
    (state) => state.dismissSessionExpiry,
  );
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);

  const prefix = Linking.createURL("/");
  const linking = useMemo(
    () => ({
      prefixes: [prefix, "hungry://", "https://hungry.sg"],
      config: {
        screens: {
          WheelStack: {
            path: "join/:code",
            screens: {
              WheelHome: "",
            },
          },
        },
      },
    }),
    [prefix],
  );

  const navigateHome = () => {
    setReturnRoute(undefined);
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Home" } }],
    });
  };

  const openResolvedRoute = (returnRoute?: string | PendingRoute) => {
    setReturnRoute(undefined);

    if (returnRoute && typeof returnRoute !== "string") {
      navigationRef.resetRoot({
        index: 0,
        routes: [returnRoute as never],
      });
      return;
    }

    if (returnRoute === "Post") {
      navigationRef.resetRoot({
        index: 1,
        routes: [
          { name: "MainTabs", params: { screen: "Home" } },
          { name: "Post" },
        ],
      });
      return;
    }

    if (
      returnRoute === "EditProfile" ||
      returnRoute === "Favourites" ||
      returnRoute === "ReviewHistory" ||
      returnRoute === "Settings"
    ) {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: returnRoute }],
      });
      return;
    }

    if (
      returnRoute === "Profile" ||
      returnRoute === "Review" ||
      returnRoute === "Rate" ||
      returnRoute === "Home"
    ) {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: returnRoute } }],
      });
      return;
    }

    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Home" } }],
    });
  };

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
          routes: [
            { name: "OnboardingStack", params: { screen: "OnboardingIntro1" } },
          ],
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
  }, [hasCompletedOnboarding, isAuthenticated]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const currentTopRoute = rootState.routes[rootState.index]?.name;

    if (
      !isAuthenticated &&
      currentTopRoute &&
      AUTH_REQUIRED_ROUTES.has(currentTopRoute)
    ) {
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
          initialRouteName={__DEV__ ? "DeveloperLauncher" : "Splash"}
          screenOptions={{ headerShown: false }}
        >
          {__DEV__ ? (
            <RootStack.Screen
              component={DeveloperLauncherScreen}
              name="DeveloperLauncher"
            />
          ) : null}
          <RootStack.Screen component={SplashScreen} name="Splash" />
          <RootStack.Screen component={AuthStack} name="AuthStack" />
          <RootStack.Screen
            component={OnboardingStack}
            name="OnboardingStack"
          />
          <RootStack.Screen component={TabNavigator} name="MainTabs" />
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
          <RootStack.Screen
            component={ReviewHistoryScreen}
            name="ReviewHistory"
          />
          <RootStack.Screen component={SettingsScreen} name="Settings" />
          <RootStack.Screen component={UserProfileScreen} name="UserProfile" />
          <RootStack.Screen component={DishDetailScreen} name="DishDetail" />
          <RootStack.Screen component={StallDetailScreen} name="StallDetail" />
          <RootStack.Screen component={BlogPostRouteScreen} name="BlogPost" />
          <RootStack.Screen component={ReviewStack} name="ReviewStack" />
          <RootStack.Screen component={WheelStack} name="WheelStack" />
          {FEATURE_FLAGS.directMessagesEnabled ? (
            <RootStack.Screen
              component={DirectMessagesScreen}
              name="DirectMessages"
            />
          ) : null}
          {FEATURE_FLAGS.craveEnabled ? (
            <RootStack.Screen component={CraveScreen} name="Crave" />
          ) : null}
          <RootStack.Screen
            component={DecideForMeResultScreen}
            name="DecideForMeResult"
          />
          <RootStack.Screen
            component={BuildingDrillDownScreen}
            name="BuildingDrillDown"
          />
          <RootStack.Screen component={OfflineStateScreen} name="Offline" />
          <RootStack.Screen component={NotFoundScreen} name="NotFound" />
        </RootStack.Navigator>
      </NavigationContainer>
      <GlobalScrollBackButton />
      <QuickReviewModal />
      <ReviewSuccessModal
        onOpenHistory={() => navigationRef.navigate("ReviewHistory")}
      />
      <FloatingToast />
    </>
  );
}

const styles = StyleSheet.create({
  globalBackWrap: {
    ...StyleSheet.absoluteFillObject,
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
