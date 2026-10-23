import { useEffect, type ComponentProps } from "react";

import { useSessionStore } from "@/store/useSessionStore";
import { OnboardingAuthScreen } from "./OnboardingAuthScreen";

type Props = ComponentProps<typeof OnboardingAuthScreen>;

/**
 * Reaching the final onboarding step completes the local preference journey,
 * but it does not authenticate the user. The account form remains on screen
 * until Supabase creates or restores a real session.
 */
export function MandatoryOnboardingAuthScreen(props: Props) {
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);

  useEffect(() => {
    if (!hasCompletedOnboarding) completeOnboarding(hasSkippedTasteQuiz);
  }, [completeOnboarding, hasCompletedOnboarding, hasSkippedTasteQuiz]);

  return <OnboardingAuthScreen {...props} />;
}
