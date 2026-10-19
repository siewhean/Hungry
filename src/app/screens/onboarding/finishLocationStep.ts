import { useCallback } from "react";

import { getPreAuthRootRoute, resolveOnboardingExitRoute } from "@/app/navigation/launchRoute";
import { useSessionStore } from "@/store/useSessionStore";

type ResettableNavigation = { reset: (state: object) => void };

export type FinishLocationStepNavigation = {
  getParent: () => unknown;
};

/**
 * Shared exit for the location step (device permission or manual area pick),
 * the last onboarding step. It completes onboarding, then signed-in users land
 * in the main tabs and signed-out users go to Create account (AuthStack SignUp),
 * the one canonical account-creation screen. Rules: resolveOnboardingExitRoute.
 */
export function useFinishLocationStep(navigation: FinishLocationStepNavigation) {
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  return useCallback(() => {
    completeOnboarding(hasSkippedTasteQuiz);
    const rootNav = navigation.getParent() as Partial<ResettableNavigation> | undefined;
    if (!rootNav || typeof rootNav.reset !== "function") return;

    const exit = resolveOnboardingExitRoute({ isAuthenticated });
    rootNav.reset({
      index: 0,
      routes: [
        exit.kind === "app"
          ? { name: "MainTabs", params: { screen: "Home" } }
          : getPreAuthRootRoute(exit),
      ],
    });
  }, [completeOnboarding, hasSkippedTasteQuiz, isAuthenticated, navigation]);
}
