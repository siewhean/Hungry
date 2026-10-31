import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";

import { CollectionAlbumCard, NewCollectionTile } from "@/components/portfolio";
import {
  SavedMapView,
  SavedSearchBox,
  SavedSearchResults,
  SavedStallRow,
  SwipeToRemove,
  type SavedMapViewPin,
  SavedViewSwitch,
} from "@/components/saved";
import { AccessibleImage, AppText, Button, Chip, EmptyState } from "@/components/ui";
import { isLiveMapAvailable } from "@/components/map/mapAvailability";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { resolveListItemCount } from "@/features/checklistPortfolio/listLabels";
import { formatDistanceFromUser } from "@/features/detail/stallLocation";
import { prefetchStallDetail, preloadRoute } from "@/features/navigation/prefetch";
import { describeMissingStalls } from "@/features/profile/loadVenuesByIds";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import {
  SAVED_SECTION_LABELS,
  fitSavedPins,
  formatSavedCount,
  getSavedOrigin,
  matchesSavedDishQuery,
  visibleSavedSections,
  type SavedSection,
} from "@/features/saved/savedDishes";
import { useListCovers } from "@/features/saved/useListCovers";
import { useSavedDishes } from "@/features/saved/useSavedDishes";
import { useSavedSearch } from "@/features/saved/useSavedSearch";
import { useSavedStalls, type SavedStallsState } from "@/features/saved/useSavedStalls";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSavedViewStore } from "@/store/useSavedViewStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { Bite } from "@/lib/services/types";
import type { Portfolio, VenueSummary } from "@/types/domain";
import { ProfileGridSkeleton, ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";
import { SavedDishesSection } from "./SavedDishesSection";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

export { matchesSavedDishQuery, visibleSavedSections };

/**
 * Saved: the one place for everything the diner keeps. Dishes, Stalls and Lists (plus Posts
 * while the social feed is on) sit under one search box that looks across all of them and the
 * diner's own reviews. The section, the Want to try / Tried choice and the List / Map choice are
 * remembered while the app is open, and `section` in the route opens a given section.
 */
export function FavouritesScreen({ navigation, route }: Props) {
  const authenticatedUserId = useSessionStore((state) => state.authenticatedUserId);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const profileId = useProfileStore((state) => state.profile.id);
  const { spacing } = useHungryTheme();
  const section = useSavedViewStore((state) => state.section);
  const setSection = useSavedViewStore((state) => state.setSection);
  const tab = useSavedViewStore((state) => state.tab);
  const setTab = useSavedViewStore((state) => state.setTab);
  const mode = useSavedViewStore((state) => state.mode);
  const setMode = useSavedViewStore((state) => state.setMode);
  const rootNavigation = getRootNavigation(navigation as any);
  const showToast = useUIStore((state) => state.showToast);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // A deep link to a section (hungry://... Lists) wins over where the diner left it.
  const requestedSection = route.params?.section;
  useEffect(() => {
    if (requestedSection) setSection(requestedSection);
  }, [requestedSection, setSection]);
  const sections = visibleSavedSections(FEATURE_FLAGS.socialFeedEnabled);
  const activeSection: SavedSection = sections.includes(section) ? section : "dishes";

  // Loaded here, not inside the Dishes tab, so the header count matches the cards below.
  const userKey = `${authenticatedUserId ?? "guest"}:${profileId}`;
  const savedDishes = useSavedDishes(userKey);
  const savedDishCount = savedDishes.savedIds.filter((id) => savedDishes.cards.has(id)).length;

  // Stalls and lists are read as soon as a search, the Stalls section or the Lists section needs
  // them, then kept.
  const searching = query.trim() !== "";
  const [stallsWanted, setStallsWanted] = useState(false);
  useEffect(() => {
    if (searching || activeSection === "stalls") setStallsWanted(true);
  }, [activeSection, searching]);
  const savedStalls = useSavedStalls(stallsWanted);

  const ownerId = (isAuthenticated ? authenticatedUserId : undefined) ?? profileId;
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const mineIds = usePortfolioStore((state) => state.scopeIds.mine);
  const loadPortfolioScope = usePortfolioStore((state) => state.loadPortfolioScope);
  const canLoadLists = FEATURE_FLAGS.portfoliosEnabled && isAuthenticated;
  const loadOwnLists = useCallback(
    async () => {
      if (canLoadLists) await loadPortfolioScope("mine");
    },
    // ownerId: a different account reloads its own lists.

    [canLoadLists, loadPortfolioScope, ownerId],
  );
  const { failed: listsFailed, retry: retryLists } = useRetryableLoad(loadOwnLists, "saved lists");
  const ownLists = useMemo(() => {
    const byId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
    return (mineIds ?? [])
      .map((id) => byId.get(id))
      .filter((portfolio): portfolio is Portfolio => Boolean(portfolio));
  }, [mineIds, portfolios]);

  const searchableDishes = useMemo(
    () => savedDishes.savedIds.flatMap((id) => savedDishes.cards.get(id) ?? []),
    [savedDishes.cards, savedDishes.savedIds],
  );
  const search = useSavedSearch({
    rawQuery: query,
    userId: ownerId,
    dishes: searchableDishes,
    stalls: savedStalls.stalls,
    lists: ownLists,
  });

  // One event per finished search, not per keystroke.
  const searchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (search.status !== "ready" || searchedFor.current === search.query) return;
    searchedFor.current = search.query;
    trackAnalyticsEvent("saved_search_used", {
      scope: "all",
      query_length: search.query.length,
      result_count: search.results.total,
      dishes: search.results.dishes.length,
      stalls: search.results.stalls.length,
      lists: search.results.lists.length,
      reviews: search.results.reviews.length,
    });
  }, [search.query, search.results, search.status]);

  const chooseSection = (next: SavedSection) => {
    if (next === activeSection) return;
    setSection(next);
    trackAnalyticsEvent("saved_section_changed", { section: next, previous: activeSection });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        savedDishes.reload(),
        canLoadLists ? loadPortfolioScope("mine") : Promise.resolve(),
      ]);
      if (stallsWanted) savedStalls.retry();
    } catch (error) {
      reportError(error, { screen: "Favourites", action: "refresh" });
      showToast({ message: "Couldn't refresh. Try again.", tone: "error" });
    } finally {
      setRefreshing(false);
    }
  };

  const showCount = activeSection === "dishes" && savedDishes.status === "ready" && !searching;
  return (
    <ProfileScreenShell
      title="Saved"
      subtitle={showCount ? formatSavedCount(savedDishCount) : undefined}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <SavedSearchBox value={query} onChangeText={setQuery} />
      {searching ? (
        <SavedSearchResults
          search={search}
          onClear={() => setQuery("")}
          onRetry={() => setQuery((current) => `${current} `.trimEnd())}
          onOpenDish={(dish) => {
            trackAnalyticsEvent("saved_item_opened", {
              item_type: "dish",
              dish_id: dish.id,
              source: "search",
            });
            rootNavigation.navigate("DishDetail", { dishId: dish.id, source: "saved" });
          }}
          onOpenStall={(venue) => rootNavigation.navigate("StallDetail", { venueId: venue.id })}
          onOpenList={(portfolio) =>
            navigation.navigate("PortfolioDetail", { portfolioId: portfolio.id })
          }
          onOpenReview={(review) => {
            if (review.id) rootNavigation.navigate("ReviewDetail", { reviewId: review.id });
          }}
        />
      ) : (
        <>
          {/* Scrolls sideways so the tabs never clip at large text sizes or on small phones. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="tablist"
            contentContainerStyle={{ gap: spacing[2] }}
            style={{ flexGrow: 0 }}
          >
            {sections.map((key) => (
              <Chip
                key={key}
                label={SAVED_SECTION_LABELS[key]}
                accessibilityRole="tab"
                accessibilityLabel={`Saved ${SAVED_SECTION_LABELS[key].toLowerCase()}`}
                selected={activeSection === key}
                onPress={() => chooseSection(key)}
              />
            ))}
          </ScrollView>
          {activeSection === "stalls" ? (
            <SavedStallsSection
              state={savedStalls}
              onOpenStall={(venueId) => rootNavigation.navigate("StallDetail", { venueId })}
              preload={(venueId) => {
                prefetchStallDetail(venueId);
                preloadRoute(rootNavigation, "StallDetail", { venueId });
              }}
            />
          ) : activeSection === "posts" && FEATURE_FLAGS.socialFeedEnabled ? (
            <SavedPostsSection
              onOpenPost={(postId) => rootNavigation.navigate("ActivityPostDetail", { postId })}
            />
          ) : activeSection === "lists" ? (
            <SavedListsSection
              lists={ownLists}
              failed={listsFailed}
              onRetry={retryLists}
              onOpenList={(portfolioId) => navigation.navigate("PortfolioDetail", { portfolioId })}
              onCreateList={() => navigation.navigate("PortfolioCreate")}
              onOpenSharedLists={() => navigation.navigate("PortfoliosHome")}
            />
          ) : (
            <SavedDishesSection
              navigation={navigation}
              saved={savedDishes}
              tab={tab}
              onTabChange={setTab}
              mode={mode}
              onModeChange={setMode}
            />
          )}
        </>
      )}
    </ProfileScreenShell>
  );
}

/**
 * Posts you saved from Home or a post page, newest save first. Read by id on the server, so an
 * older saved post still shows (the feed window does not cut it off).
 */
function SavedPostsSection({ onOpenPost }: { onOpenPost: (postId: string) => void }) {
  const { palette, spacing } = useHungryTheme();
  const [bites, setBites] = useState<Bite[] | null>(null);
  const loadSavedPosts = useCallback(
    () => getHungryService().social.getSavedBites().then(setBites),
    [],
  );
  const { failed: loadFailed, retry } = useRetryableLoad(loadSavedPosts, "saved posts");

  if (bites === null) {
    if (loadFailed) {
      return (
        <EmptyState
          title="Couldn't load saved posts"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onPress={retry}
        />
      );
    }
    return <ProfileGridSkeleton />;
  }
  if (bites.length === 0) {
    return (
      <EmptyState title="No saved posts yet" body="Tap the bookmark on a post to keep it here." />
    );
  }
  return (
    <View
      testID="saved-posts-grid"
      style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing[4] }}
    >
      {bites.map((bite) => (
        <Pressable
          key={bite.id}
          accessibilityRole="button"
          accessibilityLabel={`Open saved post ${bite.caption || bite.dishName || bite.id}`}
          onPress={() => onOpenPost(bite.id)}
          style={{ width: "33.333%", aspectRatio: 1, padding: 1, backgroundColor: palette.bgSoft }}
        >
          <AccessibleImage
            source={{ uri: bite.photoUrl }}
            decorative
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Stalls you saved with Save on a stall page, newest first, as rows with the stall's logo, where
 * it is, how far and whether it is open. A List / Map switch shows them as pins; swipe a row (or
 * tap the bookmark) to remove it, with Undo. The stall rows come from `useSavedStalls` in 50-id
 * batches, so a saved stall outside the cached directory still shows.
 */
function SavedStallsSection({
  state,
  onOpenStall,
  preload,
}: {
  state: SavedStallsState;
  onOpenStall: (venueId: string) => void;
  preload: (venueId: string) => void;
}) {
  const { spacing } = useHungryTheme();
  const userId = useProfileStore((store) => store.profile.id);
  const toggleSaved = useStallInteractionStore((store) => store.toggleSaved);
  const showToast = useUIStore((store) => store.showToast);
  const requestedMode = useSavedViewStore((store) => store.mode);
  const setMode = useSavedViewStore((store) => store.setMode);
  // A remembered Map choice falls back to the list in a build that cannot draw a map.
  const mapAvailable = isLiveMapAvailable();
  const mode = mapAvailable ? requestedMode : "list";
  const permission = useLocationStore((store) => store.permission);
  const currentLocation = useLocationStore((store) => store.currentLocation);
  const manualCoordinate = useLocationStore((store) => store.manualCoordinate);
  const origin = useMemo(
    () => getSavedOrigin({ permission, currentLocation, manualCoordinate }),
    [currentLocation, manualCoordinate, permission],
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  const distanceFor = (venue: VenueSummary) =>
    venue.latitude !== undefined && venue.longitude !== undefined
      ? formatDistanceFromUser(origin, { latitude: venue.latitude, longitude: venue.longitude })
      : undefined;

  const removeStall = async (venue: VenueSummary) => {
    setPendingId(venue.id);
    try {
      await toggleSaved(userId, venue.id);
      showToast({
        message: "Removed from Saved.",
        tone: "success",
        duration: 5000,
        action: {
          label: "Undo",
          onPress: () => {
            toggleSaved(userId, venue.id).catch((error: unknown) => {
              reportError(error, { screen: "Favourites", action: "undo_remove_stall" });
              showToast({ message: "Couldn't undo that. Try again.", tone: "error" });
            });
          },
        },
      });
    } catch (error) {
      reportError(error, { screen: "Favourites", action: "remove_saved_stall" });
      showToast({ message: "Couldn't remove that stall. Try again.", tone: "error" });
    } finally {
      setPendingId(null);
    }
  };

  const mapped = useMemo(
    () =>
      state.stalls.filter((venue) => venue.latitude !== undefined && venue.longitude !== undefined),
    [state.stalls],
  );
  const pins = useMemo<SavedMapViewPin[]>(
    () =>
      mapped.map((venue) => ({
        id: venue.id,
        coordinate: { latitude: venue.latitude as number, longitude: venue.longitude as number },
        title: venue.name,
        count: 1,
      })),
    [mapped],
  );

  const chooseMode = (next: "list" | "map") => {
    if (next === mode) return;
    setMode(next);
    if (next === "map") {
      trackAnalyticsEvent("saved_map_opened", {
        section: "stalls",
        pin_count: pins.length,
        not_on_map: state.stalls.length - pins.length,
        has_location: origin !== undefined,
      });
    }
  };

  const renderRow = (venue: VenueSummary, source: "list" | "map") => (
    <SavedStallRow
      key={venue.id}
      venue={venue}
      distanceLabel={distanceFor(venue)}
      removing={pendingId === venue.id}
      onPressIn={() => preload(venue.id)}
      onOpen={() => {
        trackAnalyticsEvent("saved_item_opened", {
          item_type: "stall",
          venue_id: venue.id,
          source,
        });
        onOpenStall(venue.id);
      }}
      onRemove={() => void removeStall(venue)}
    />
  );

  if (state.status === "error") {
    return (
      <EmptyState
        title="Couldn't load saved stalls"
        body="Check your connection and try again."
        ctaLabel="Retry"
        onPress={state.retry}
      />
    );
  }
  if (state.status === "loading") return <ProfileReviewsSkeleton />;

  const missingNote =
    state.missingCount > 0 ? (
      <AppText tone="secondary" variant="bodySmall">
        {describeMissingStalls(state.missingCount)}
      </AppText>
    ) : null;

  if (state.stalls.length === 0) {
    // Every saved id came back with no stall: say so, rather than "No saved stalls yet".
    return state.missingCount > 0 ? (
      <EmptyState
        title="Couldn't show your saved stalls"
        body={describeMissingStalls(state.missingCount)}
        ctaLabel="Retry"
        onPress={state.retry}
      />
    ) : (
      <EmptyState title="No saved stalls yet" body="Tap Save on a stall page to keep it here." />
    );
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {mapAvailable ? (
        <View style={{ alignSelf: "flex-start" }}>
          <SavedViewSwitch
            accessibilityLabel="Show saved stalls as a list or on a map"
            value={mode}
            onChange={chooseMode}
          />
        </View>
      ) : null}
      {mode === "map" ? (
        <SavedMapView
          pins={pins}
          noun="stall"
          origin={origin}
          notOnMapCount={state.stalls.length - pins.length}
          onShowNotOnMap={() => setMode("list")}
          renderPinCard={(pinId) => {
            const venue = mapped.find((candidate) => candidate.id === pinId);
            return venue ? renderRow(venue, "map") : null;
          }}
        />
      ) : (
        <View style={{ gap: spacing[2] }}>
          {state.stalls.map((venue) => (
            <SwipeToRemove
              key={venue.id}
              label={venue.name}
              removing={pendingId === venue.id}
              onRemove={() => void removeStall(venue)}
            >
              {renderRow(venue, "list")}
            </SwipeToRemove>
          ))}
        </View>
      )}
      {missingNote}
    </View>
  );
}

/** Your lists as albums with real cover photos, and a tile to start a new one. */
function SavedListsSection({
  lists,
  failed,
  onRetry,
  onOpenList,
  onCreateList,
  onOpenSharedLists,
}: {
  lists: readonly Portfolio[];
  failed: boolean;
  onRetry: () => void;
  onOpenList: (portfolioId: string) => void;
  onCreateList: () => void;
  onOpenSharedLists: () => void;
}) {
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const items = usePortfolioStore((state) => state.items);
  // Two columns inside the screen's spacing[4] gutters.
  const tileWidth = (width - spacing[4] * 2 - spacing[3]) / 2;
  const covers = useListCovers(useMemo(() => lists.map((list) => list.id), [lists]));

  if (failed && lists.length === 0) {
    return (
      <EmptyState
        title="Couldn't load your lists"
        body="Check your connection and try again."
        ctaLabel="Retry"
        onPress={onRetry}
      />
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
        <NewCollectionTile width={tileWidth} onPress={onCreateList} />
        {lists.map((portfolio) => (
          <CollectionAlbumCard
            key={portfolio.id}
            name={portfolio.name}
            itemCount={resolveListItemCount(portfolio, items[portfolio.id])}
            coverPhotos={covers.get(portfolio.id) ?? []}
            width={tileWidth}
            onPress={() => onOpenList(portfolio.id)}
          />
        ))}
      </View>
      {lists.length === 0 ? (
        <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
          Make lists like &quot;Date night&quot; or &quot;Supper spots&quot;, then save dishes into
          them from any dish page.
        </AppText>
      ) : null}
      {FEATURE_FLAGS.portfoliosEnabled ? (
        <Button label="Shared and followed lists" variant="secondary" onPress={onOpenSharedLists} />
      ) : null}
    </View>
  );
}
