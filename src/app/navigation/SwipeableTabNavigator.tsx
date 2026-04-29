import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { House, Compass, BookOpenText, NotebookPen, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withTiming, withDelay } from "react-native-reanimated";

import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { DiscoverHomeScreen } from "@/app/screens/discover/DiscoverHomeScreen";
import { ReviewScreen } from "@/app/screens/review/ReviewScreen";
import { ReviewFeedScreen } from "@/app/screens/review/ReviewFeedScreen";
import { ProfileStack } from "@/app/screens/profile/ProfileStack";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import type { MainTabParamList } from "./navigationTypes";

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

function HomeWrapper() {
  return <HomeFeedScreen mode="social" />;
}

function ReviewWrapper() {
  return <ReviewFeedScreen />;
}

function RateWrapper(props: any) {
  return <ReviewScreen {...props} />;
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [highlightVisible, setHighlightVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: palette.bg,
          height: 70 + Math.max(insets.bottom, spacing[2]),
          paddingBottom: Math.max(insets.bottom, spacing[2]),
          paddingTop: spacing[4], // Increased top padding
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            // Special handling for protected routes
            if ((route.name === "Rate" || route.name === "Profile") && !isAuthenticated) {
              setReturnRoute(route.name);
              navigation.navigate("AuthStack", { screen: "Login" });
              return;
            }
            if (route.name === "Rate") {
              navigation.getParent()?.navigate("PostComposerV2");
              return;
            }
            navigation.navigate(route.name);
          }
          resetTimer();
        };

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

        const activeColor = palette.orange;
        const inactiveColor = palette.textMuted;
        const currentColor = isFocused && highlightVisible ? activeColor : inactiveColor;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <Icon color={currentColor} size={30} />
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
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeWrapper} />
      <Tab.Screen name="Discover" component={DiscoverHomeScreen} />
      <Tab.Screen name="Review" component={ReviewWrapper} />
      <Tab.Screen name="Rate" component={RateWrapper} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
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
  },
});
