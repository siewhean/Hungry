import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import type { NavigationProp } from "@react-navigation/native";
import { House, Compass, BookOpenText, Plus, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { AppText } from "@/components/ui";
import { preloadRoute } from "@/features/navigation/prefetch";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import type { MainTabParamList, RootStackParamList } from "./navigationTypes";

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

function HomeWrapper() {
  return <HomeFeedScreen mode="social" />;
}

function ReviewWrapper() {
  const { ReviewFeedScreen } =
    require("@/app/screens/review/ReviewFeedScreen") as typeof import("@/app/screens/review/ReviewFeedScreen");
  return <ReviewFeedScreen />;
}

function DiscoverWrapper() {
  const { DiscoverHomeScreen } =
    require("@/app/screens/discover/DiscoverHomeScreen") as typeof import("@/app/screens/discover/DiscoverHomeScreen");
  return <DiscoverHomeScreen />;
}

function ProfileWrapper() {
  const { ProfileStack } =
    require("@/app/screens/profile/ProfileStack") as typeof import("@/app/screens/profile/ProfileStack");
  return <ProfileStack />;
}

function TabLazyPlaceholder() {
  const { palette } = useHungryTheme();
  return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
}

function CustomTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const { componentSizes, palette, radii, spacing } = useHungryTheme();
  const styles = createStyles(componentSizes, spacing);
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
  const routeByName = new Map(state.routes.map((route: any) => [route.name, route]));
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
      {tabItems.map((item: any) => {
        const route = item.route;
        const isCreateAction = item.isCreateAction === true;
        const routeIndex = route ? state.routes.indexOf(route) : -1;
        const isFocused = !isCreateAction && state.index === routeIndex;

        const onPress = () => {
          if (isCreateAction) {
            if (!isAuthenticated) {
              setReturnRoute({ name: "PostComposerV2" });
              rootNavigation?.navigate("AuthStack", { screen: "Login" });
              return;
            }

            rootNavigation?.navigate("PostComposerV2");
            resetTimer();
            return;
          }

          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            // Special handling for protected routes
            if (route.name === "Profile" && !isAuthenticated) {
              setReturnRoute(route.name);
              rootNavigation?.navigate("AuthStack", { screen: "Login" });
              return;
            }
            navigation.navigate(route.name);
          }
          resetTimer();
        };

        const onPressIn = () => {
          if (isCreateAction) {
            preloadRoute(rootNavigation, "PostComposerV2");
            return;
          }
          if (route?.name) {
            preloadRoute(navigation, route.name);
          }
        };

        const Icon = item.icon;

        const activeColor = palette.orange;
        const inactiveColor = palette.textMuted;
        const currentColor = isFocused && highlightVisible ? activeColor : inactiveColor;

        return (
          <Pressable
            key={isCreateAction ? "create-post-action" : route.key}
            onPress={onPress}
            onPressIn={onPressIn}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={item.label}
          >
            <View
              style={
                isCreateAction
                  ? [
                      styles.createButton,
                      {
                        backgroundColor: palette.orange,
                        borderRadius: radii.pill,
                      },
                    ]
                  : styles.iconSlot
              }
            >
              <Icon
                color={isCreateAction ? palette.white : currentColor}
                size={componentSizes.bottomTabIcon}
              />
            </View>
            {isCreateAction ? null : (
              <AppText
                variant="micro"
                numberOfLines={1}
                style={{
                  color: currentColor,
                  fontSize: componentSizes.bottomTabLabelFontSize,
                  fontWeight: isFocused ? "800" : "700",
                  lineHeight: componentSizes.bottomTabLabelLineHeight,
                }}
              >
                {item.label}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwipeableTabNavigator() {
  return (
    <Tab.Navigator
      id="Tabs"
      tabBarPosition="bottom"
      tabBar={(props: MaterialTopTabBarProps) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: false,
        lazy: true,
        lazyPlaceholder: TabLazyPlaceholder,
        lazyPreloadDistance: 0,
      }}
    >
      <Tab.Screen name="Home" component={HomeWrapper} />
      <Tab.Screen name="Discover" component={DiscoverWrapper} />
      <Tab.Screen name="Review" component={ReviewWrapper} />
      <Tab.Screen name="Profile" component={ProfileWrapper} />
    </Tab.Navigator>
  );
}

const createStyles = (
  componentSizes: ReturnType<typeof useHungryTheme>["componentSizes"],
  spacing: ReturnType<typeof useHungryTheme>["spacing"],
) =>
  StyleSheet.create({
    tabBarContainer: {
      flexDirection: "row",
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing[0.5],
    },
    iconSlot: {
      alignItems: "center",
      height: componentSizes.bottomTabIconSlotHeight,
      justifyContent: "center",
      width: componentSizes.bottomTabIconSlotWidth,
    },
    createButton: {
      alignItems: "center",
      height: componentSizes.bottomTabCreateButton,
      justifyContent: "center",
      width: componentSizes.bottomTabCreateButton,
    },
  });
