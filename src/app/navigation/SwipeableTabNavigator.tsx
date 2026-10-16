import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type {
  MaterialTopTabBarProps,
  MaterialTopTabNavigationProp,
} from "@react-navigation/material-top-tabs";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import { BookOpenText, Compass, House, Plus, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBottomTabItem, Skeleton } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { preloadRoute } from "@/features/navigation/prefetch";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useHungryTheme } from "@/theme";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";

const Tab = createMaterialTopTabNavigator<MainTabParamList>();
const MAIN_TAB_PRELOAD_DISTANCE = 2;
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
      if (!cached) cached = loadModule();
      return cached;
    },
  };
}

const homeScreenLoader = createTabScreenLoader(() => {
  const { HomeFeedScreen } =
    require("@/app/screens/home/HomeFeedScreen") as typeof import("@/app/screens/home/HomeFeedScreen");
  return (() => <HomeFeedScreen mode="social" />) as TabScreenComponent;
});

const discoverScreenLoader = createTabScreenLoader(() => {
  const { DiscoverEntryScreen } =
    require("@/app/screens/discover/DiscoverEntryScreen") as typeof import("@/app/screens/discover/DiscoverEntryScreen");
  return DiscoverEntryScreen as TabScreenComponent;
});

const reviewScreenLoader = createTabScreenLoader(() => {
  const { ReviewFeedScreen } =
    require("@/app/screens/review/ReviewFeedScreen") as typeof import("@/app/screens/review/ReviewFeedScreen");
  return ReviewFeedScreen as TabScreenComponent;
});

const profileScreenLoader = createTabScreenLoader(() => {
  if (FEATURE_FLAGS.release01CoreOnly) {
    const { ReleaseProfileScreen } =
      require("@/app/screens/profile/ReleaseProfileScreen") as typeof import("@/app/screens/profile/ReleaseProfileScreen");
    return ReleaseProfileScreen as TabScreenComponent;
  }
  const { ProfileStack } =
    require("@/app/screens/profile/ProfileStack") as typeof import("@/app/screens/profile/ProfileStack");
  return ProfileStack as TabScreenComponent;
});

const mainTabScreenLoaders = [
  discoverScreenLoader,
  profileScreenLoader,
  ...(FEATURE_FLAGS.socialFeedEnabled ? [homeScreenLoader] : []),
  ...(FEATURE_FLAGS.reviewCreationEnabled ? [reviewScreenLoader] : []),
];

const mainTabScreenLoaderByRouteName: Partial<Record<keyof MainTabParamList, TabScreenLoader>> = {
  Home: FEATURE_FLAGS.socialFeedEnabled ? homeScreenLoader : discoverScreenLoader,
  Discover: discoverScreenLoader,
  Review: FEATURE_FLAGS.reviewCreationEnabled ? reviewScreenLoader : discoverScreenLoader,
  Profile: profileScreenLoader,
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
        { backgroundColor: palette.bg, paddingBottom: spacing[8] },
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
      if (Component) return undefined;
      let cancelled = false;
      const LoadedComponent = loader.load();
      if (!cancelled) setComponent(() => LoadedComponent);
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
    if (cancelled) return;
    const loader = mainTabScreenLoaders[loaderIndex];
    if (!loader) {
      onComplete();
      return;
    }

    cancelCurrentWarmup = scheduleIdleWork(
      () => {
        if (cancelled) return;
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

const HomeWrapper = createDeferredTabScreen(homeScreenLoader);
const DiscoverWrapper = createDeferredTabScreen(discoverScreenLoader);
const ReviewWrapper = createDeferredTabScreen(reviewScreenLoader);
const ProfileWrapper = createDeferredTabScreen(profileScreenLoader);

/**
 * Release builds keep the Home/Review routes registered (many flows reset to
 * `MainTabs > Home`) but hide them from the tab bar. The redirect must stay
 * inert: it renders no Discover instance (that would mount extra
 * CatalogDiscoverHome trees and duplicate catalog requests) and only redirects
 * while focused, so tab preloading can never bounce the user off Profile.
 */
function ReleaseLandingRedirect() {
  const navigation = useNavigation<MaterialTopTabNavigationProp<MainTabParamList>>();

  useFocusEffect(
    useCallback(() => {
      navigation.navigate("Discover");
    }, [navigation]),
  );

  return <TabScreenLoadingPlaceholder />;
}

function CustomTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const styles = createStyles();
  const insets = useSafeAreaInsets();
  const [highlightVisible, setHighlightVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHighlightVisible(true);
    timerRef.current = setTimeout(() => setHighlightVisible(false), 5000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.index, resetTimer]);

  const routeByName = new Map(state.routes.map((route) => [route.name, route]));
  const tabItems = [
    ...(FEATURE_FLAGS.socialFeedEnabled
      ? [{ key: "Home", route: routeByName.get("Home"), icon: House, label: "Home" }]
      : []),
    { key: "Discover", route: routeByName.get("Discover"), icon: Compass, label: "Discover" },
    ...(FEATURE_FLAGS.postCreationEnabled
      ? [{ key: "Create", isCreateAction: true, icon: Plus, label: "Create post" }]
      : []),
    ...(FEATURE_FLAGS.reviewCreationEnabled
      ? [{ key: "Review", route: routeByName.get("Review"), icon: BookOpenText, label: "Review" }]
      : []),
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
        const routeName = route?.name;
        const routeKey = route?.key ?? "create-post-action";
        const routeIndex = route ? state.routes.indexOf(route) : -1;
        const isFocused = !isCreateAction && state.index === routeIndex;

        const onPress = () => {
          if (isCreateAction) {
            rootNavigation?.navigate("Post");
            resetTimer();
            return;
          }

          if (!routeName) return;
          const event = navigation.emit({
            type: "tabPress",
            target: routeKey,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(routeName);
          resetTimer();
        };

        const onPressIn = () => {
          if (isCreateAction) {
            preloadRoute(rootNavigation, "Post");
            return;
          }
          scheduleMainTabRouteWarmup(routeName);
        };

        const Icon = item.icon;
        const currentColor = isFocused && highlightVisible ? palette.orange : palette.textMuted;

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
    const cancelWarmup = scheduleMainTabScreensWarmup(() => setTabPreloadEnabled(true));
    return () => cancelWarmup();
  }, []);

  return (
    <Tab.Navigator
      id="Tabs"
      initialRouteName={FEATURE_FLAGS.socialFeedEnabled ? "Home" : "Discover"}
      tabBarPosition="bottom"
      tabBar={(props: MaterialTopTabBarProps) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: !FEATURE_FLAGS.release01CoreOnly,
        animationEnabled: false,
        lazy: !tabPreloadEnabled,
        lazyPlaceholder: () => <TabScreenLoadingPlaceholder />,
        lazyPreloadDistance: tabPreloadEnabled ? MAIN_TAB_PRELOAD_DISTANCE : 0,
      }}
    >
      <Tab.Screen
        name="Home"
        component={FEATURE_FLAGS.socialFeedEnabled ? HomeWrapper : ReleaseLandingRedirect}
      />
      <Tab.Screen name="Discover" component={DiscoverWrapper} />
      <Tab.Screen
        name="Review"
        component={FEATURE_FLAGS.reviewCreationEnabled ? ReviewWrapper : ReleaseLandingRedirect}
      />
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
