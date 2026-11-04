import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { SLIDER_FLOW_ROUTES } from "@/features/onboarding/flowRoutes";
import { getFreshOnboardingDraft, useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";

/** The order the first-run screens are stacked in, so Back from a resumed step works. */
const LEGACY_STACK_ORDER = [
  "OnboardingWelcome",
  "LocationPermission",
  "TasteQuiz",
  "DietaryPreferences",
  "FoodOpenness",
  "TasteProfileResult",
] as const;

function stackOrder(): readonly string[] {
  return FEATURE_FLAGS.sliderOnboardingEnabled ? SLIDER_FLOW_ROUTES : LEGACY_STACK_ORDER;
}

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
  const order = stackOrder();
  const targetIndex = order.indexOf(draft.route);
  // A draft saved by the other flow (the flag changed since) is not in this order: start over.
  if (targetIndex < 0) {
    useOnboardingDraftStore.getState().clearDraft();
    return { name: "OnboardingStack", params: { screen: "OnboardingWelcome" } };
  }
  const routes: EntryRoute[] = order.slice(0, targetIndex + 1).map((name) => {
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
