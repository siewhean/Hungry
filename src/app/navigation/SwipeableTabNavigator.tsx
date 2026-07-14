import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import type { NavigationProp } from "@react-navigation/native";
import { House, Compass, BookOpenText, Plus, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { AppBottomTabItem, Skeleton } from "@/components/ui";
import { preloadRoute } from "@/features/navigation/prefetch";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";

const Tab = createMaterialTopTabNavigator<MainTabParamList>();
const MAIN_TAB_PRELOAD_DISTANCE = 3;
const MAIN_TAB_WARMUP_TIMEOUT_MS = 350;
const MAIN_TAB_WARMUP_FALLBACK_DELAY_MS = 120;
const MAIN_TAB_INTENT_WARMUP_FALLBACK_DELAY_MS = 0;

type TabScreenComponent = React.ComponentType<object>;

interface TabScreenLoader {
  getCached: () => TabScreenComponent | null;
  load: () => TabScreenComponent;
}

function createTabScreenLoader(loadModule: () => TabScreenComponent): TabScreenLoader {
  let cached: TabScreenComponent | null = null;

  return {
    getCached: () => cached,
    load: () => {
      if (!cached) {
        cached = loadModule();
      }
      return cached;
    },
  };
}

const reviewScreenLoader = createTabScreenLoader(() => {
  const { ReviewFeedScreen } =
    require("@/app/screens/review/ReviewFeedScreen") as typeof import("@/app/screens/review/ReviewFeedScreen");
  return ReviewFeedScreen as TabScreenComponent;
});

const discoverScreenLoader = createTabScreenLoader(() => {
  const { DiscoverHomeScreen } =
    require("@/app/screens/discover/DiscoverHomeScreen") as typeof import("@/app/screens/discover/DiscoverHomeScreen");
  return DiscoverHomeScreen as TabScreenComponent;
});

const profileStackLoader = createTabScreenLoader(() => {
  const { ProfileStack } =
    require("@/app/screens/profile/ProfileStack") as typeof import("@/app/screens/profile/ProfileStack");
  return ProfileStack as TabScreenComponent;
});

const mainTabScreenLoaders = [discoverScreenLoader, reviewScreenLoader, profileStackLoader];
const mainTabScreenLoaderByRouteName: Partial<Record<keyof MainTabParamList, TabScreenLoader>> = {
  Discover: discoverScreenLoader,
  Review: reviewScreenLoader,
  Profile: profileStackLoader,
};

function warmMainTabRoute(routeName?: string) {
  const loader = routeName
    ? mainTabScreenLoaderByRouteName[routeName as keyof MainTabParamList]
    : undefined;
  loader?.load();
}

function scheduleMainTabRouteWarmup(routeName?: string) {
  return scheduleIdleWork(() => warmMainTabRoute(routeName), {
    timeout: MAIN_TAB_WARMUP_TIMEOUT_MS,
    fallbackDelayMs: MAIN_TAB_INTENT_WARMUP_FALLBACK_DELAY_MS,
  });
}

function TabScreenLoadingPlaceholder() {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <View
      style={[
        styles.loadingPlaceholder,
        {
          backgroundColor: palette.bg,
          paddingBottom: spacing[8],
        },
      ]}
    >
      <View style={{ gap: spacing[5], width: "100%" }}>
        <View style={{ gap: spacing[2], paddingHorizontal: spacing[4] }}>
          <Skeleton width="46%" height={28} borderRadius={radii.sm} />
          <Skeleton width="100%" height={52} borderRadius={radii.lg} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <Skeleton width={108} height={44} borderRadius={radii.pill} />
          <Skeleton width={136} height={44} borderRadius={radii.pill} />
          <Skeleton width={96} height={44} borderRadius={radii.pill} />
        </View>
        <View style={{ gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <Skeleton width="56%" height={24} borderRadius={radii.sm} />
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Skeleton width={156} height={150} borderRadius={radii.lg} />
            <Skeleton width={156} height={150} borderRadius={radii.lg} />
          </View>
        </View>
      </View>
    </View>
  );
}

function createDeferredTabScreen(loader: TabScreenLoader) {
  function DeferredTabScreen(props: object) {
    const [Component, setComponent] = useState<TabScreenComponent | null>(() => loader.getCached());

    useEffect(() => {
      if (Component) {
        return undefined;
      }

      let cancelled = false;
      const LoadedComponent = loader.load();
      if (!cancelled) {
        setComponent(() => LoadedComponent);
      }

      return () => {
        cancelled = true;
      };
    }, [Component, loader]);

    return Component ? <Component {...props} /> : <TabScreenLoadingPlaceholder />;
  }

  DeferredTabScreen.displayName = "DeferredTabScreen";
  return DeferredTabScreen;
}

function scheduleMainTabScreensWarmup(onComplete: () => void) {
  let cancelled = false;
  let cancelCurrentWarmup: (() => void) | undefined;
  let loaderIndex = 0;

  const warmNextLoader = () => {
    if (cancelled) {
      return;
    }

    const loader = mainTabScreenLoaders[loaderIndex];
    if (!loader) {
      onComplete();
      return;
    }

    cancelCurrentWarmup = scheduleIdleWork(
      () => {
        if (cancelled) {
          return;
        }

        loader.load();
        loaderIndex += 1;
        warmNextLoader();
      },
      {
        timeout: MAIN_TAB_WARMUP_TIMEOUT_MS,
        fallbackDelayMs: MAIN_TAB_WARMUP_FALLBACK_DELAY_MS,
      },
    );
  };

  warmNextLoader();

  return () => {
    cancelled = true;
    cancelCurrentWarmup?.();
  };
}

function HomeWrapper() {
  return <HomeFeedScreen mode="social" />;
}

const ReviewWrapper = createDeferredTabScreen(reviewScreenLoader);
const DiscoverWrapper = createDeferredTabScreen(discoverScreenLoader);
const ProfileWrapper = createDeferredTabScreen(profileStackLoader);

function CustomTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const styles = createStyles();
  const insets = useSafeAreaInsets();
  const [highlightVisible, setHighlightVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHighlightVisible(true);
    timerRef.current = setTimeout(() => {
      setHighlightVisible(false);
    }, 5000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.index, resetTimer]);

  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const routeByName = new Map(state.routes.map((route) => [route.name, route]));
  const composerRoute = FEATURE_FLAGS.prototypeRoutesEnabled ? "PostComposerV2" : "Post";
  const tabItems = [
    { key: "Home", route: routeByName.get("Home"), icon: House, label: "Home" },
    { key: "Discover", route: routeByName.get("Discover"), icon: Compass, label: "Discover" },
    { key: "Create", isCreateAction: true, icon: Plus, label: "Create post" },
    { key: "Review", route: routeByName.get("Review"), icon: BookOpenText, label: "Review" },
    { key: "Profile", route: routeByName.get("Profile"), icon: User, label: "Profile" },
  ].filter((item) => item.isCreateAction || item.route);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: palette.bg,
          height: componentSizes.bottomTabBar + Math.max(insets.bottom, spacing[2]),
          paddingBottom: Math.max(insets.bottom, spacing[2]),
          paddingTop: spacing[2],
        },
      ]}
    >
      {tabItems.map((item) => {
        const route = item.route;
        const isCreateAction = item.isCreateAction === true;
        if (!isCreateAction && !route) {
          return null;
        }
        const routeName = route?.name;
        const routeKey = route?.key ?? "create-post-action";
        const routeIndex = route ? state.routes.indexOf(route) : -1;
        const isFocused = !isCreateAction && state.index === routeIndex;

        const onPress = () => {
          if (isCreateAction) {
            if (!isAuthenticated) {
              setReturnRoute({ name: composerRoute });
              rootNavigation?.navigate("AuthStack", { screen: "Login" });
              return;
            }

            if (composerRoute === "PostComposerV2") {
              rootNavigation?.navigate("PostComposerV2");
            } else {
              rootNavigation?.navigate("Post");
            }
            resetTimer();
            return;
          }

          if (!routeName) {
            return;
          }

          const event = navigation.emit({
            type: "tabPress",
            target: routeKey,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            // Special handling for protected routes
            if (routeName === "Profile" && !isAuthenticated) {
              setReturnRoute(routeName);
              rootNavigation?.navigate("AuthStack", { screen: "Login" });
              return;
            }
            navigation.navigate(routeName);
          }
          resetTimer();
        };

        const onPressIn = () => {
          if (isCreateAction) {
            preloadRoute(rootNavigation, composerRoute);
            return;
          }
          // Module loading is synchronous in React Native. Keep it off the
          // touch-down path so switching tabs always responds immediately.
          scheduleMainTabRouteWarmup(routeName);
        };

        const Icon = item.icon;

        const activeColor = palette.orange;
        const inactiveColor = palette.textMuted;
        const currentColor = isFocused && highlightVisible ? activeColor : inactiveColor;

        return (
          <AppBottomTabItem
            key={routeKey}
            accessibilityLabel={item.label}
            color={currentColor}
            createAction={isCreateAction}
            focused={isFocused}
            icon={Icon}
            label={item.label}
            onPress={onPress}
            onPressIn={onPressIn}
            showLabel={!isCreateAction}
          />
        );
      })}
    </View>
  );
}

export function SwipeableTabNavigator() {
  const [tabPreloadEnabled, setTabPreloadEnabled] = useState(false);

  useEffect(() => {
    const cancelWarmup = scheduleMainTabScreensWarmup(() => {
      setTabPreloadEnabled(true);
    });

    return () => {
      cancelWarmup();
    };
  }, []);

  return (
    <Tab.Navigator
      id="Tabs"
      tabBarPosition="bottom"
      tabBar={(props: MaterialTopTabBarProps) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: false,
        lazy: !tabPreloadEnabled,
        lazyPlaceholder: () => <TabScreenLoadingPlaceholder />,
        lazyPreloadDistance: tabPreloadEnabled ? MAIN_TAB_PRELOAD_DISTANCE : 0,
      }}
    >
      <Tab.Screen name="Home" component={HomeWrapper} />
      <Tab.Screen name="Discover" component={DiscoverWrapper} />
      <Tab.Screen name="Review" component={ReviewWrapper} />
      <Tab.Screen name="Profile" component={ProfileWrapper} />
    </Tab.Navigator>
  );
}

const createStyles = () =>
  StyleSheet.create({
    tabBarContainer: {
      flexDirection: "row",
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
    },
  });

const styles = StyleSheet.create({
  loadingPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
