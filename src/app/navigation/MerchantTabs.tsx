import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { LayoutDashboard, UtensilsCrossed, BarChart3, Store } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, Screen } from "@/components/ui";
import { resolveMerchantAccess, VERIFIED_ONLY_SCREENS } from "@/features/merchant/merchantGuards";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useHungryTheme } from "@/theme";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { MerchantTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";

const Tab = createBottomTabNavigator<MerchantTabParamList>();
const verifiedOnlyScreens = new Set<string>(VERIFIED_ONLY_SCREENS);
const MERCHANT_ACCOUNT_SYNC_TTL_MS = 5 * 60 * 1000;

type MerchantRouteName = keyof MerchantTabParamList;

function MerchantAccessGate({
  routeName,
  children,
}: {
  routeName: MerchantRouteName;
  children: React.ReactNode;
}) {
  const { spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp<MerchantTabParamList>>();
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();
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
              onPress={() => rootNavigation?.navigate("AuthStack", { screen: "Login" })}
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
            onPress={() => navigation.navigate("VerificationCentre")}
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

const loadMerchantDashboardScreen = () =>
  createGuardedScreen(
    "Dashboard",
    (
      require("@/app/screens/merchant/MerchantDashboardScreen") as typeof import("@/app/screens/merchant/MerchantDashboardScreen")
    ).MerchantDashboardScreen,
  );
const loadMerchantMenuScreen = () =>
  createGuardedScreen(
    "Menu",
    (
      require("@/app/screens/merchant/MerchantMenuScreen") as typeof import("@/app/screens/merchant/MerchantMenuScreen")
    ).MerchantMenuScreen,
  );
const loadMerchantAnalyticsScreen = () =>
  createGuardedScreen(
    "Analytics",
    (
      require("@/app/screens/merchant/MerchantAnalyticsScreen") as typeof import("@/app/screens/merchant/MerchantAnalyticsScreen")
    ).MerchantAnalyticsScreen,
  );
const loadMerchantProfileScreen = () =>
  createGuardedScreen(
    "Profile",
    (
      require("@/app/screens/merchant/MerchantProfileScreen") as typeof import("@/app/screens/merchant/MerchantProfileScreen")
    ).MerchantProfileScreen,
  );
const loadVerificationCentreScreen = () =>
  createGuardedScreen(
    "VerificationCentre",
    (
      require("@/app/screens/merchant/VerificationCentreScreen") as typeof import("@/app/screens/merchant/VerificationCentreScreen")
    ).VerificationCentreScreen,
  );
const loadHomeBasedVerificationScreen = () =>
  createGuardedScreen(
    "HomeBasedVerification",
    (
      require("@/app/screens/merchant/HomeBasedVerificationScreen") as typeof import("@/app/screens/merchant/HomeBasedVerificationScreen")
    ).HomeBasedVerificationScreen,
  );
const loadCustomerInboxScreen = () =>
  createGuardedScreen(
    "CustomerInbox",
    (
      require("@/app/screens/merchant/CustomerInboxScreen") as typeof import("@/app/screens/merchant/CustomerInboxScreen")
    ).CustomerInboxScreen,
  );
const loadBusinessProfileEditorScreen = () =>
  createGuardedScreen(
    "BusinessProfileEditor",
    (
      require("@/app/screens/merchant/BusinessProfileEditorScreen") as typeof import("@/app/screens/merchant/BusinessProfileEditorScreen")
    ).BusinessProfileEditorScreen,
  );
const loadDishEditorScreen = () =>
  createGuardedScreen(
    "DishEditor",
    (
      require("@/app/screens/merchant/DishEditorScreen") as typeof import("@/app/screens/merchant/DishEditorScreen")
    ).DishEditorScreen,
  );
const loadOCRDraftScreen = () =>
  createGuardedScreen(
    "OCRDrafts",
    (
      require("@/app/screens/merchant/OCRDraftScreen") as typeof import("@/app/screens/merchant/OCRDraftScreen")
    ).OCRDraftScreen,
  );
const loadPromotionListScreen = () =>
  createGuardedScreen(
    "PromotionList",
    (
      require("@/app/screens/merchant/PromotionListScreen") as typeof import("@/app/screens/merchant/PromotionListScreen")
    ).PromotionListScreen,
  );
const loadPromotionBuilderScreen = () =>
  createGuardedScreen(
    "PromotionBuilder",
    (
      require("@/app/screens/merchant/PromotionBuilderScreen") as typeof import("@/app/screens/merchant/PromotionBuilderScreen")
    ).PromotionBuilderScreen,
  );
const loadAIAssistantScreen = () =>
  createGuardedScreen(
    "AIAssistant",
    (
      require("@/app/screens/merchant/AIAssistantScreen") as typeof import("@/app/screens/merchant/AIAssistantScreen")
    ).AIAssistantScreen,
  );
const loadOrdersComingSoonScreen = () =>
  createGuardedScreen(
    "OrdersComingSoon",
    (
      require("@/app/screens/merchant/OrdersComingSoonScreen") as typeof import("@/app/screens/merchant/OrdersComingSoonScreen")
    ).OrdersComingSoonScreen,
  );
const loadMerchantSettingsScreen = () =>
  createGuardedScreen(
    "MerchantSettings",
    (
      require("@/app/screens/merchant/MerchantSettingsScreen") as typeof import("@/app/screens/merchant/MerchantSettingsScreen")
    ).MerchantSettingsScreen,
  );

function MerchantTabBar({ state, descriptors, navigation }: any) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const account = useMerchantStore((storeState) => storeState.account);
  const activeOutlet = useMerchantStore(getActiveOutlet);

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
            onPressIn={() => {
              prefetchMerchantTab(route.name, activeOutlet?.id, account?.id);
              preloadRoute(navigation, route.name);
            }}
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
  const navigation = useNavigation<NavigationProp<MerchantTabParamList>>();
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();
  const account = useMerchantStore((state) => state.account);
  const accountSyncedAt = useMerchantStore((state) => state.accountSyncedAt);
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
    let deferredSync: (() => void) | undefined;

    const hasFreshCachedAccount =
      Boolean(account) &&
      Boolean(activeOutlet) &&
      Boolean(accountSyncedAt) &&
      Date.now() - Number(accountSyncedAt) < MERCHANT_ACCOUNT_SYNC_TTL_MS;

    if (developerMerchantMode || hasFreshCachedAccount) {
      setIsSyncingAccount(false);
      return () => {
        isMounted = false;
      };
    }

    async function syncMerchantAccount() {
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

    if (account) {
      setIsSyncingAccount(false);
      deferredSync = scheduleIdleWork(() => {
        void syncMerchantAccount();
      });
    } else {
      void syncMerchantAccount();
    }

    return () => {
      isMounted = false;
      deferredSync?.();
    };
  }, [account, accountSyncedAt, activeOutlet, developerMerchantMode, setAccount, isAuthenticated]);

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
              onPress={() => rootNavigation?.navigate("AuthStack", { screen: "Login" })}
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
      <Tab.Screen name="Dashboard" getComponent={loadMerchantDashboardScreen} />
      <Tab.Screen name="Menu" getComponent={loadMerchantMenuScreen} />
      <Tab.Screen name="Analytics" getComponent={loadMerchantAnalyticsScreen} />
      <Tab.Screen name="Profile" getComponent={loadMerchantProfileScreen} />
      <Tab.Screen
        name="VerificationCentre"
        getComponent={loadVerificationCentreScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="HomeBasedVerification"
        getComponent={loadHomeBasedVerificationScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="CustomerInbox"
        getComponent={loadCustomerInboxScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="BusinessProfileEditor"
        getComponent={loadBusinessProfileEditorScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="DishEditor"
        getComponent={loadDishEditorScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="OCRDrafts"
        getComponent={loadOCRDraftScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="PromotionList"
        getComponent={loadPromotionListScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="PromotionBuilder"
        getComponent={loadPromotionBuilderScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="AIAssistant"
        getComponent={loadAIAssistantScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="OrdersComingSoon"
        getComponent={loadOrdersComingSoonScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen
        name="MerchantSettings"
        getComponent={loadMerchantSettingsScreen}
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
