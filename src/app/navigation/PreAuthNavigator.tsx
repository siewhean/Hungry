import * as Linking from "expo-linking";
import { useMemo } from "react";
import {
  NavigationContainer,
  getPathFromState,
  type LinkingOptions,
  type Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SplashScreen } from "@/app/screens/SplashScreen";
import { AuthStack } from "@/app/screens/auth/AuthStack";
import { OnboardingStack } from "@/app/screens/onboarding/OnboardingStack";
import { FloatingToast } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import type { RootStackParamList } from "./navigationTypes";
import { createRootLinking, withoutEmailParam } from "./linking";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The signed-out application owns only Splash, Onboarding, and Auth. Main app
 * routes are not mounted at all, so stale navigation state and deep links cannot
 * render catalog or account surfaces before authentication succeeds.
 */
export function PreAuthNavigator({ theme }: { theme: Theme }) {
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const resetScrollBack = useUIStore((state) => state.resetScrollBack);
  const prefix = Linking.createURL("/");

  const linking = useMemo(() => {
    const base = createRootLinking(
      prefix,
      () => {
        const state = useSessionStore.getState();
        return {
          isAuthReady: state.isAuthReady,
          isAuthenticated: state.isAuthenticated,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          onboardingCompletionPending: state.onboardingCompletionPending,
          returningAccountIntent: state.returningAccountIntent,
        };
      },
      (route) => setReturnRoute({ name: route.name, params: route.params }),
    );

    // React Navigation cannot infer the nested AuthStack params from a navigator
    // that intentionally mounts only the pre-auth subset of the root routes.
    return {
      ...base,
      getPathFromState: withoutEmailParam(getPathFromState),
    } as unknown as LinkingOptions<RootStackParamList>;
  }, [prefix, setReturnRoute]);

  return (
    <>
      <NavigationContainer theme={theme} linking={linking} onStateChange={resetScrollBack}>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen component={SplashScreen} name="Splash" />
          <Stack.Screen component={OnboardingStack} name="OnboardingStack" />
          <Stack.Screen component={AuthStack} name="AuthStack" />
        </Stack.Navigator>
      </NavigationContainer>
      <FloatingToast />
    </>
  );
}
