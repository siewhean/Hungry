import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { AppSymbol, AppText, Button, Card } from "@/components/ui";
import { shouldOfferMealPicks } from "@/features/home/mealPicksNudge";
import { previewMeal, MEAL_LABELS, formatMealTime, pushTimeFor } from "@/features/onboarding/mealTimes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useHomeNudgeStore } from "@/store/useHomeNudgeStore";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

type PermissionState = "granted" | "denied" | "undetermined";

type MealPicksCardProps = {
  horizontalPadding: number;
  /** Test seams; the app uses the phone's push module. */
  getPermission?: () => Promise<PermissionState>;
  register?: (options: { askPermission: boolean }) => Promise<boolean>;
  isNative?: boolean;
};

async function phonePermission(): Promise<PermissionState> {
  const push = await import("@/lib/notifications/push");
  return push.getNotificationPermissionState();
}

async function phoneRegister(options: { askPermission: boolean }): Promise<boolean> {
  const push = await import("@/lib/notifications/push");
  return push.registerForStallAlerts(options);
}

/**
 * Home: the meal-picks push, offered after the diner's first save or tried rather than in
 * onboarding, so the phone's one permission prompt comes when the app has shown its worth.
 */
export function MealPicksCard({
  horizontalPadding,
  getPermission = phonePermission,
  register = phoneRegister,
  isNative = Platform.OS !== "web",
}: MealPicksCardProps) {
  const { palette, spacing } = useHungryTheme();
  const signedIn = useSessionStore((state) => state.isAuthenticated);
  const savedOrTriedCount = useProfileStore(
    (state) => state.profile.favouriteDishIds.length + state.profile.reviewedDishIds.length,
  );
  const snoozed = useHomeNudgeStore((state) => state.isMealPicksSnoozed());
  const snooze = useHomeNudgeStore((state) => state.snoozeMealPicks);
  const mealTimes = useOnboardingAnswersStore((state) => state.mealTimes);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative || !signedIn) return;
    let cancelled = false;
    getPermission()
      .then((state) => {
        if (!cancelled) setPermission(state);
      })
      .catch((error) => reportError(error, { area: "meal_picks_card", action: "read_permission" }));
    return () => {
      cancelled = true;
    };
  }, [getPermission, isNative, signedIn]);

  const show = shouldOfferMealPicks({ isNative, signedIn, permission, savedOrTriedCount, snoozed });

  useEffect(() => {
    if (show) trackAnalyticsEvent("meal_picks_card_shown", {});
  }, [show]);

  if (!show) return null;

  const meal = previewMeal(mealTimes);
  const when = meal
    ? `${formatMealTime(pushTimeFor(meal.time))}, before your ${MEAL_LABELS[meal.meal].toLowerCase()}`
    : "before lunch and dinner";

  const turnOn = async () => {
    setBusy(true);
    try {
      const allowed = await register({ askPermission: true });
      trackAnalyticsEvent("meal_picks_card_answered", { allowed });
      if (allowed) await getHungryService().push.updatePreferences({ mealtimeSuggestions: true });
      setPermission(allowed ? "granted" : "denied");
    } catch (error) {
      reportError(error, { area: "meal_picks_card", action: "turn_on" });
      setPermission("denied");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingBottom: spacing[3], paddingHorizontal: horizontalPadding }}>
      <Card style={{ gap: spacing[3] }} testID="meal-picks-card">
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start" }}>
          <AppSymbol name="notifications" size={20} color={palette.orange} />
          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText variant="h3">Three picks before you eat?</AppText>
            <AppText variant="bodySmall" tone="muted">
              {`A short note at ${when}, with three dishes for your taste. Never more than once per meal.`}
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Button
            label="Turn on"
            loading={busy}
            onPress={() => void turnOn()}
            style={{ flex: 1 }}
          />
          <Button
            label="Not now"
            variant="ghost"
            onPress={() => {
              trackAnalyticsEvent("meal_picks_card_snoozed", {});
              snooze();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Card>
    </View>
  );
}
