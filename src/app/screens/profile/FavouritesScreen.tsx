import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Bookmark } from "lucide-react-native";

import { CollectionAlbumCard, NewCollectionTile } from "@/components/portfolio";
import { AccessibleImage, AppText, Button, Card, Chip, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { resolveListItemCount } from "@/features/checklistPortfolio/listLabels";
import { describeMissingStalls, loadVenuesByIds } from "@/features/profile/loadVenuesByIds";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { formatSavedCount, matchesSavedDishQuery } from "@/features/saved/savedDishes";
import { useSavedDishes } from "@/features/saved/useSavedDishes";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";
import type { Bite } from "@/lib/services/types";
import { reportError } from "@/lib/monitoring/reportError";
import type { Portfolio, VenueSummary } from "@/types/domain";
import { ProfileGridSkeleton, ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";
import { SavedDishesSection } from "./SavedDishesSection";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;
type SavedSection = "dishes" | "stalls" | "posts" | "lists";

const SECTION_LABELS: Record<SavedSection, string> = {
  dishes: "Dishes",
  stalls: "Stalls",
  posts: "Posts",
  lists: "Collections",
};

/** Posts are part of the archived social feed: their tab shows only when the feed is on. */
export function visibleSavedSections(socialFeedEnabled: boolean): SavedSection[] {
  return (Object.keys(SECTION_LABELS) as SavedSection[]).filter(
    (key) => key !== "posts" || socialFeedEnabled,
  );
}

const SECTION_HEADINGS: Record<SavedSection, string> = {
  dishes: "Saved dishes",
  stalls: "Saved stalls",
  posts: "Saved posts",
  lists: "Your collections",
};

export { matchesSavedDishQuery };

export function FavouritesScreen({ navigation }: Props) {
  const authenticatedUserId = useSessionStore((state) => state.authenticatedUserId);
  const profileId = useProfileStore((state) => state.profile.id);
  const { spacing } = useHungryTheme();
  const [section, setSection] = useState<SavedSection>("dishes");
  const [tab, setTab] = useState<"want" | "tried">("want");
  const rootNavigation = getRootNavigation(navigation as any);
  // Loaded here, not inside the Dishes tab, so the header count matches the cards below.
  const savedDishes = useSavedDishes(`${authenticatedUserId ?? "guest"}:${profileId}`);
  const savedDishCount = savedDishes.savedIds.filter((id) => savedDishes.cards.has(id)).length;

  return (
    <ProfileScreenShell title="Saved">
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h1">{SECTION_HEADINGS[section]}</AppText>
        {section === "dishes" && savedDishes.status === "ready" ? (
          <AppText variant="bodySmall" tone="secondary">
            {formatSavedCount(savedDishCount)}
          </AppText>
        ) : null}
      </View>
      {/* Scrolls sideways so the tabs never clip at large text sizes or on small phones. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={{ gap: spacing[2] }}
        style={{ flexGrow: 0, marginBottom: spacing[3] }}
      >
        {visibleSavedSections(FEATURE_FLAGS.socialFeedEnabled).map((key) => (
          <Chip
            key={key}
            label={SECTION_LABELS[key]}
            accessibilityRole="tab"
            accessibilityLabel={`Saved ${SECTION_LABELS[key].toLowerCase()}`}
            selected={section === key}
            onPress={() => setSection(key)}
          />
        ))}
      </ScrollView>
      {section === "stalls" ? (
        <SavedStallsSection
          onOpenStall={(venueId) => rootNavigation.navigate("StallDetail", { venueId })}
        />
      ) : section === "posts" && FEATURE_FLAGS.socialFeedEnabled ? (
        <SavedPostsSection
          onOpenPost={(postId) => rootNavigation.navigate("ActivityPostDetail", { postId })}
        />
      ) : section === "lists" ? (
        <SavedListsSection
          onOpenList={(portfolioId) => navigation.navigate("PortfolioDetail", { portfolioId })}
          onCreateList={() => navigation.navigate("PortfolioCreate")}
          onOpenAllLists={() => navigation.navigate("ListsHome", undefined, { pop: true })}
          onSearchAllSaved={() => navigation.navigate("Collections")}
        />
      ) : (
        <SavedDishesSection
          navigation={navigation}
          saved={savedDishes}
          tab={tab}
          onTabChange={setTab}
        />
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
 * Stalls you saved with Save on a stall page (`user_stall_interactions.is_saved`), newest first.
 * The stall rows come from the server in 50-id batches (`loadVenuesByIds`), so a saved stall that
 * is not in the cached directory still shows, and so does the 51st.
 */
function SavedStallsSection({ onOpenStall }: { onOpenStall: (venueId: string) => void }) {
  const { palette, spacing } = useHungryTheme();
  const userId = useProfileStore((state) => state.profile.id);
  const interactions = useStallInteractionStore((state) => state.interactions);
  const isLoaded = useStallInteractionStore((state) => state.isLoaded);
  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const loadSavedStalls = useCallback(() => loadInteractions(userId), [loadInteractions, userId]);
  const { failed: loadFailed, retry } = useRetryableLoad(loadSavedStalls, "saved stalls");
  const [venues, setVenues] = useState<Map<string, VenueSummary> | null>(null);
  const [missingCount, setMissingCount] = useState(0);
  const [venuesFailed, setVenuesFailed] = useState(false);
  const [venuesReloadKey, setVenuesReloadKey] = useState(0);

  const savedStallIds = useMemo(
    () =>
      Object.values(interactions)
        .filter((interaction) => interaction.isSaved)
        .sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""))
        .map((interaction) => interaction.stallId),
    [interactions],
  );
  const savedKey = savedStallIds.join(",");

  useEffect(() => {
    if (!isLoaded) return undefined;
    const ids = savedKey ? savedKey.split(",") : [];
    if (ids.length === 0) {
      setVenues(new Map());
      setMissingCount(0);
      return undefined;
    }
    let active = true;
    setVenuesFailed(false);
    loadVenuesByIds(ids)
      .then((result) => {
        if (!active) return;
        setVenues(new Map(result.venues.map((row) => [row.id, row])));
        setMissingCount(result.missingCount);
      })
      .catch((error) => {
        reportError(error, { screen: "Favourites", action: "load_saved_stalls" });
        if (active) setVenuesFailed(true);
      });
    return () => {
      active = false;
    };
  }, [isLoaded, savedKey, venuesReloadKey]);

  const onRetry = () => {
    retry();
    setVenuesReloadKey((key) => key + 1);
  };
  if (loadFailed || venuesFailed) {
    return (
      <EmptyState
        title="Couldn't load saved stalls"
        body="Check your connection and try again."
        ctaLabel="Retry"
        onPress={onRetry}
      />
    );
  }
  if (!isLoaded || venues === null) return <ProfileReviewsSkeleton />;

  const savedVenues = savedStallIds
    .map((id) => venues.get(id))
    .filter((venue): venue is VenueSummary => Boolean(venue));

  const missingNote =
    missingCount > 0 ? (
      <AppText tone="secondary" variant="bodySmall">
        {describeMissingStalls(missingCount)}
      </AppText>
    ) : null;

  if (savedVenues.length === 0) {
    // Every saved id came back with no stall: say so, rather than "No saved stalls yet".
    return missingCount > 0 ? (
      <EmptyState
        title="Couldn't show your saved stalls"
        body={describeMissingStalls(missingCount)}
        ctaLabel="Retry"
        onPress={onRetry}
      />
    ) : (
      <EmptyState title="No saved stalls yet" body="Tap Save on a stall page to keep it here." />
    );
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {savedVenues.map((venue) => (
        <Pressable
          key={venue.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${venue.name}`}
          onPress={() => onOpenStall(venue.id)}
        >
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Bookmark color={palette.orange} fill={palette.orange} size={18} />
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="bodyBold">{venue.name}</AppText>
              {venue.buildingName || venue.unitNumber ? (
                <AppText variant="bodySmall" tone="secondary">
                  {[venue.unitNumber?.trim(), venue.buildingName].filter(Boolean).join(" · ")}
                </AppText>
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}
      {missingNote}
    </View>
  );
}

/** Your collections (portfolios) as albums, with a tile to start a new one. */
function SavedListsSection({
  onOpenList,
  onCreateList,
  onOpenAllLists,
  onSearchAllSaved,
}: {
  onOpenList: (portfolioId: string) => void;
  onCreateList: () => void;
  onOpenAllLists: () => void;
  onSearchAllSaved: () => void;
}) {
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const profileId = useProfileStore((state) => state.profile.id);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const authenticatedUserId = useSessionStore((state) => state.authenticatedUserId);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const items = usePortfolioStore((state) => state.items);
  const mineIds = usePortfolioStore((state) => state.scopeIds.mine);
  const loadPortfolioScope = usePortfolioStore((state) => state.loadPortfolioScope);
  const canLoad = FEATURE_FLAGS.portfoliosEnabled && isAuthenticated;
  const repository = getDataRepository();
  // Two columns inside the screen's spacing[4] gutters.
  const tileWidth = (width - spacing[4] * 2 - spacing[3]) / 2;

  // Your own lists by owner on the server, not a filter over everyone's newest 100. Keyed on the
  // owner id the store queries with (the signed-in account first), so a switch reloads.
  const ownerId = (isAuthenticated ? authenticatedUserId : undefined) ?? profileId;
  const loadOwnLists = useCallback(
    async () => {
      if (canLoad) await loadPortfolioScope("mine");
    },
    // ownerId: a different account reloads its own lists.
    [canLoad, loadPortfolioScope, ownerId],
  );
  const { failed: listsFailed, retry: retryLists } = useRetryableLoad(loadOwnLists, "saved lists");

  const ownLists = useMemo(() => {
    const byId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
    return (mineIds ?? [])
      .map((id) => byId.get(id))
      .filter((portfolio): portfolio is Portfolio => Boolean(portfolio));
  }, [mineIds, portfolios]);

  // Cover mosaic: the first dish photos already in memory for each collection.
  const coverPhotosById = useMemo(() => {
    const covers = new Map<string, string[]>();
    for (const portfolio of ownLists) {
      const photos = (items[portfolio.id] ?? [])
        .map((item) => (item.dishId ? repository.getDishById(item.dishId)?.imageUrl : undefined))
        .filter((uri): uri is string => Boolean(uri));
      covers.set(portfolio.id, Array.from(new Set(photos)).slice(0, 4));
    }
    return covers;
  }, [items, ownLists, repository]);

  if (listsFailed && ownLists.length === 0) {
    return (
      <EmptyState
        title="Couldn't load your lists"
        body="Check your connection and try again."
        ctaLabel="Retry"
        onPress={retryLists}
      />
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
        <NewCollectionTile width={tileWidth} onPress={onCreateList} />
        {ownLists.map((portfolio) => (
          <CollectionAlbumCard
            key={portfolio.id}
            name={portfolio.name}
            itemCount={resolveListItemCount(portfolio, items[portfolio.id])}
            coverPhotos={coverPhotosById.get(portfolio.id) ?? []}
            width={tileWidth}
            onPress={() => onOpenList(portfolio.id)}
          />
        ))}
      </View>
      {ownLists.length === 0 ? (
        <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
          Make albums like &quot;Date night&quot; or &quot;Supper spots&quot;, then save dishes into
          them from any dish page.
        </AppText>
      ) : null}
      <Button label="Search all saved" variant="secondary" onPress={onSearchAllSaved} />
      <Button label="All lists" variant="secondary" onPress={onOpenAllLists} />
    </View>
  );
}
