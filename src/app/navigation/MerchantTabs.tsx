import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LayoutDashboard, UtensilsCrossed, BarChart3, Store } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { MerchantAnalyticsScreen } from "@/app/screens/merchant/MerchantAnalyticsScreen";
import { MerchantProfileScreen } from "@/app/screens/merchant/MerchantProfileScreen";

const Tab = createBottomTabNavigator<MerchantTabParamList>();

export function MerchantTabs() {
  const { palette } = useHungryTheme();

  return (
    <Tab.Navigator
      id="MerchantTabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.orange,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={MerchantDashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MerchantMenuScreen}
        options={{
          tabBarIcon: ({ color, size }) => <UtensilsCrossed size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={MerchantAnalyticsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={MerchantProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Store size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
