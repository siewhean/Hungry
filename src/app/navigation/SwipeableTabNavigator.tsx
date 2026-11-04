import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import type {
  MaterialTopTabBarProps,
  MaterialTopTabNavigationProp,
} from "@react-navigation/material-top-tabs";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
} from "@react-navigation/native";
import { BookOpenText, House, Newspaper, PenLine, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PostTabPage } from "@/components/review/PostTabPage";
import { AppBottomTabItem, Skeleton } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { preloadRoute } from "@/features/navigation/prefetch";
import { mainTabOrder } from "@/features/navigation/swipeIntent";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useSessionStore } from "@/store/useSessionStore";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useHungryTheme } from "@/theme";
import { createEdgeSwipeTabNavigator } from "./EdgeSwipeTabs";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";
import { tabBarBottomPadding } from "./tabBarMetrics";

const Tab = createEdgeSwipeTabNavigator<MainTabParamList>();
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
  return HomeFeedScreen as TabScreenComponent;
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

const MAIN_TAB_ORDER = mainTabOrder({
  socialFeedEnabled: FEATURE_FLAGS.socialFeedEnabled,
  reviewCreationEnabled: FEATURE_FLAGS.reviewCreationEnabled,
});

/**
 * Opens the Post card (the review composer) from the bottom, the way the Post button does. A
 * guest signs in first and lands on the composer afterwards.
 */
function useOpenCreateReview() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>() ?? navigation;
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  return useCallback(() => {
    if (!isAuthenticated) {
      setReturnRoute({ name: "ReviewStack", params: { screen: "ReviewMain" } });
      rootNavigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    rootNavigation.navigate("ReviewStack", { screen: "ReviewMain" });
  }, [isAuthenticated, rootNavigation, setReturnRoute]);
}

