import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { isLateNightDish, isLateNightHour } from "@/features/discover/bites";
import { getDietaryChipLabel, HOME_CHEAP_PRICE_LIMIT } from "@/features/discover/homeFilters";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail } from "@/types/domain";
import { getSingaporeHour } from "@/utils/operatingHours";

/** The chips under the search bar. */
export type DiscoverChipId = "dietary" | "spicy" | "halal" | "late" | "cheap";

const INTENT_CHIPS: readonly {
  id: Exclude<DiscoverChipId, "dietary">;
  label: string;
}[] = [
  { id: "spicy", label: "Spicy" },
  { id: "halal", label: "Halal" },
  { id: "late", label: "Late night" },
  { id: "cheap", label: "Under S$5" },
] as const;

type UseDiscoverFiltersOptions = {
  /** Opening hours of a stall, for the late-night chip. */
  getVenueHours: (venueId?: string) => string | undefined;
  /** Where the dietary chip goes when the diner has no dietary needs saved yet. */
  onOpenDietarySettings: () => void;
};

/** The Home chips: which are on, the deferred copy the page filters by, and what each chip keeps. */
export function useDiscoverFilters({
  getVenueHours,
  onOpenDietarySettings,
}: UseDiscoverFiltersOptions) {
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);

  // Dietary Needs starts on for a diner who has set dietary needs, so nothing unsuitable shows.
  const [activeDiscoverChipIds, setActiveDiscoverChipIds] = useState<DiscoverChipId[]>(() =>
    profile.dietaryPreferences.length ? ["dietary"] : [],
  );
  const dietaryAutoOnRef = useRef(profile.dietaryPreferences.length > 0);
  useEffect(() => {
    if (profile.dietaryPreferences.length === 0) {
      // No needs left (cleared in Settings): the chip filters nothing, and the next save
      // switches it on again.
      dietaryAutoOnRef.current = false;
      setActiveDiscoverChipIds((ids) =>
        ids.includes("dietary") ? ids.filter((id) => id !== "dietary") : ids,
      );
      return;
    }
    // The profile can finish loading after the first render; switch it on once, never again.
    if (dietaryAutoOnRef.current) return;
    dietaryAutoOnRef.current = true;
    setActiveDiscoverChipIds((ids) => (ids.includes("dietary") ? ids : [...ids, "dietary"]));
  }, [profile.dietaryPreferences.length]);

  const deferredDiscoverChipIds = useDeferredValue(activeDiscoverChipIds);
  const deferredDiscoverChipSet = useMemo(
    () => new Set<DiscoverChipId>(deferredDiscoverChipIds),
    [deferredDiscoverChipIds],
  );
  const activeDiscoverChipSignature = activeDiscoverChipIds.join("|");
  const deferredDiscoverChipSignature = deferredDiscoverChipIds.join("|");
  // Filtering is local and instant: the skeleton only covers the deferred re-render.
  const isPopularFoodFilterPending = activeDiscoverChipSignature !== deferredDiscoverChipSignature;
  const isDiscoverFiltering = deferredDiscoverChipIds.length > 0;

  // One Singapore-time hour for the chip order and the late-night rail, refreshed on focus.
  const [currentHour, setCurrentHour] = useState(() => getSingaporeHour());
  useFocusEffect(
    useCallback(() => {
      setCurrentHour(getSingaporeHour());
    }, []),
  );
  const sortedChips = useMemo(() => {
    // The first chip names the diner's saved needs; a saved halal need already is the Halal chip.
    const intentChips = profile.dietaryPreferences.includes("halal")
      ? INTENT_CHIPS.filter((chip) => chip.id !== "halal")
      : INTENT_CHIPS;
    const baseChips = [
      { id: "dietary" as const, label: getDietaryChipLabel(profile.dietaryPreferences) },
      ...intentChips,
    ];
    // "Late night" only shows from 21:00 to 03:59, and then leads the row.
    if (isLateNightHour(currentHour)) {
      return baseChips.sort((a, b) => (a.id === "late" ? -1 : b.id === "late" ? 1 : 0));
    }
    return baseChips.filter((chip) => chip.id !== "late");
  }, [currentHour, profile.dietaryPreferences]);

  const toggleDiscoverChip = useCallback(
    (chipId: DiscoverChipId) => {
      if (chipId === "dietary" && profile.dietaryPreferences.length === 0) {
        // Nothing to filter by yet: the chip is the way to set dietary needs.
        trackAnalyticsEvent("discover_chip_tapped", {
          surface: "home",
          chip: chipId,
          selected: false,
          opened_settings: true,
        });
        onOpenDietarySettings();
        return;
      }
      const wasActive = activeDiscoverChipIds.includes(chipId);
      const nextChipIds = wasActive
        ? activeDiscoverChipIds.filter((value) => value !== chipId)
        : [...activeDiscoverChipIds, chipId];

      trackAnalyticsEvent("discover_chip_tapped", {
        surface: "home",
        chip: chipId,
        selected: !wasActive,
      });

      if (!wasActive && chipId !== "dietary") {
        scheduleIdleWork(
          () => {
            recordTasteInteraction({
              type: "search_query",
              surface: "discover",
              query: chipId,
              chipId,
            });
          },
          { timeout: 500, fallbackDelayMs: 80 },
        );
      }

      setActiveDiscoverChipIds(nextChipIds);
    },
    [
      activeDiscoverChipIds,
      onOpenDietarySettings,
      profile.dietaryPreferences.length,
      recordTasteInteraction,
    ],
  );
  const matchesDiscoverChipSelection = useCallback(
    (dish?: DishDetail, textParts: string[] = []) => {
      if (!deferredDiscoverChipSet.size) {
        return true;
      }
      let cachedHaystack: string | null = null;
      const getLateNightHaystack = () => {
        if (cachedHaystack !== null) {
          return cachedHaystack;
        }

        cachedHaystack = [
          dish?.name,
          dish?.venueName,
          dish?.tasteTags.join(" "),
          dish?.priceRange,
          ...textParts,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return cachedHaystack;
      };

      return Array.from(deferredDiscoverChipSet).every((chipId) => {
        if (chipId === "dietary") {
          if (!dish) return false;
          // Saved needs must all hold.
          return profile.dietaryPreferences.every((flag) => dish.dietaryFlags.includes(flag));
        }
        if (chipId === "halal") {
          // Structured flag only: text matching let "non-halal" through.
          return Boolean(dish?.dietaryFlags.includes("halal"));
        }
        if (chipId === "spicy") {
          return (
            Boolean(dish && dish.tasteVector.spicy >= 6) || getLateNightHaystack().includes("spicy")
          );
        }
        if (chipId === "late") {
          // Same rule as the late-night rail: the stall's hours run past 22:00.
          return isLateNightDish(dish, getVenueHours(dish?.venueId));
        }
        if (chipId === "cheap") {
          return Boolean(dish && dish.price > 0 && dish.price < HOME_CHEAP_PRICE_LIMIT);
        }
        return true;
      });
    },
    [deferredDiscoverChipSet, getVenueHours, profile.dietaryPreferences],
  );

  const clearDiscoverFilters = useCallback(() => {
    trackAnalyticsEvent("home_filters_cleared", {
      surface: "home",
      chips: activeDiscoverChipIds.join(","),
    });
    setActiveDiscoverChipIds([]);
  }, [activeDiscoverChipIds]);

  return {
    deferredDiscoverChipIds,
    activeDiscoverChipSignature,
    isPopularFoodFilterPending,
    isDiscoverFiltering,
    sortedChips,
    toggleDiscoverChip,
    matchesDiscoverChipSelection,
    clearDiscoverFilters,
    activeDiscoverChipIds,
    currentHour,
  };
}
