import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { X } from "lucide-react-native";

import { isReturningAfterBreak } from "@/features/lifecycle/lifecycle";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useLifecycleStore } from "@/store/useLifecycleStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useHungryTheme } from "@/theme";
import type { LifecycleSnapshot, WelcomeBackDish } from "@/types/domain";
import { AppText, Button, Card, IconButton } from "../ui";

interface WelcomeBackCardProps {
  horizontalPadding: number;
  /** False while the host screen is not on screen (tab warm-up), so no exposure is logged. */
  visible?: boolean;
  onOpenDish: (dishId: string) => void;
  onOpenSaved: () => void;
}

/**
 * Shown on Home to users back after more than a week (reactivated or
 * resurrected): their saved dishes and what is new at stalls they follow,
 * instead of a cold feed. Runs as the welcome_back_v2 experiment (Home tab).
 */
export function WelcomeBackCard(props: WelcomeBackCardProps) {
  const snapshot = useLifecycleStore((state) => state.snapshot);
  const dismissed = useLifecycleStore((state) => state.welcomeBackDismissed);
  // The card's actions are saved dishes and new dishes at followed stalls; with neither there
  // is nothing to tap, so those diners are not eligible in either arm.
  const hasSavedDishes = useProfileStore((state) => state.profile.favouriteDishIds.length > 0);
  const followsAStall = useStallFollowStore((state) => state.followedStallIds.length > 0);

  // Read the experiment only for eligible users, so exposure counts only them.
  if (!snapshot || dismissed || !isReturningAfterBreak(snapshot.state)) return null;
  if (!hasSavedDishes && !followsAStall) return null;
  return <WelcomeBackExperiment snapshot={snapshot} {...props} />;
}

function WelcomeBackExperiment({
  snapshot,
  horizontalPadding,
  visible = true,
  onOpenDish,
  onOpenSaved,
}: WelcomeBackCardProps & { snapshot: LifecycleSnapshot }) {
  const { palette, radii, spacing } = useHungryTheme();
  // Fallback is control: before flags load (and with PostHog off) nothing renders.
  const variant = useExperimentVariant("welcome_back_v2", { enabled: visible });
  const savedCount = useProfileStore((state) => state.profile.favouriteDishIds.length);
  const dismiss = useLifecycleStore((state) => state.dismissWelcomeBack);
  const [newDishes, setNewDishes] = useState<WelcomeBackDish[]>([]);
  const alreadyShown = useLifecycleStore((state) => state.welcomeBackShown);
  const markShown = useLifecycleStore((state) => state.markWelcomeBackShown);
  const showCard = visible && variant === "test";

  useEffect(() => {
    if (!showCard || !snapshot.previousActiveDate) return;
    let cancelled = false;
    void getHungryService()
      .lifecycle.getWelcomeBackDishes(snapshot.previousActiveDate)
      .then((dishes) => {
        if (!cancelled) setNewDishes(dishes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [showCard, snapshot.previousActiveDate]);

  // Once per app session: Home remounts the card whenever its content reloads.
  useEffect(() => {
    if (!showCard || alreadyShown) return;
    markShown();
    trackAnalyticsEvent("welcome_back_shown", {
      lifecycle_state: snapshot.state,
      days_since_previous: snapshot.daysSincePrevious,
    });
  }, [alreadyShown, markShown, showCard, snapshot.daysSincePrevious, snapshot.state]);

  if (!showCard) return null;

  const days = snapshot.daysSincePrevious;
  const intro = days ? `It's been ${days} days.` : "Good to see you again.";
  const savedLine =
    savedCount > 0
      ? ` Your ${savedCount} saved ${savedCount === 1 ? "dish is" : "dishes are"} still here.`
      : "";

  return (
    <View style={{ paddingBottom: spacing[3], paddingHorizontal: horizontalPadding }}>
      <Card style={{ gap: spacing[3] }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}>
          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText variant="h3">Welcome back</AppText>
            <AppText variant="bodySmall" tone="muted">
              {intro}
              {savedLine}
            </AppText>
          </View>
          <IconButton
            accessibilityLabel="Close welcome back"
            icon={<X size={18} color={palette.text} />}
            variant="ghost"
            onPress={() => {
              trackAnalyticsEvent("welcome_back_dismissed", { lifecycle_state: snapshot.state });
              dismiss();
            }}
          />
        </View>

        {newDishes.length ? (
          <View style={{ gap: spacing[2] }}>
            <AppText variant="bodySmallBold">New at stalls you follow</AppText>
            {newDishes.map((dish) => (
              <Pressable
                key={dish.dishId}
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.dishName} at ${dish.stallName}`}
                onPress={() => {
                  trackAnalyticsEvent("welcome_back_opened", { target: "new_dish" });
                  onOpenDish(dish.dishId);
                }}
                style={{
                  borderColor: palette.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                }}
              >
                <AppText variant="bodySmall" numberOfLines={1}>
                  {dish.dishName}
                  {dish.stallName ? ` · ${dish.stallName}` : ""}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {savedCount > 0 ? (
          <Button
            label="See saved dishes"
            variant="secondary"
            onPress={() => {
              trackAnalyticsEvent("welcome_back_opened", { target: "saved_dishes" });
              onOpenSaved();
            }}
          />
        ) : null}
      </Card>
    </View>
  );
}
