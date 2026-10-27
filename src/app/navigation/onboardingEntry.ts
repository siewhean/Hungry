import {
  ONBOARDING_RESUME_ROUTES,
  getFreshOnboardingDraft,
  useOnboardingDraftStore,
} from "@/store/useOnboardingDraftStore";

/** The order the first-run screens are stacked in, so Back from a resumed step works. */
const STACK_ORDER = ["OnboardingWelcome", ...ONBOARDING_RESUME_ROUTES] as const;

type EntryRoute = { name: string; params?: Record<string, unknown> };

/**
 * The OnboardingStack route a not-yet-onboarded user is sent to: Welcome for a fresh start,
 * or the step they were on (with the steps before it underneath, so Back works) when a draft
 * from the last 24 hours exists. An expired draft is cleared.
 */
export function onboardingEntryRoute(): {
  name: "OnboardingStack";
  params?: { screen: "OnboardingWelcome" };
  state?: { index: number; routes: EntryRoute[] };
} {
  const draft = getFreshOnboardingDraft();
  if (!draft) {
    if (useOnboardingDraftStore.getState().route) useOnboardingDraftStore.getState().clearDraft();
    return { name: "OnboardingStack", params: { screen: "OnboardingWelcome" } };
  }
  const targetIndex = STACK_ORDER.indexOf(draft.route);
  const routes: EntryRoute[] = STACK_ORDER.slice(0, targetIndex + 1).map((name) => {
    if (name === "DietaryPreferences") {
      return {
        name,
        params: {
          mode: "onboarding",
          initialPhase: "dietary",
          ...(draft.quiz && draft.quiz.answeredKeys.length > 0
            ? { answers: draft.quiz.answers, answeredKeys: draft.quiz.answeredKeys }
            : {}),
        },
      };
    }
    return { name };
  });
  return { name: "OnboardingStack", state: { index: routes.length - 1, routes } };
}
