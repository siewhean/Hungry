import { useEffect } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
  type Theme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { BookOpen, Compass, House, Search, User } from "lucide-react-native";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { DiscoverHomeScreen } from "@/app/screens/discover/DiscoverHomeScreen";
import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { BuildingDrillDownScreen } from "@/app/screens/discover/BuildingDrillDownScreen";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { DishDetailScreen } from "@/app/screens/detail/DishDetailScreen";
import { NotFoundScreen } from "@/app/screens/detail/NotFoundScreen";
import { OfflineStateScreen } from "@/app/screens/detail/OfflineStateScreen";
import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { ProfileStack } from "@/app/screens/profile/ProfileStack";
import { BlogPostWebViewScreen } from "@/app/screens/reads/BlogPostWebViewScreen";
import { ReadsFeedScreen } from "@/app/screens/reads/ReadsFeedScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { DishSearchScreen } from "@/app/screens/search/DishSearchScreen";
import { SearchResultsScreen } from "@/app/screens/search/SearchResultsScreen";
import { TasteFilterScreen } from "@/app/screens/search/TasteFilterScreen";
import { FloatingToast } from "@/components/ui";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { SoftGateSheet } from "./SoftGateSheet";
import type {
  MainTabParamList,
  RootStackParamList,
} from "./navigationTypes";

// ── Stack param lists ────────────────────────────────────────────────────────

type SearchStackParamList = {
  SearchHome: undefined;
  TasteFilter: undefined;
  SearchResults: undefined;
};

// ── Stack navigators ─────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ── Nested navigators ────────────────────────────────────────────────────────

/** Search tab: keyword search → taste filter → results */
function SearchNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen component={DishSearchScreen} name="SearchHome" />
      <SearchStack.Screen component={TasteFilterScreen} name="TasteFilter" />
      <SearchStack.Screen component={SearchResultsScreen} name="SearchResults" />
    </SearchStack.Navigator>
  );
}

function BlogPostRouteScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "BlogPost">) {
  return (
    <BlogPostWebViewScreen
      onOpenVenue={(venueId) => navigation.navigate("StallDetail", { venueId })}
      postId={route.params.postId}
    />
  );
}

// ── Tab navigator ────────────────────────────────────────────────────────────

function TabNavigator() {
  const { palette, spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const showSoftGate = useUIStore((state) => state.showSoftGate);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.orange,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 64,
          paddingBottom: spacing[2],
          paddingTop: spacing[2],
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, typeof House> = {
            Home: House,
            Discover: Compass,
            Search: Search,
            Read: BookOpen,
            Profile: User,
          };
          const Icon = icons[route.name] ?? User;
          return <Icon color={color} size={size} />;
        },
      })}
    >
      <Tabs.Screen component={HomeFeedScreen} name="Home" />
      <Tabs.Screen component={DiscoverHomeScreen} name="Discover" />
      <Tabs.Screen component={SearchNavigator} name="Search" />
      <Tabs.Screen component={ReadsFeedScreen} name="Read" />
      <Tabs.Screen
        component={ProfileStack}
        listeners={{
          tabPress: (event) => {
            if (!isAuthenticated) {
              event.preventDefault();
              showSoftGate();
            }
          },
        }}
        name="Profile"
      />
    </Tabs.Navigator>
  );
}

// ── Root navigator ───────────────────────────────────────────────────────────

export function RootNavigator({ theme }: { theme: Theme }) {
  useAppBootstrap();

  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const dismissSessionExpiry = useSessionStore((state) => state.dismissSessionExpiry);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);

  useEffect(() => {
    if (sessionExpired && navigationRef.isReady()) {
      navigationRef.navigate("AuthStack", { screen: "Login" });
      dismissSessionExpiry();
    }
  }, [dismissSessionExpiry, sessionExpired]);

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={theme}>
        <RootStack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <RootStack.Screen component={SplashScreen} name="Splash" />
          <RootStack.Screen component={AuthStack} name="AuthStack" />
          <RootStack.Screen component={OnboardingStack} name="OnboardingStack" />
          <RootStack.Screen component={TabNavigator} name="MainTabs" />
          {/* Overlay screens — accessible from any tab */}
          <RootStack.Screen component={DishDetailScreen} name="DishDetail" />
          <RootStack.Screen component={StallDetailScreen} name="StallDetail" />
          <RootStack.Screen component={BlogPostRouteScreen} name="BlogPost" />
          <RootStack.Screen component={ReviewStack} name="ReviewStack" />
          <RootStack.Screen component={HomeMapScreen} name="MapView" />
          <RootStack.Screen component={BuildingDrillDownScreen} name="BuildingDrillDown" />
          <RootStack.Screen component={DecideForMeResultScreen} name="DecideForMeResult" />
          <RootStack.Screen component={OfflineStateScreen} name="Offline" />
          <RootStack.Screen component={NotFoundScreen} name="NotFound" />
        </RootStack.Navigator>
      </NavigationContainer>
      <SoftGateSheet
        onLogin={() => {
          setReturnRoute("Profile");
          if (navigationRef.isReady()) {
            navigationRef.navigate("AuthStack", { screen: "Login" });
          }
        }}
      />
      <FloatingToast />
    </>
  );
}
