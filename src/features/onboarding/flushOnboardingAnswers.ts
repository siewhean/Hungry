import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";

/**
 * Sends what the person did before they had an account: the dishes they liked or passed, and the
 * lunch and dinner picks opt-in. Runs once the account exists (applySignedInProfile). The signals
 * are taken out of the store first, so a second sign-in refresh cannot send them twice. A failed
 * send is reported and dropped: a missing taste hint is not worth blocking sign-in.
 */
export async function flushOnboardingAnswers(
  registerAlerts?: (options: { askPermission: boolean }) => Promise<boolean>,
): Promise<void> {
  const { liked, passed, wantsMealPicks } = useOnboardingAnswersStore.getState().takeTasteSignals();
  if (liked.length === 0 && passed.length === 0 && !wantsMealPicks) return;
  const { recommendations, push } = getHungryService();

  const feedback = [
    ...liked.map((dishId) => ({ dishId, feedbackType: "dish_like" as const })),
    ...passed.map((dishId) => ({ dishId, feedbackType: "dismissed" as const })),
  ];
  for (const item of feedback) {
    try {
      // n-plus-one-ok: one explicit-feedback write per dish; the store keeps at most 30 each.
      await recommendations.recordExplicitFeedback({ ...item, surface: "home" });
    } catch (error) {
      reportError(error, { area: "onboarding_flush_feedback" });
    }
  }

  if (wantsMealPicks) {
    try {
      // The phone's permission was asked on the meal-picks screen; this only registers the token.
      // Loaded here, not at the top, so the push native modules stay out of unit tests.
      const register =
        registerAlerts ?? (await import("@/lib/notifications/push")).registerForStallAlerts;
      if (await register({ askPermission: false })) {
        await push.updatePreferences({ mealtimeSuggestions: true });
      }
    } catch (error) {
      reportError(error, { area: "onboarding_flush_meal_picks" });
    }
  }
}
