import { useSessionStore } from "@/store/useSessionStore";

// Signs in an account whose email was just confirmed. A guest who signed up from
// onboarding (OnboardingAuth -> EmailVerification) finishes onboarding here, so it
// completes before completeAuth: completeOnboarding is a no-op once the flag is set,
// and it keeps the guest's quiz-skip choice for onboarding_completed.
export function completeVerifiedSignUp(completesOnboarding: boolean): void {
  const session = useSessionStore.getState();
  if (completesOnboarding) {
    session.completeOnboarding(session.hasSkippedTasteQuiz);
  }
  session.completeAuth({ authProvider: "email", isNewUser: true });
}
