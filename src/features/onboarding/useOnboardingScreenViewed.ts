import { useEffect } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { OnboardingFlowScreen } from "./onboardingFlow";

/** Tells analytics which numbered onboarding screen opened, once per time the screen mounts. */
export function useOnboardingScreenViewed(screen: OnboardingFlowScreen): void {
  useEffect(() => {
    trackAnalyticsEvent("onboarding_screen_viewed", { screen, surface: "onboarding" });
  }, [screen]);
}
