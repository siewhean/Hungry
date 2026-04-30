import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LayoutDashboard, UtensilsCrossed, BarChart3, Store } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHungryTheme } from "@/theme";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { MerchantAnalyticsScreen } from "@/app/screens/merchant/MerchantAnalyticsScreen";
import { MerchantProfileScreen } from "@/app/screens/merchant/MerchantProfileScreen";
import { VerificationCentreScreen } from "@/app/screens/merchant/VerificationCentreScreen";
import { HomeBasedVerificationScreen } from "@/app/screens/merchant/HomeBasedVerificationScreen";
import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { BusinessProfileEditorScreen } from "@/app/screens/merchant/BusinessProfileEditorScreen";
import DishEditorScreen from "@/app/screens/merchant/DishEditorScreen";
import { OCRDraftScreen } from "@/app/screens/merchant/OCRDraftScreen";
import { PromotionListScreen } from "@/app/screens/merchant/PromotionListScreen";
import { PromotionBuilderScreen } from "@/app/screens/merchant/PromotionBuilderScreen";
import { AIAssistantScreen } from "@/app/screens/merchant/AIAssistantScreen";
import { OrdersComingSoonScreen } from "@/app/screens/merchant/OrdersComingSoonScreen";
import { MerchantSettingsScreen } from "@/app/screens/merchant/MerchantSettingsScreen";

const Tab = createBottomTabNavigator<MerchantTabParamList>();

function MerchantTabBar({ state, descriptors, navigation }: any) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: palette.bg,
          height: 70 + Math.max(insets.bottom, spacing[2]),
          paddingBottom: Math.max(insets.bottom, spacing[2]),
          paddingTop: spacing[4],
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];

        // Hide routes that shouldn't be in the tab bar
        if (options.tabBarStyle?.display === "none") {
          return null;
        }

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const Icon =
          route.name === "Dashboard"
            ? LayoutDashboard
            : route.name === "Menu"
              ? UtensilsCrossed
              : route.name === "Analytics"
                ? BarChart3
                : Store;

        const color = isFocused ? palette.orange : palette.textMuted;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <Icon color={color} size={30} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function MerchantTabs() {
  return (
    <Tab.Navigator
      id="MerchantTabs"
      tabBar={(props) => <MerchantTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={MerchantDashboardScreen} />
      <Tab.Screen name="Menu" component={MerchantMenuScreen} />
      <Tab.Screen name="Analytics" component={MerchantAnalyticsScreen} />
      <Tab.Screen name="Profile" component={MerchantProfileScreen} />
      <Tab.Screen
        name="VerificationCentre"
        component={VerificationCentreScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="HomeBasedVerification"
        component={HomeBasedVerificationScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="CustomerInbox"
        component={CustomerInboxScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="BusinessProfileEditor"
        component={BusinessProfileEditorScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="DishEditor"
        component={DishEditorScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="OCRDrafts"
        component={OCRDraftScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="PromotionList"
        component={PromotionListScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="PromotionBuilder"
        component={PromotionBuilderScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="AIAssistant"
        component={AIAssistantScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="OrdersComingSoon"
        component={OrdersComingSoonScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="MerchantSettings"
        component={MerchantSettingsScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
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