function createDeferredTabScreen(loader: TabScreenLoader) {
  function DeferredTabScreen(props: object) {
    const [Component, setComponent] = useState<TabScreenComponent | null>(() => loader.getCached());
    const route = useRoute();

    useEffect(() => {
      if (Component) return undefined;
      let cancelled = false;
      const LoadedComponent = loader.load();
      if (!cancelled) setComponent(() => LoadedComponent);
      return () => {
        cancelled = true;
      };
    }, [Component, loader]);

    return (
      <View style={styles.tabPage}>
        {Component ? <Component {...props} /> : <TabScreenLoadingPlaceholder />}
      </View>
    );
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

/** The Post page in the swipe order; its button opens the review card, like the Post button. */
function CreateWrapper() {
  const openCreateReview = useOpenCreateReview();
  return (
    <View style={styles.tabPage}>
      <PostTabPage onStart={openCreateReview} />
    </View>
  );
}

/**
 * Release builds keep the Home/Review routes registered (many flows reset to
 * `MainTabs > Home`) but hide them from the tab bar. The redirect must stay
 * inert: it renders no Discover instance (that would mount extra
 * Home trees and duplicate feed requests) and only redirects
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
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();

  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const routeByName = new Map(state.routes.map((route) => [route.name, route]));
  // Discover is the home page; the social posts feed (the "Home" route) is the Feed tab.
  // The middle button writes a review; it looks like any other tab.
  const tabItems = [
    { key: "Discover", route: routeByName.get("Discover"), icon: House, label: "Home" },
    ...(FEATURE_FLAGS.socialFeedEnabled
      ? [{ key: "Home", route: routeByName.get("Home"), icon: Newspaper, label: "Feed" }]
      : []),
    ...(FEATURE_FLAGS.reviewCreationEnabled
      ? [{ key: "Create", isCreateAction: true, icon: PenLine, label: "Post" }]
      : []),
    ...(FEATURE_FLAGS.reviewCreationEnabled
      ? [{ key: "Review", route: routeByName.get("Review"), icon: BookOpenText, label: "Reviews" }]
      : []),
    { key: "Profile", route: routeByName.get("Profile"), icon: User, label: "Profile" },
  ].filter((item) => item.isCreateAction || item.route);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: palette.bg,
          height: componentSizes.bottomTabBar + tabBarBottomPadding(insets.bottom, spacing[2]),
          paddingBottom: tabBarBottomPadding(insets.bottom, spacing[2]),
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
        // The Post button reads as selected while the Post page is on show (reached by a swipe).
        const isFocused = isCreateAction
          ? state.routes[state.index]?.name === "Create"
          : state.index === routeIndex;

        const onPress = () => {
          if (isCreateAction) {
            if (!isAuthenticated) {
              setReturnRoute({ name: "ReviewStack", params: { screen: "ReviewMain" } });
              rootNavigation?.navigate("AuthStack", { screen: "Login" });
              return;
            }

            rootNavigation?.navigate("ReviewStack", { screen: "ReviewMain" });
            return;
          }

          if (!routeName) return;
          const event = navigation.emit({
            type: "tabPress",
            target: routeKey,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            // Defensive: tabs only mount with a session (mandatory sign-in).
            if (routeName === "Profile" && !isAuthenticated) {
              setReturnRoute(routeName);
              rootNavigation?.navigate("AuthStack", { screen: "Login" });
              return;
            }
            navigation.navigate(routeName);
          }
        };

        const onPressIn = () => {
          if (isCreateAction) {
            preloadRoute(rootNavigation, "ReviewStack", { screen: "ReviewMain" });
            return;
          }
          scheduleMainTabRouteWarmup(routeName);
        };

        const Icon = item.icon;

        return (
          <AppBottomTabItem
            key={routeKey}
            accessibilityLabel={isCreateAction ? "Post a review" : item.label}
            createAction={isCreateAction}
            focused={isFocused}
            icon={Icon}
            label={item.label}
            onPress={onPress}
            onPressIn={onPressIn}
          />
        );
      })}
    </View>
  );
}

export function SwipeableTabNavigator() {
  const reduceMotion = useReduceMotion();
  const [tabPreloadEnabled, setTabPreloadEnabled] = useState(false);

  useEffect(() => {
    const cancelWarmup = scheduleMainTabScreensWarmup(() => setTabPreloadEnabled(true));
    return () => cancelWarmup();
  }, []);

  return (
    <Tab.Navigator
      id="Tabs"
      initialRouteName="Discover"
      tabBar={(props: MaterialTopTabBarProps) => <CustomTabBar {...props} />}
      // The pages in the swipe order come first; a route that only redirects sits after them, so a
      // drag never uncovers it. Edge swipes drag the pages along; the tab bar switches at once.
      pageCount={MAIN_TAB_ORDER.length}
      mountAllPages={tabPreloadEnabled}
      reduceMotion={reduceMotion}
    >
      <Tab.Screen name="Discover" component={DiscoverWrapper} />
      {/* The social posts feed. Its photo carousels own horizontal swipes, so only the edges page. */}
      {FEATURE_FLAGS.socialFeedEnabled ? <Tab.Screen name="Home" component={HomeWrapper} /> : null}
      {FEATURE_FLAGS.reviewCreationEnabled ? (
        <Tab.Screen name="Create" component={CreateWrapper} />
      ) : null}
      {FEATURE_FLAGS.reviewCreationEnabled ? (
        <Tab.Screen name="Review" component={ReviewWrapper} />
      ) : null}
      <Tab.Screen name="Profile" component={ProfileWrapper} />
      {FEATURE_FLAGS.socialFeedEnabled ? null : (
        <Tab.Screen name="Home" component={ReleaseLandingRedirect} />
      )}
      {FEATURE_FLAGS.reviewCreationEnabled ? null : (
        <Tab.Screen name="Review" component={ReleaseLandingRedirect} />
      )}
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
  tabPage: { flex: 1 },
  loadingPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
