import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Search, X } from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { SavedDishCard } from "@/components/saved";
import { AppText, Chip, EmptyState, Input, Skeleton } from "@/components/ui";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import {
  SAVED_SORTS,
  SAVED_SORT_LABELS,
  buildSavedDirectionsUrl,
  formatSavedDishDistance,
  getSavedOrigin,
  matchesSavedDishQuery,
  sortSavedDishes,
  type SavedSort,
} from "@/features/saved/savedDishes";
import type { SavedDishesState } from "@/features/saved/useSavedDishes";
import { confirmHaptic } from "@/lib/haptics";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getExperimentVariant, useExperimentVariant } from "@/lib/experiments/experiments";
import type { SavedDishCard as SavedDish } from "@/lib/services/types";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Tab = "want" | "tried";

/** How long the Undo toast stays up. */
const UNDO_TOAST_MS = 5000;
/** Wait for the diner to stop typing before counting a search. */
const SEARCH_EVENT_DELAY_MS = 800;

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Favourites">;
  saved: SavedDishesState;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
};

/**
 * Saved > Dishes: Want to try and Tried, with search, sort (Recent, Nearest, Top rated), a
 * distance on each card, Directions to the stall's Google Maps listing, and Undo on a remove.
 * The same cards serve the live and the mock build.
 */
