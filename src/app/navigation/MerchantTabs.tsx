import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { LayoutDashboard, UtensilsCrossed, BarChart3, Store } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, Screen } from "@/components/ui";
import { resolveMerchantAccess, VERIFIED_ONLY_SCREENS } from "@/features/merchant/merchantGuards";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useHungryTheme } from "@/theme";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { MerchantAnalyticsScreen } from "@/app/screens/merchant/MerchantAnalyticsScreen";
import { MerchantProfileScreen } from "@/app/screens/merchant/MerchantProfileScreen";
import { VerificationCentreScreen } from "@/app/screens/merchant/VerificationCentreScreen";
import { HomeBasedVerificationScreen } from "@/app/screens/merchant/HomeBasedVerificationScreen";
import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { BusinessProfileEditorScreen } from "@/app/screens/merchant/BusinessProfileEditorScreen";
import { DishEditorScreen } from "@/app/screens/merchant/DishEditorScreen";
import { OCRDraftScreen } from "@/app/screens/merchant/OCRDraftScreen";
import { PromotionListScreen } from "@/app/screens/merchant/PromotionListScreen";
import { PromotionBuilderScreen } from "@/app/screens/merchant/PromotionBuilderScreen";
import { AIAssistantScreen } from "@/app/screens/merchant/AIAssistantScreen";
import { OrdersComingSoonScreen } from "@/app/screens/merchant/OrdersComingSoonScreen";
import { MerchantSettingsScreen } from "@/app/screens/merchant/MerchantSettingsScreen";

const Tab = createBottomTabNavigator<MerchantTabParamList>();
const verifiedOnlyScreens = new Set<string>(VERIFIED_ONLY_SCREENS);

type MerchantRouteName = keyof MerchantTabParamList;

