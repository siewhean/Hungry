import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions, useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { LayoutDashboard, UtensilsCrossed, BarChart3, Store } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBottomTabItem, AppText, Button, Screen } from "@/components/ui";
import { resolveMerchantAccess, VERIFIED_ONLY_SCREENS } from "@/features/merchant/merchantGuards";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useHungryTheme } from "@/theme";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { MerchantTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";

const Tab = createBottomTabNavigator<MerchantTabParamList>();
const verifiedOnlyScreens = new Set<string>(VERIFIED_ONLY_SCREENS);
const MERCHANT_ACCOUNT_SYNC_TTL_MS = 5 * 60 * 1000;
/**
 * Editors with an unsaved-changes guard. The guard cannot intercept a tab press (these are
 * hidden tabs, so beforeRemove never fires), so the tab bar is not shown on them at all.
 */
const EDITOR_ROUTES = new Set<string>(["BusinessProfileEditor", "DishEditor", "PromotionBuilder"]);

type MerchantRouteName = keyof MerchantTabParamList;

/** One access level for the navigator and every screen gate; honours the developer bypass. */
function useMerchantAccessLevel() {
  const account = useMerchantStore((state) => state.account);
  const developerMerchantMode = useMerchantStore((state) => state.developerMerchantMode);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  return developerMerchantMode
    ? "verified"
    : resolveMerchantAccess(
        Boolean(account),
        activeOutlet?.verification.status,
        activeOutlet?.verification.expiresAt,
      );
}

/** The single "not a merchant" screen, shared by the navigator and the per-screen gate. */
function MerchantSignInGate({
  rootNavigation,
}: {
  rootNavigation?: NavigationProp<RootStackParamList>;
}) {
  const { spacing } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isMock = getServiceProvider().mode === "mock";

  const handleMockLogin = async () => {
    try {
      const mockAccount = await getHungryService().merchant.getMerchantAccount();
      setAccount(mockAccount);
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
    } catch (e) {
      reportError(e, { screen: "MerchantTabs", action: "mock_login" });
    }
  };

  return (
    <Screen title="Merchant Centre" subtitle="Business tools are not available for this account">
      <View style={[styles.accessGate, { padding: spacing[5], gap: spacing[4] }]}>
        <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
          {isAuthenticated
            ? "This login has no merchant account yet. Claim your stall from its page in customer mode to get started."
            : "Sign in with a merchant account to manage your menu, promotions, and analytics."}
        </AppText>
        <View style={{ width: "100%", gap: spacing[2] }}>
          {/* Already signed in: the Login screen would be a dead end, so offer the way out instead. */}
          {isAuthenticated ? (
            <Button
              label="Switch to Customer Mode"
              onPress={() => {
                useMerchantStore.getState().setMerchantModeActive(false);
                rootNavigation?.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "MainTabs", params: { screen: "Home" } }],
                  }),
                );
              }}
              fullWidth
            />
          ) : (
            <Button
              label="Sign In"
              onPress={() => rootNavigation?.navigate("AuthStack", { screen: "Login" })}
              fullWidth
            />
          )}
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
  const access = useMerchantAccessLevel();
  const signOut = useSessionStore((state) => state.signOut);
  const { showAlert, dialog } = useMerchantDialog();

  if (access === "none") {
    return <MerchantSignInGate rootNavigation={rootNavigation} />;
  }

  if (access === "unverified" && verifiedOnlyScreens.has(routeName)) {
    return (
      <Screen title="Verification required" subtitle="Complete verification to use this section">
        <View style={[styles.accessGate, { padding: spacing[5], gap: spacing[3] }]}>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            Verified merchants can manage promotions, inbox replies and analytics. You can already
            set up your stall profile and menu while Hungry reviews your verification.
          </AppText>
          <View style={{ width: "100%", gap: spacing[2] }}>
            <Button
              label="Open verification"
              onPress={() => navigation.navigate("VerificationCentre")}
              fullWidth
            />
            <Button
              label="Set up stall profile"
              variant="secondary"
              onPress={() => navigation.navigate("Profile")}
              fullWidth
            />
            {/* Always-available exits: an unverified merchant is never trapped here. */}
            <Button
              label="Switch to Customer Mode"
              variant="secondary"
              onPress={() => {
                useMerchantStore.getState().setMerchantModeActive(false);
                rootNavigation?.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "MainTabs", params: { screen: "Home" } }],
                  }),
                );
              }}
              fullWidth
            />
            <Button
              label="Sign out"
              variant="ghost"
              onPress={() =>
                showAlert("Sign out?", "You will need to sign in again to use Hungry.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: () => {
                      signOut();
                      rootNavigation?.reset({
                        index: 0,
                        routes: [{ name: "AuthStack", params: { screen: "Login" } }],
                      });
                    },
                  },
                ])
              }
              fullWidth
            />
          </View>
        </View>
        {dialog}
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

