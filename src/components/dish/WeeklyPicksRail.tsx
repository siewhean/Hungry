import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  buildWeeklyPicks,
  getWeeklyPicksCacheKey,
  getWeeklyPicksKey,
  isWeeklyPicksPersonalised,
  resolveStoredWeeklyPicks,
} from "@/features/home/weeklyPicks";
import { useFoodHistory } from "@/hooks/useFoodHistory";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useWeeklyPicksStore } from "@/store/useWeeklyPicksStore";
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
  const personalisation = useFoodHistory();
  const stored = useWeeklyPicksStore((state) => state.stored);
  const savePicks = useWeeklyPicksStore((state) => state.save);
  // Taste changes on every like or save; the picks are read from here at compute time only.
  const inputsRef = useRef({ profile, personalisation });
  useEffect(() => {
    inputsRef.current = { profile, personalisation };
  }, [profile, personalisation]);
  const cacheKey = getWeeklyPicksCacheKey(profile.id, weekKey, profile.dietaryPreferences);

  // Picks are computed once per account, week and dietary filter, then reused all week.
  const { picks, personalised, isFresh } = useMemo(() => {
    const repository = getDataRepository();
    if (stored?.key === cacheKey) {
      const resolved = resolveStoredWeeklyPicks(stored, (dishId) => repository.getDishById(dishId));
      if (resolved) return { picks: resolved, personalised: stored.personalised, isFresh: false };
    }
    const current = inputsRef.current;
    const candidates = repository.searchDishes(
      {
        query: "",
        categories: [],
        dietaryFlags: current.profile.dietaryPreferences,
        tasteValues: current.profile.tasteVector,
        radius: Number.MAX_SAFE_INTEGER,
      },
      current.profile.tasteVector,
    );
    return {
      picks: buildWeeklyPicks(
        candidates,
        current.profile,
        weekKey,
        undefined,
        current.personalisation,
      ),
      personalised: isWeeklyPicksPersonalised(current.profile.tasteVector, candidates),
      isFresh: true,
    };
  }, [cacheKey, stored, weekKey]);

  useEffect(() => {
    if (!isFresh || !picks.length) return;
    savePicks({
      key: cacheKey,
      personalised,
      picks: picks.map(({ dish, explanation }) => ({ dishId: dish.id, explanation })),
    });
  }, [cacheKey, isFresh, personalised, picks, savePicks]);

  useEffect(() => {
    if (!picks.length || lastTrackedWeek.current === weekKey) return;
    lastTrackedWeek.current = weekKey;
    trackAnalyticsEvent("weekly_picks_viewed", { week: weekKey, count: picks.length });
  }, [picks.length, weekKey]);

  return (
    <View style={{ gap: spacing[3], paddingBottom: spacing[4], paddingTop: spacing[2] }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[3],
          justifyContent: "space-between",
          paddingHorizontal: horizontalPadding,
        }}
      >
        {picks.length ? (
          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText variant="h3">Your {picks.length} dishes to try this week</AppText>
            <AppText variant="bodySmall" tone="muted">
              {personalised ? "Picked for your taste." : "Popular on Hungry."} New picks every
              Monday.
            </AppText>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Button label="Decide for me" size="sm" onPress={onDecideForMe} />
      </View>
      {picks.length ? (
        <>
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
                    style={{ height: 84, width: "100%" }}
                    contentFit="cover"
                    decorative
                  />
                ) : (
                  <NoDishPhoto dishName={dish.name} style={{ height: 84, width: "100%" }} />
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
