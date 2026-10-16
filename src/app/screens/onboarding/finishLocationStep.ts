import { useCallback } from "react";

import { useSessionStore } from "@/store/useSessionStore";

type ResettableNavigation = { reset: (state: object) => void };

export type FinishLocationStepNavigation = {
  navigate: (name: "OnboardingAuth") => void;
  getParent: () => unknown;
};

/**
 * Shared exit for the location step (device permission or manual area pick).
 * Signed-in users land in the main tabs; guests continue to onboarding auth.
 */
export function useFinishLocationStep(navigation: FinishLocationStepNavigation) {
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  return useCallback(() => {
    completeOnboarding(hasSkippedTasteQuiz);
    if (isAuthenticated) {
      const rootNav = navigation.getParent() as Partial<ResettableNavigation> | undefined;
      if (rootNav && typeof rootNav.reset === "function") {
        rootNav.reset({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: "Home" } }],
        });
      }
      return;
    }

    navigation.navigate("OnboardingAuth");
  }, [completeOnboarding, hasSkippedTasteQuiz, isAuthenticated, navigation]);
}