/**
 * Build each guarded screen once. Navigators may call getComponent on every render; a new
 * component type each time would remount the screen and drop its scroll and form state.
 */
function memoizeLoader<T>(load: () => T): () => T {
  let loaded: { value: T } | undefined;
  return () => {
    loaded ??= { value: load() };
    return loaded.value;
  };
}

const loadMerchantDashboardScreen = memoizeLoader(() =>
  createGuardedScreen(
    "Dashboard",
    (
      require("@/app/screens/merchant/MerchantDashboardScreen") as typeof import("@/app/screens/merchant/MerchantDashboardScreen")
    ).MerchantDashboardScreen,
  ),
);
const loadMerchantMenuScreen = memoizeLoader(() =>
  createGuardedScreen(
    "Menu",
    (
      require("@/app/screens/merchant/MerchantMenuScreen") as typeof import("@/app/screens/merchant/MerchantMenuScreen")
    ).MerchantMenuScreen,
  ),
);
const loadMerchantAnalyticsScreen = memoizeLoader(() =>
  createGuardedScreen(
    "Analytics",
    (
      require("@/app/screens/merchant/MerchantAnalyticsScreen") as typeof import("@/app/screens/merchant/MerchantAnalyticsScreen")
    ).MerchantAnalyticsScreen,
  ),
);
const loadMerchantProfileScreen = memoizeLoader(() =>
  createGuardedScreen(
    "Profile",
    (
      require("@/app/screens/merchant/MerchantProfileScreen") as typeof import("@/app/screens/merchant/MerchantProfileScreen")
    ).MerchantProfileScreen,
  ),
);
const loadVerificationCentreScreen = memoizeLoader(() =>
  createGuardedScreen(
    "VerificationCentre",
    (
      require("@/app/screens/merchant/VerificationCentreScreen") as typeof import("@/app/screens/merchant/VerificationCentreScreen")
    ).VerificationCentreScreen,
  ),
);
const loadHomeBasedVerificationScreen = memoizeLoader(() =>
  createGuardedScreen(
    "HomeBasedVerification",
    (
      require("@/app/screens/merchant/HomeBasedVerificationScreen") as typeof import("@/app/screens/merchant/HomeBasedVerificationScreen")
    ).HomeBasedVerificationScreen,
  ),
);
const loadCustomerInboxScreen = memoizeLoader(() =>
  createGuardedScreen(
    "CustomerInbox",
    (
      require("@/app/screens/merchant/CustomerInboxScreen") as typeof import("@/app/screens/merchant/CustomerInboxScreen")
    ).CustomerInboxScreen,
  ),
);
const loadFeaturedVisitorsScreen = memoizeLoader(() =>
  createGuardedScreen(
    "FeaturedVisitors",
    (
      require("@/app/screens/merchant/FeaturedVisitorsScreen") as typeof import("@/app/screens/merchant/FeaturedVisitorsScreen")
    ).FeaturedVisitorsScreen,
  ),
);
const loadBusinessProfileEditorScreen = memoizeLoader(() =>
  createGuardedScreen(
    "BusinessProfileEditor",
    (
      require("@/app/screens/merchant/BusinessProfileEditorScreen") as typeof import("@/app/screens/merchant/BusinessProfileEditorScreen")
    ).BusinessProfileEditorScreen,
  ),
);
const loadDishEditorScreen = memoizeLoader(() =>
  createGuardedScreen(
    "DishEditor",
    (
      require("@/app/screens/merchant/DishEditorScreen") as typeof import("@/app/screens/merchant/DishEditorScreen")
    ).DishEditorScreen,
  ),
);
const loadOCRDraftScreen = memoizeLoader(() =>
  createGuardedScreen(
    "OCRDrafts",
    (
      require("@/app/screens/merchant/OCRDraftScreen") as typeof import("@/app/screens/merchant/OCRDraftScreen")
    ).OCRDraftScreen,
  ),
);
const loadPromotionListScreen = memoizeLoader(() =>
  createGuardedScreen(
    "PromotionList",
    (
      require("@/app/screens/merchant/PromotionListScreen") as typeof import("@/app/screens/merchant/PromotionListScreen")
    ).PromotionListScreen,
  ),
);
const loadPromotionBuilderScreen = memoizeLoader(() =>
  createGuardedScreen(
    "PromotionBuilder",
    (
      require("@/app/screens/merchant/PromotionBuilderScreen") as typeof import("@/app/screens/merchant/PromotionBuilderScreen")
    ).PromotionBuilderScreen,
  ),
);
const loadAIAssistantScreen = memoizeLoader(() =>
  createGuardedScreen(
    "AIAssistant",
    (
      require("@/app/screens/merchant/AIAssistantScreen") as typeof import("@/app/screens/merchant/AIAssistantScreen")
    ).AIAssistantScreen,
  ),
);
const loadMerchantSettingsScreen = memoizeLoader(() =>
  createGuardedScreen(
    "MerchantSettings",
    (
      require("@/app/screens/merchant/MerchantSettingsScreen") as typeof import("@/app/screens/merchant/MerchantSettingsScreen")
    ).MerchantSettingsScreen,
  ),
);

function MerchantTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const account = useMerchantStore((storeState) => storeState.account);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  // Leaving an editor goes through its back button, which asks before discarding edits.
  if (EDITOR_ROUTES.has(state.routes[state.index]?.name ?? "")) {
    return null;
  }

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
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const tabBarStyle = StyleSheet.flatten(options.tabBarStyle);
        const tabBarDisplay =
          tabBarStyle && typeof tabBarStyle === "object" && "display" in tabBarStyle
            ? tabBarStyle.display
            : undefined;

        // Hide routes that shouldn't be in the tab bar
        if (tabBarDisplay === "none") {
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

        const tabConfig =
          route.name === "Dashboard"
            ? { icon: LayoutDashboard, label: "Home" }
            : route.name === "Menu"
              ? { icon: UtensilsCrossed, label: "Menu" }
              : route.name === "Analytics"
                ? { icon: BarChart3, label: "Performance" }
                : { icon: Store, label: "Profile" };
        const Icon = tabConfig.icon;

        const color = isFocused ? palette.orangeText : palette.textMuted;

        return (
          <AppBottomTabItem
            key={route.key}
            accessibilityLabel={`Merchant ${tabConfig.label}`}
            color={color}
            focused={isFocused}
            icon={Icon}
            label={tabConfig.label}
            onPress={onPress}
            onPressIn={() => {
              prefetchMerchantTab(route.name, activeOutlet?.id, account?.id);
              preloadRoute(navigation, route.name);
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * Editors are hidden tabs that stay mounted. Remount on every open (new params, or after
 * leaving) so "Add dish" / "New promotion" never start with the last form's values.
 */
function FreshEditorLayout({
  navigation,
  route,
  children,
}: {
  navigation: { addListener: (event: "blur", callback: () => void) => () => void };
  route: { params?: object };
  children: React.ReactElement;
}) {
  const [openCount, setOpenCount] = useState(0);
  useEffect(
    () => navigation.addListener("blur", () => setOpenCount((count) => count + 1)),
    [navigation],
  );
  return (
    <React.Fragment key={`${openCount}:${JSON.stringify(route.params ?? null)}`}>
      {children}
    </React.Fragment>
  );
}

// Navigators call `layout` as a plain function during their own render, so wrap it in an
// element; otherwise FreshEditorLayout's hooks would run inside the tab navigator.
const renderFreshEditorLayout = (props: React.ComponentProps<typeof FreshEditorLayout>) => (
  <FreshEditorLayout {...props} />
);

export function MerchantTabs() {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp<MerchantTabParamList>>();
  const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();
  // This screen's own route in the root stack (useNavigation here is the root stack's navigation).
  const routeKey = useRoute().key;
  const account = useMerchantStore((state) => state.account);
  const accountSyncedAt = useMerchantStore((state) => state.accountSyncedAt);
  const developerMerchantMode = useMerchantStore((state) => state.developerMerchantMode);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const setAccount = useMerchantStore((state) => state.setAccount);
  const setMerchantModeActive = useMerchantStore((state) => state.setMerchantModeActive);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  // Merchant mode lasts only while the Merchant Centre is open; leaving it returns customer mode.
  // Activate on first focus, not mount: a preloaded (never shown) Merchant Centre must not flip modes.
  useEffect(() => {
    if (navigation.isFocused()) setMerchantModeActive(true);
    const unsubscribe = navigation.addListener("focus", () => setMerchantModeActive(true));
    return () => {
      unsubscribe();
      // Leaving the Merchant Centre removes it from the stack and ends the mode. An app teardown
      // (e.g. Android back finishing the activity) unmounts it still on the stack: keep the mode.
      const stillOnStack = navigation.getState().routes.some((route) => route.key === routeKey);
      if (!stillOnStack) setMerchantModeActive(false);
    };
  }, [navigation, routeKey, setMerchantModeActive]);

  const [isSyncingAccount, setIsSyncingAccount] = useState(!account);
  // A failed first load (offline, server error) is not "you are not a merchant": offer a retry.
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const access = useMerchantAccessLevel();

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
          setSyncFailed(false);
          setAccount(latestAccount);
        }
      } catch (error) {
        // Sentry sees why a merchant lands on the retry gate.
        reportError(error, { screen: "MerchantTabs", action: "sync_account" });
        if (isMounted) setSyncFailed(true);
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
    // syncAttempt re-runs the sync when the merchant taps Retry.
  }, [
    account,
    accountSyncedAt,
    activeOutlet,
    developerMerchantMode,
    setAccount,
    isAuthenticated,
    syncAttempt,
  ]);

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

  if (access === "none" && syncFailed) {
    return (
      <Screen title="Merchant Centre" subtitle="Could not load your merchant account">
        <View style={[styles.accessGate, { padding: spacing[5], gap: spacing[4] }]}>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            Hungry could not be reached. Check your connection and try again.
          </AppText>
          <View style={{ width: "100%", gap: spacing[2] }}>
            <Button
              label="Retry"
              onPress={() => {
                setSyncFailed(false);
                setIsSyncingAccount(true);
                setSyncAttempt((attempt) => attempt + 1);
              }}
              fullWidth
            />
            <Button
              label="Switch to Customer Mode"
              variant="secondary"
              onPress={() => {
                setMerchantModeActive(false);
                rootNavigation?.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "MainTabs", params: { screen: "Home" } }],
                  }),
                );
              }}
              fullWidth
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (access === "none") {
    return <MerchantSignInGate rootNavigation={rootNavigation} />;
  }

  // ─── Main Navigator ────────────────────────────────────────────────────────

  return (
    <Tab.Navigator
      id="MerchantTabs"
      initialRouteName={access === "verified" ? "Dashboard" : "VerificationCentre"}
      tabBar={(props: BottomTabBarProps) => <MerchantTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      // Detail routes are hidden tabs: Back returns to the screen that opened them.
      backBehavior="history"
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
        name="FeaturedVisitors"
        getComponent={loadFeaturedVisitorsScreen}
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
        layout={renderFreshEditorLayout}
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
        layout={renderFreshEditorLayout}
      />
      <Tab.Screen
        name="AIAssistant"
        getComponent={loadAIAssistantScreen}
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
  accessGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
