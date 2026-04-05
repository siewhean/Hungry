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
import { Compass, House, MapPinned, NotebookPen, User } from "lucide-react-native";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { HomeFeedScreen } from "@/app/screens/home/HomeFeedScreen";
import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { DiscoverHomeScreen } from "@/app/screens/discover/DiscoverHomeScreen";
import { BuildingDrillDownScreen } from "@/app/screens/discover/BuildingDrillDownScreen";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { DishDetailScreen } from "@/app/screens/detail/DishDetailScreen";
import { NotFoundScreen } from "@/app/screens/detail/NotFoundScreen";
import { OfflineStateScreen } from "@/app/screens/detail/OfflineStateScreen";
import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { ProfileStack } from "@/app/screens/profile/ProfileStack";
import { BlogPostWebViewScreen } from "@/app/screens/reads/BlogPostWebViewScreen";
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

type MapsStackParamList = {
  MapsHome: undefined;
  BuildingDrillDown: undefined;
  DecideForMeResult: undefined;
};

type DiscoverStackParamList = {
  DiscoverHome: undefined;
  TasteFilter: undefined;
  SearchResults: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MapsStack = createNativeStackNavigator<MapsStackParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function MapsNavigator() {
  return (
    <MapsStack.Navigator screenOptions={{ headerShown: false }}>
      <MapsStack.Screen component={HomeMapScreen} name="MapsHome" />
      <MapsStack.Screen component={BuildingDrillDownScreen} name="BuildingDrillDown" />
      <MapsStack.Screen component={DecideForMeResultScreen} name="DecideForMeResult" />
    </MapsStack.Navigator>
  );
}

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen component={DiscoverHomeScreen} name="DiscoverHome" />
      <DiscoverStack.Screen component={TasteFilterScreen} name="TasteFilter" />
      <DiscoverStack.Screen component={SearchResultsScreen} name="SearchResults" />
    </DiscoverStack.Navigator>
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
          const Icon =
            route.name === "Home"
              ? House
              : route.name === "Discover"
                ? Compass
                : route.name === "Maps"
                  ? MapPinned
                  : route.name === "Review"
                    ? NotebookPen
                    : User;
          return <Icon color={color} size={size} />;
        },
      })}
    >
      <Tabs.Screen component={HomeFeedScreen} name="Home" />
      <Tabs.Screen component={DiscoverNavigator} name="Discover" />
      <Tabs.Screen component={MapsNavigator} name="Maps" />
      <Tabs.Screen component={ReviewStack} name="Review" />
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

export function RootNavigator({ theme }: { theme: Theme }) {
  useAppBootstrap();

  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const dismissSessionExpiry = useSessionStore((state) => state.dismissSessionExpiry);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);

  useEffect(() => {
    if (sessionExpired && navigationRef.isReady()) {
      navigationRef.navigate("AuthStack", {
        screen: "Login",
      });
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
          <RootStack.Screen component={DishDetailScreen} name="DishDetail" />
          <RootStack.Screen component={StallDetailScreen} name="StallDetail" />
          <RootStack.Screen component={BlogPostRouteScreen} name="BlogPost" />
          <RootStack.Screen component={ReviewStack} name="ReviewStack" />
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
