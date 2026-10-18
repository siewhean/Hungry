import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  buildWeeklyPicks,
  getWeeklyPicksKey,
  isWeeklyPicksPersonalised,
} from "@/features/home/weeklyPicks";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { AccessibleImage, AppText, Button } from "../ui";
import { NoDishPhoto } from "./NoDishPhoto";

interface WeeklyPicksRailProps {
  horizontalPadding: number;
  onOpenDish: (dishId: string) => void;
  onDecideForMe: () => void;
}

const CARD_WIDTH = 148;

/** "Your 5 dishes to try this week" plus a one-tap Decide for me, shown at the top of Home. */
export function WeeklyPicksRail({
  horizontalPadding,
  onOpenDish,
  onDecideForMe,
}: WeeklyPicksRailProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const weekKey = getWeeklyPicksKey();
  const lastTrackedWeek = useRef<string | null>(null);

  const { picks, personalised } = useMemo(() => {
    const candidates = getDataRepository().searchDishes(
      {
        query: "",
        categories: [],
        dietaryFlags: profile.dietaryPreferences,
        tasteValues: profile.tasteVector,
        radius: Number.MAX_SAFE_INTEGER,
      },
      profile.tasteVector,
    );
    return {
      picks: buildWeeklyPicks(candidates, profile, weekKey),
      personalised: isWeeklyPicksPersonalised(profile.tasteVector, candidates),
    };
  }, [profile, weekKey]);

  useEffect(() => {
    if (!picks.length || lastTrackedWeek.current === weekKey) return;
    lastTrackedWeek.current = weekKey;
    trackAnalyticsEvent("weekly_picks_viewed", { week: weekKey, count: picks.length });
  }, [picks.length, weekKey]);

  return (
    <View style={{ gap: spacing[3], paddingBottom: spacing[4], paddingTop: spacing[2] }}>
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <Button label="Decide for me" onPress={onDecideForMe} />
      </View>
      {picks.length ? (
        <>
          <View style={{ gap: spacing[1], paddingHorizontal: horizontalPadding }}>
            <AppText variant="h3">Your {picks.length} dishes to try this week</AppText>
            <AppText variant="bodySmall" tone="muted">
              {personalised ? "Picked for your taste." : "Popular near you."} New picks every
              Monday.
            </AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingHorizontal: horizontalPadding }}
          >
            {picks.map(({ dish, explanation }, index) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`${dish.name}, S$${dish.price.toFixed(2)}. ${explanation}`}
                onPress={() => {
                  trackAnalyticsEvent("weekly_pick_opened", {
                    week: weekKey,
                    dish_id: dish.id,
                    position: index,
                  });
                  onOpenDish(dish.id);
                }}
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  overflow: "hidden",
                  width: CARD_WIDTH,
                }}
              >
                {dish.imageUrl ? (
                  <AccessibleImage
                    source={{ uri: dish.imageUrl }}
                    style={{ height: 100, width: "100%" }}
                    contentFit="cover"
                    decorative
                  />
                ) : (
                  <NoDishPhoto dishName={dish.name} style={{ height: 100, width: "100%" }} />
                )}
                <View style={{ gap: spacing[1], padding: spacing[2] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.venueName} · S${dish.price.toFixed(2)}
                  </AppText>
                  <AppText variant="micro" tone="muted" numberOfLines={2}>
                    {explanation}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}