function MerchantAccessGate({
  routeName,
  children,
}: {
  routeName: MerchantRouteName;
  children: React.ReactNode;
}) {
  const { spacing } = useHungryTheme();
  const navigation = useNavigation();
  const account = useMerchantStore((state) => state.account);
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const access = resolveMerchantAccess(Boolean(account), activeOutlet?.verification.status);

  const completeAuth = useSessionStore((state) => state.completeAuth);

  const handleMockLogin = async () => {
    try {
      // 1. Fetch mock account
      const mock = await getHungryService().merchant.getMerchantAccount();
      setAccount(mock);

      // 2. Set user session to authenticated
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
    } catch (e) {
      console.error(e);
    }
  };

  if (access === "none") {
    const isMock = getServiceProvider().mode === "mock";

    return (
      <Screen title="Merchant Centre" subtitle="Business tools are not available for this account">
        <View style={[styles.accessGate, { padding: spacing[5], gap: spacing[4] }]}>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            Sign in with a merchant account to manage your menu, promotions, and analytics.
          </AppText>
          <View style={{ width: "100%", gap: spacing[2] }}>
            <Button
              label="Sign In"
              onPress={() => (navigation as any).navigate("AuthStack", { screen: "Login" })}
              fullWidth
            />
            {isMock && (
              <Button
                label="Sign In as Mock Merchant"
                variant="secondary"
                onPress={handleMockLogin}
                fullWidth
              />
            )}
          </View>
        </View>
      </Screen>
    );
  }

  if (access === "unverified" && verifiedOnlyScreens.has(routeName)) {
    return (
      <Screen title="Verification required" subtitle="Complete verification to use this section">
        <View style={[styles.accessGate, { padding: spacing[5], gap: spacing[3] }]}>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            Verified merchants can manage menus, promotions, inbox replies, analytics, and settings.
          </AppText>
          <Button
            label="Open verification"
            onPress={() => navigation.navigate("VerificationCentre" as never)}
          />
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

function createGuardedScreen<Props extends object>(
  routeName: MerchantRouteName,
  Component: React.ComponentType<Props>,
) {
  return function GuardedMerchantScreen(props: Props) {
    return (
      <MerchantAccessGate routeName={routeName}>
        <Component {...props} />
      </MerchantAccessGate>
    );
  };
}

const GuardedDashboardScreen = createGuardedScreen("Dashboard", MerchantDashboardScreen);
const GuardedMenuScreen = createGuardedScreen("Menu", MerchantMenuScreen);
const GuardedAnalyticsScreen = createGuardedScreen("Analytics", MerchantAnalyticsScreen);
const GuardedProfileScreen = createGuardedScreen("Profile", MerchantProfileScreen);
const GuardedVerificationCentreScreen = createGuardedScreen(
  "VerificationCentre",
  VerificationCentreScreen,
);
const GuardedHomeBasedVerificationScreen = createGuardedScreen(
  "HomeBasedVerification",
  HomeBasedVerificationScreen,
);
const GuardedCustomerInboxScreen = createGuardedScreen("CustomerInbox", CustomerInboxScreen);
const GuardedBusinessProfileEditorScreen = createGuardedScreen(
  "BusinessProfileEditor",
  BusinessProfileEditorScreen,
);
const GuardedDishEditorScreen = createGuardedScreen("DishEditor", DishEditorScreen);
const GuardedOCRDraftScreen = createGuardedScreen("OCRDrafts", OCRDraftScreen);
const GuardedPromotionListScreen = createGuardedScreen("PromotionList", PromotionListScreen);
const GuardedPromotionBuilderScreen = createGuardedScreen(
  "PromotionBuilder",
  PromotionBuilderScreen,
);
const GuardedAIAssistantScreen = createGuardedScreen("AIAssistant", AIAssistantScreen);
const GuardedOrdersComingSoonScreen = createGuardedScreen(
  "OrdersComingSoon",
  OrdersComingSoonScreen,
);
const GuardedMerchantSettingsScreen = createGuardedScreen(
  "MerchantSettings",
  MerchantSettingsScreen,
);

function MerchantTabBar({ state, descriptors, navigation }: any) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: palette.bg,
          height: componentSizes.merchantTabBar + Math.max(insets.bottom, spacing[2]),
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
            <Icon color={color} size={componentSizes.merchantTabIcon} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function MerchantTabs() {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation();
  const account = useMerchantStore((state) => state.account);
  const developerMerchantMode = useMerchantStore((state) => state.developerMerchantMode);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const setAccount = useMerchantStore((state) => state.setAccount);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  const [isSyncingAccount, setIsSyncingAccount] = useState(!account);
  const access = developerMerchantMode
    ? "verified"
    : resolveMerchantAccess(Boolean(account), activeOutlet?.verification.status);

  useEffect(() => {
    let isMounted = true;
    async function syncMerchantAccount() {
      if (developerMerchantMode) {
        if (isMounted) {
          setIsSyncingAccount(false);
        }
        return;
      }

      if (!isAuthenticated && getServiceProvider().mode !== "mock") {
        setIsSyncingAccount(false);
        return;
      }

      try {
        const latestAccount = await getHungryService().merchant.getMerchantAccount();
        if (isMounted) {
          setAccount(latestAccount);
        }
      } catch (error) {
        console.error("Failed to sync merchant account", error);
      } finally {
        if (isMounted) {
          setIsSyncingAccount(false);
        }
      }
    }
    void syncMerchantAccount();
    return () => {
      isMounted = false;
    };
  }, [developerMerchantMode, setAccount, isAuthenticated]);

  const handleMockLogin = async () => {
    try {
      const mockAccount = await getHungryService().merchant.getMerchantAccount();
      setAccount(mockAccount);
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
    } catch (e) {
      console.error(e);
    }
  };

  if (isSyncingAccount) {
    return (
      <Screen title="Merchant Centre">
        <View style={styles.accessGate}>
          <ActivityIndicator size="large" color={palette.orange} />
          <AppText
            variant="body"
            tone="muted"
            style={{ textAlign: "center", marginTop: spacing[4] }}
          >
            Loading your merchant account...
          </AppText>
        </View>
      </Screen>
    );
  }

  // ─── Access Gate ───────────────────────────────────────────────────────────

  if (access === "none") {
    const isMock = getServiceProvider().mode === "mock";

    return (
      <Screen title="Merchant Centre" subtitle="Business tools are not available for this account">
        <View style={[styles.accessGate, { padding: spacing[5], gap: spacing[4] }]}>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            Sign in with a merchant account to manage your menu, promotions, and analytics.
          </AppText>
          <View style={{ width: "100%", gap: spacing[2] }}>
            <Button
              label="Sign In"
              onPress={() => (navigation as any).navigate("AuthStack", { screen: "Login" })}
              fullWidth
            />
            {isMock && (
              <Button
                label="Sign In as Mock Merchant"
                variant="secondary"
                onPress={handleMockLogin}
                fullWidth
              />
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // ─── Main Navigator ────────────────────────────────────────────────────────

  return (
    <Tab.Navigator
      id="MerchantTabs"
      initialRouteName={access === "verified" ? "Dashboard" : "VerificationCentre"}
      tabBar={(props: BottomTabBarProps) => <MerchantTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={GuardedDashboardScreen} />
      <Tab.Screen name="Menu" component={GuardedMenuScreen} />
      <Tab.Screen name="Analytics" component={GuardedAnalyticsScreen} />
      <Tab.Screen name="Profile" component={GuardedProfileScreen} />
      <Tab.Screen
        name="VerificationCentre"
        component={GuardedVerificationCentreScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="HomeBasedVerification"
        component={GuardedHomeBasedVerificationScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="CustomerInbox"
        component={GuardedCustomerInboxScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="BusinessProfileEditor"
        component={GuardedBusinessProfileEditorScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="DishEditor"
        component={GuardedDishEditorScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="OCRDrafts"
        component={GuardedOCRDraftScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="PromotionList"
        component={GuardedPromotionListScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="PromotionBuilder"
        component={GuardedPromotionBuilderScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="AIAssistant"
        component={GuardedAIAssistantScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="OrdersComingSoon"
        component={GuardedOrdersComingSoonScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="MerchantSettings"
        component={GuardedMerchantSettingsScreen}
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
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  accessGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