export function SavedDishesSection({ navigation, saved, tab, onTabChange }: Props) {
  const { palette, spacing } = useHungryTheme();
  const rootNavigation = getRootNavigation(navigation as never);
  const reviewedDishIds = useProfileStore((state) => state.profile.reviewedDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const setDishTried = useProfileStore((state) => state.setDishTried);
  const showToast = useUIStore((state) => state.showToast);
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const origin = useMemo(
    () => getSavedOrigin({ permission, currentLocation, manualCoordinate }),
    [currentLocation, manualCoordinate, permission],
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SavedSort>("recent");
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);
  const undoing = useRef(new Set<string>());
  const pickedSort = useRef(false);

  const isReady = saved.status === "ready";
  const idsForTab = tab === "want" ? saved.savedIds : saved.triedIds;
  const tabDishes = useMemo(
    () => idsForTab.flatMap((id) => saved.cards.get(id) ?? []),
    [idsForTab, saved.cards],
  );
  const wantCount = useMemo(
    () => saved.savedIds.filter((id) => saved.cards.has(id)).length,
    [saved.cards, saved.savedIds],
  );
  const triedCount = useMemo(
    () => saved.triedIds.filter((id) => saved.cards.has(id)).length,
    [saved.cards, saved.triedIds],
  );
  const unavailableCount =
    tab === "want" ? idsForTab.filter((id) => saved.goneIds.has(id)).length : 0;
  const visible = useMemo(
    () =>
      sortSavedDishes(
        tabDishes.filter((dish) => matchesSavedDishQuery(dish, query)),
        sort,
        origin,
      ),
    [origin, query, sort, tabDishes],
  );

  // Experiments are exposed only once the variant is on screen.
  const density = useExperimentVariant("saved_card_density_v1", {
    enabled: isReady && tabDishes.length > 0,
  });
  const defaultSort = useExperimentVariant("saved_default_sort_v1", {
    enabled: isReady && tabDishes.length > 0 && origin !== undefined,
  });
  useEffect(() => {
    if (defaultSort === "nearest" && origin && !pickedSort.current) setSort("nearest");
  }, [defaultSort, origin]);
  const layout = density === "compact_rows" ? "row" : "card";

  const viewedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isReady || viewedFor.current === tab) return;
    viewedFor.current = tab;
    trackAnalyticsEvent("saved_viewed", {
      tab,
      count: tab === "want" ? wantCount : triedCount,
      has_location: origin !== undefined,
    });
  }, [isReady, origin, tab, triedCount, wantCount]);

  const trimmedQuery = query.trim();
  const resultCount = visible.length;
  useEffect(() => {
    if (trimmedQuery.length < 2) return undefined;
    const timer = setTimeout(
      () =>
        trackAnalyticsEvent("saved_search_used", {
          tab,
          query_length: trimmedQuery.length,
          result_count: resultCount,
        }),
      SEARCH_EVENT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [resultCount, tab, trimmedQuery]);

  const chooseSort = (next: SavedSort) => {
    if (next === "nearest" && !origin) {
      showToast({ message: "Turn on location to sort by nearest.", tone: "info" });
      return;
    }
    pickedSort.current = true;
    if (next === sort) return;
    trackAnalyticsEvent("saved_sort_changed", { sort: next, previous: sort, tab });
    setSort(next);
  };

  const openDish = (dish: SavedDish, position: number) => {
    trackAnalyticsEvent("saved_item_opened", {
      item_type: "dish",
      dish_id: dish.id,
      position,
      tab,
      layout,
    });
    rootNavigation.navigate("DishDetail", { dishId: dish.id, source: "saved" });
  };

  const openDirections = (dish: SavedDish) => {
    const url = buildSavedDirectionsUrl(dish);
    if (!url) return;
    trackAnalyticsEvent("saved_directions_opened", {
      dish_id: dish.id,
      venue_id: dish.venueId,
      tab,
    });
    void openTrustedMapsUrl(url);
  };

  /** Undo of a remove or a Tried change: puts the dish back exactly as it was. */
  const undo = async (dish: SavedDish, action: () => Promise<boolean>) => {
    if (undoing.current.has(dish.id)) return;
    undoing.current.add(dish.id);
    try {
      const restored = await action();
      if (restored) trackAnalyticsEvent("saved_undo_used", { dish_id: dish.id, tab });
      else showToast({ message: "Couldn't undo that. Try again.", tone: "error" });
    } finally {
      undoing.current.delete(dish.id);
    }
  };

  const removeDish = async (dish: SavedDish) => {
    setPendingDishId(dish.id);
    try {
      const input = { id: dish.id, venueId: dish.venueId ?? "" };
      const result = await toggleFavourite(input, { surface: "saved" });
      if (result.status === "failed") {
        showToast({ message: result.message, tone: "error" });
      } else if (result.status === "removed") {
        // Exposed here, when the diner actually sees the toast.
        const withUndo =
          getExperimentVariant("saved_remove_undo_v1", { expose: true }) === "undo_toast";
        showToast(
          withUndo
            ? {
                message: "Removed from Saved.",
                tone: "success",
                duration: UNDO_TOAST_MS,
                action: {
                  label: "Undo",
                  onPress: () =>
                    void undo(dish, async () => {
                      const restored = await toggleFavourite(input, { surface: "saved_undo" });
                      return restored.status === "saved";
                    }),
                },
              }
            : { message: "Removed from Saved.", tone: "success" },
        );
      } else {
        showToast({ message: "This dish is still saved.", tone: "info" });
      }
    } finally {
      setPendingDishId(null);
    }
  };

  const toggleTried = async (dish: SavedDish) => {
    const wasTried = reviewedDishIds.includes(dish.id);
    const done = await setDishTried(dish.id, !wasTried);
    if (!done) {
      showToast({ message: "Couldn't update your tried dishes. Try again.", tone: "error" });
      return;
    }
    confirmHaptic();
    const withUndo =
      getExperimentVariant("saved_remove_undo_v1", { expose: true }) === "undo_toast";
    showToast({
      message: wasTried ? "Removed from your tried dishes." : "Marked as tried.",
      tone: "success",
      ...(withUndo
        ? {
            duration: UNDO_TOAST_MS,
            action: {
              label: "Undo",
              onPress: () => void undo(dish, () => setDishTried(dish.id, wasTried)),
            },
          }
        : {}),
    });
  };

  const openReview = (dish: SavedDish) => {
    if (!dish.venueId) return;
    rootNavigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: dish.venueId, dishId: dish.id },
    });
  };

  const search = (
    <Input
      placeholder="Search your saved dishes"
      accessibilityLabel="Search your saved dishes"
      value={query}
      onChangeText={setQuery}
      returnKeyType="search"
      autoCorrect={false}
      leftIcon={<Search color={palette.textMuted} size={18} />}
      rightIcon={
        query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            onPress={() => setQuery("")}
          >
            <X color={palette.textMuted} size={18} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (saved.status === "loading") {
    return (
      <View accessibilityLabel="Loading saved dishes" style={{ gap: spacing[3] }}>
        <Skeleton height={96} />
        <Skeleton height={96} />
        <Skeleton height={96} />
      </View>
    );
  }
  if (saved.status === "error") {
    return (
      <EmptyState
        title="Couldn't load your saved dishes"
        body={`${saved.errorMessage ?? ""} Check your connection and try again.`.trim()}
        ctaLabel="Retry"
        onPress={() => void saved.reload()}
      />
    );
  }

  const discoverDishes = () => rootNavigation.navigate("MainTabs", { screen: "Discover" });
  return (
    <View style={{ gap: spacing[3] }}>
      {search}
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <Chip
          label={`Want to try (${wantCount})`}
          selected={tab === "want"}
          onPress={() => onTabChange("want")}
        />
        <Chip
          label={`Tried (${triedCount})`}
          selected={tab === "tried"}
          onPress={() => onTabChange("tried")}
        />
      </View>
      {tabDishes.length > 1 ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Sort saved dishes"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
        >
          {SAVED_SORTS.map((key) => (
            <Chip
              key={key}
              label={SAVED_SORT_LABELS[key]}
              accessibilityLabel={
                key === "nearest" && !origin
                  ? "Sort by nearest. Turn on location to use this."
                  : `Sort by ${SAVED_SORT_LABELS[key].toLowerCase()}`
              }
              selected={sort === key}
              onPress={() => chooseSort(key)}
            />
          ))}
        </View>
      ) : null}
      {visible.length > 0 ? (
        <View style={{ gap: layout === "row" ? spacing[2] : spacing[4] }}>
          {visible.map((dish, index) => (
            <SavedDishCard
              key={dish.id}
              dish={dish}
              layout={layout}
              distanceLabel={formatSavedDishDistance(dish, origin)}
              tried={reviewedDishIds.includes(dish.id)}
              canRemove={tab === "want"}
              removing={pendingDishId === dish.id}
              onDirections={buildSavedDirectionsUrl(dish) ? () => openDirections(dish) : undefined}
              onOpen={() => openDish(dish, index)}
              onPressIn={() => {
                prefetchDishDetail(dish.id);
                preloadRoute(rootNavigation, "DishDetail", { dishId: dish.id });
              }}
              onRemove={() => void removeDish(dish)}
              onToggleTried={() => void toggleTried(dish)}
              onReview={() => openReview(dish)}
            />
          ))}
          {unavailableCount > 0 ? (
            <AppText tone="muted" variant="micro">
              {unavailableCount === 1
                ? "1 saved dish is not in the current catalog."
                : `${unavailableCount} saved dishes are not in the current catalog.`}
            </AppText>
          ) : null}
        </View>
      ) : tabDishes.length > 0 ? (
        <EmptyState
          title="No matches"
          body={`No saved dish matches "${trimmedQuery}".`}
          ctaLabel="Clear search"
          onPress={() => setQuery("")}
        />
      ) : unavailableCount > 0 ? (
        <EmptyState
          title="Saved dishes unavailable"
          body="Your saved dishes are not in the current catalog."
          ctaLabel="Discover dishes"
          onPress={discoverDishes}
        />
      ) : (
        <EmptyState
          title={tab === "want" ? "Nothing saved yet" : "No dishes tried yet"}
          body={
            tab === "want"
              ? "Save dishes you want to try and they'll show up here."
              : "Mark a dish as tried to keep a record here."
          }
          ctaLabel="Discover dishes"
          onPress={discoverDishes}
        />
      )}
    </View>
  );
}
