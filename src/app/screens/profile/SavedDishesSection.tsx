import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  SavedDishCard,
  SavedMapView,
  SavedSortMenu,
  SwipeToRemove,
  type SavedMapViewPin,
} from "@/components/saved";
import { AppSymbol, AppText, EmptyState, SegmentedControl, Skeleton } from "@/components/ui";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import {
  buildSavedDirectionsUrl,
  formatSavedDishDistance,
  getSavedOrigin,
  groupSavedMapPins,
  savedListHasPhotos,
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
import type { SavedDishTab, SavedViewMode } from "@/store/useSavedViewStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { dishPrefillFrom } from "@/features/detail/dishPrefill";

type Tab = SavedDishTab;

/** How long the Undo toast stays up. */
const UNDO_TOAST_MS = 5000;
type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Favourites">;
  saved: SavedDishesState;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  mode: SavedViewMode;
  onModeChange: (mode: SavedViewMode) => void;
};

/**
 * Saved > Dishes: Want to try / Tried as a segmented control, a List / Map switch, a sort menu
 * (Recent, Nearest, Top rated), a distance on each card, Directions to the stall's Google Maps
 * listing, swipe to remove and Undo. The same cards serve the live and the mock build. Search
 * lives at the top of the whole Saved page, not here.
 */
export function SavedDishesSection({
  navigation,
  saved,
  tab,
  onTabChange,
  mode,
  onModeChange,
}: Props) {
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
    () => sortSavedDishes(tabDishes, sort, origin),
    [origin, sort, tabDishes],
  );

  // Experiments are exposed only once the variant is on screen.
  const density = useExperimentVariant("saved_card_density_v1", {
    enabled: isReady && mode === "list" && savedListHasPhotos(tabDishes),
  });
  const defaultSort = useExperimentVariant("saved_default_sort_v1", {
    enabled: isReady && tabDishes.length > 0 && origin !== undefined,
  });
  useEffect(() => {
    if (defaultSort === "nearest" && origin && !pickedSort.current) setSort("nearest");
  }, [defaultSort, origin]);
  // The list decides first: while most saved dishes have no photo, a photo card is a grey box
  // and only two fit on a screen, so rows. The density experiment moves photo-rich lists only.
  const layout = !savedListHasPhotos(tabDishes) || density === "compact_rows" ? "row" : "card";

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

  const openDish = (dish: SavedDish, position: number, source: "list" | "map" = "list") => {
    trackAnalyticsEvent("saved_item_opened", {
      item_type: "dish",
      dish_id: dish.id,
      position,
      tab,
      layout,
      source,
    });
    rootNavigation.navigate("DishDetail", {
      dishId: dish.id,
      source: "saved",
      prefill: dishPrefillFrom(dish),
    });
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

  const { pins: mapPins, notOnMap } = useMemo(() => groupSavedMapPins(visible), [visible]);
  const viewPins = useMemo<SavedMapViewPin[]>(
    () =>
      mapPins.map((pin) => ({
        id: pin.id,
        coordinate: pin.coordinate,
        title: pin.venueName,
        count: pin.dishes.length,
      })),
    [mapPins],
  );

  const chooseMode = (next: SavedViewMode) => {
    if (next === mode) return;
    onModeChange(next);
    if (next === "map") {
      trackAnalyticsEvent("saved_map_opened", {
        section: "dishes",
        tab,
        pin_count: viewPins.length,
        not_on_map: notOnMap.length,
        has_location: origin !== undefined,
      });
    }
  };

  const renderDishCard = (
    dish: SavedDish,
    index: number,
    cardLayout: "card" | "row",
    source: "list" | "map",
  ) => (
    <SavedDishCard
      key={dish.id}
      dish={dish}
      layout={cardLayout}
      distanceLabel={formatSavedDishDistance(dish, origin)}
      tried={reviewedDishIds.includes(dish.id)}
      canRemove={tab === "want"}
      removing={pendingDishId === dish.id}
      onDirections={buildSavedDirectionsUrl(dish) ? () => openDirections(dish) : undefined}
      onOpen={() => openDish(dish, index, source)}
      onPressIn={() => {
        prefetchDishDetail(dish.id);
        preloadRoute(rootNavigation, "DishDetail", { dishId: dish.id });
      }}
      onRemove={() => void removeDish(dish)}
      onToggleTried={() => void toggleTried(dish)}
      onReview={() => openReview(dish)}
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
  const hasDishes = tabDishes.length > 0;
  return (
    <View style={{ gap: spacing[3] }}>
      <SegmentedControl
        accessibilityLabel="Show dishes you want to try or have tried"
        value={tab}
        onChange={onTabChange}
        options={[
          { value: "want", label: `Want to try (${wantCount})` },
          { value: "tried", label: `Tried (${triedCount})` },
        ]}
      />
      {hasDishes ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <View style={{ flex: 1, maxWidth: 200 }}>
            <SegmentedControl
              accessibilityLabel="Show saved dishes as a list or on a map"
              value={mode}
              onChange={chooseMode}
              options={[
                { value: "list", label: "List", accessibilityLabel: "List view" },
                { value: "map", label: "Map", accessibilityLabel: "Map view" },
              ]}
            />
          </View>
          <View style={{ flex: 1 }} />
          {mode === "list" && tabDishes.length > 1 ? (
            <SavedSortMenu value={sort} hasLocation={origin !== undefined} onChange={chooseSort} />
          ) : null}
        </View>
      ) : null}
      {hasDishes && mode === "map" ? (
        <SavedMapView
          pins={viewPins}
          noun="dish"
          origin={origin}
          notOnMapCount={notOnMap.length}
          onShowNotOnMap={() => onModeChange("list")}
          renderPinCard={(pinId) =>
            (mapPins.find((pin) => pin.id === pinId)?.dishes ?? []).map((dish, index) =>
              renderDishCard(dish, index, "row", "map"),
            )
          }
        />
      ) : hasDishes ? (
        <View style={{ gap: layout === "row" ? spacing[2] : spacing[4] }}>
          {visible.map((dish, index) => (
            <SwipeToRemove
              key={dish.id}
              label={dish.name}
              enabled={tab === "want"}
              removing={pendingDishId === dish.id}
              onRemove={() => void removeDish(dish)}
            >
              {renderDishCard(dish, index, layout, "list")}
            </SwipeToRemove>
          ))}
          {unavailableCount > 0 ? (
            <AppText tone="muted" variant="micro">
              {unavailableCount === 1
                ? "1 saved dish is not in the current catalog."
                : `${unavailableCount} saved dishes are not in the current catalog.`}
            </AppText>
          ) : null}
        </View>
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
