import { useEffect } from "react";
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
import { Compass, House, MapPinned, NotebookPen, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { DeveloperLauncherScreen } from "@/app/screens/dev/DeveloperLauncherScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { DishDetailScreen } from "@/app/screens/detail/DishDetailScreen";
import { NotFoundScreen } from "@/app/screens/detail/NotFoundScreen";
import { OfflineStateScreen } from "@/app/screens/detail/OfflineStateScreen";
import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { DiscoverHomeScreen } from "@/app/screens/discover/DiscoverHomeScreen";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { BuildingDrillDownScreen } from "@/app/screens/discover/BuildingDrillDownScreen";
import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { MapZoomedInScreen } from "@/app/screens/discover/MapZoomedInScreen";
import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { PostComposerScreen } from "@/app/screens/post/PostComposerScreen";
import { EditProfileScreen } from "@/app/screens/profile/EditProfileScreen";
import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import { ProfileStack } from "@/app/screens/profile/ProfileStack";
import { ReviewHistoryScreen } from "@/app/screens/profile/ReviewHistoryScreen";
import { SettingsScreen } from "@/app/screens/profile/SettingsScreen";
import { BlogPostWebViewScreen } from "@/app/screens/reads/BlogPostWebViewScreen";
import { ReadsFeedScreen } from "@/app/screens/reads/ReadsFeedScreen";
import { ReviewSuccessModal } from "@/app/screens/review/ReviewSuccessModal";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { DishSearchScreen } from "@/app/screens/search/DishSearchScreen";
import { SearchResultsScreen } from "@/app/screens/search/SearchResultsScreen";
import { FloatingToast } from "@/components/ui";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
const AUTH_REQUIRED_ROUTES = new Set([
  "MainTabs",
  "SearchHome",
  "SearchResults",
  "ReadsFeed",
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

function DeferredRouteScreen({
  navigation,
  title,
  body,
}: {
  navigation: NativeStackScreenProps<RootStackParamList, "NotFound">["navigation"];
  title: string;
  body: string;
}) {
  return (
    <NotFoundScreen
      navigation={navigation}
      route={{
        key: `${title}-deferred`,
        name: "NotFound",
        params: { title, body },
      }}
    />
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
        tabBarActiveTintColor: palette.orange,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
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
                : route.name === "Maps"
                  ? MapPinned
                  : route.name === "Review"
                    ? NotebookPen
                    : User;
          return <Icon color={color} size={size} />;
        },
      })}
    >
      <Tabs.Screen component={HomeFeedScreen} name="Home" />
      <Tabs.Screen component={DiscoverHomeScreen} name="Discover" />
      <Tabs.Screen component={HomeMapScreen} name="Maps" />
      <Tabs.Screen
        component={ReviewStack}
        listeners={{
          tabPress: (event) => {
            if (!isAuthenticated) {
              event.preventDefault();
              setReturnRoute("Review");
              if (navigationRef.isReady()) {
                navigationRef.navigate("AuthStack", { screen: "Login" });
              }
            }
          },
        }}
        name="Review"
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
  useAppBootstrap();

  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const dismissSessionExpiry = useSessionStore((state) => state.dismissSessionExpiry);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);

  const openResolvedRoute = (returnRoute?: string | PendingRoute) => {
    setReturnRoute(undefined);

    if (returnRoute && typeof returnRoute !== "string") {
      navigationRef.resetRoot({
        index: 0,
        routes: [returnRoute as never],
      });
      return;
    }

    if (returnRoute === "ReadsFeed") {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "ReadsFeed" }],
      });
      return;
    }

    if (returnRoute === "Post") {
      navigationRef.resetRoot({
        index: 1,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }, { name: "Post" }],
      });
      return;
    }

    if (returnRoute === "EditProfile" || returnRoute === "Favourites" || returnRoute === "ReviewHistory" || returnRoute === "Settings") {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: returnRoute }],
      });
      return;
    }

    if (returnRoute === "Profile" || returnRoute === "Review" || returnRoute === "Home" || returnRoute === "Maps") {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: returnRoute } }],
      });
      return;
    }

    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Discover" } }],
    });
  };

  useEffect(() => {
    if (sessionExpired && navigationRef.isReady()) {
      setReturnRoute("Discover");
      navigationRef.navigate("AuthStack", {
        screen: "Login",
      });
      dismissSessionExpiry();
    }
  }, [dismissSessionExpiry, sessionExpired, setReturnRoute]);

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const currentTopRoute = rootState.routes[rootState.index]?.name;
    const pendingRoute = useSessionStore.getState().returnRoute;

    if (currentTopRoute === "AuthStack") {
      if (isAuthenticated && !hasCompletedOnboarding) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: "OnboardingStack", params: { screen: "OnboardingIntro1" } }],
        });
        return;
      }

      if (isAuthenticated && hasCompletedOnboarding) {
        openResolvedRoute(pendingRoute);
      }
    }

    if (currentTopRoute === "OnboardingStack" && hasCompletedOnboarding) {
      openResolvedRoute(pendingRoute);
    }
  }, [hasCompletedOnboarding, isAuthenticated]);

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
          : "Discover";

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
      <NavigationContainer ref={navigationRef} theme={theme}>
        <RootStack.Navigator
          initialRouteName={__DEV__ ? "DeveloperLauncher" : "Splash"}
          screenOptions={{ headerShown: false }}
        >
          <RootStack.Screen component={DeveloperLauncherScreen} name="DeveloperLauncher" />
          <RootStack.Screen component={SplashScreen} name="Splash" />
          <RootStack.Screen component={AuthStack} name="AuthStack" />
          <RootStack.Screen component={OnboardingStack} name="OnboardingStack" />
          <RootStack.Screen component={TabNavigator} name="MainTabs" />
          <RootStack.Screen component={DishSearchScreen} name="SearchHome" />
          <RootStack.Screen component={SearchResultsScreen} name="SearchResults" />
          <RootStack.Screen component={ReadsFeedScreen} name="ReadsFeed" />
          <RootStack.Screen component={MapZoomedInScreen} name="MapZoomedIn" />
          <RootStack.Screen component={PostComposerScreen} name="Post" />
          <RootStack.Screen component={EditProfileScreen} name="EditProfile" />
          <RootStack.Screen component={FavouritesScreen} name="Favourites" />
          <RootStack.Screen component={ReviewHistoryScreen} name="ReviewHistory" />
          <RootStack.Screen component={SettingsScreen} name="Settings" />
          <RootStack.Screen component={DishDetailScreen} name="DishDetail" />
          <RootStack.Screen component={StallDetailScreen} name="StallDetail" />
          <RootStack.Screen component={BlogPostRouteScreen} name="BlogPost" />
          <RootStack.Screen component={ReviewStack} name="ReviewStack" />
          <RootStack.Screen component={DecideForMeResultScreen} name="DecideForMeResult" />
          <RootStack.Screen
            name="TasteFilter"
            children={({ navigation }) => (
              <DeferredRouteScreen
                navigation={navigation}
                title="Taste filters are deferred"
                body="This build keeps search results without a dedicated taste-filter route."
              />
            )}
          />
          <RootStack.Screen component={BuildingDrillDownScreen} name="BuildingDrillDown" />
          <RootStack.Screen component={OfflineStateScreen} name="Offline" />
          <RootStack.Screen component={NotFoundScreen} name="NotFound" />
        </RootStack.Navigator>
      </NavigationContainer>
      <ReviewSuccessModal onOpenHistory={() => navigationRef.navigate("ReviewHistory")} />
      <FloatingToast />
    </>
  );
}
