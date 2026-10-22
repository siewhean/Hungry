import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { BellRing, Bookmark, CircleCheck, Navigation, Star, Store } from "lucide-react-native";

import { PortfolioCard } from "@/components/portfolio";
import { AccessibleImage, AppText, Button, Card, Chip, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { resolveListItemCount } from "@/features/checklistPortfolio/listLabels";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import {
  buildMapsSearchUrl,
  formatFullStallAddress,
  getStallPin,
} from "@/features/detail/stallLocation";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useHungryTheme } from "@/theme";
import type { Bite } from "@/lib/services/types";
import type { Portfolio } from "@/types/domain";
import { isDishDetail } from "./profileGuards";
import { ProfileGridSkeleton, ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;
type SavedSection = "dishes" | "stalls" | "posts" | "lists";

const SECTION_LABELS: Record<SavedSection, string> = {
  dishes: "Dishes",
  stalls: "Stalls",
  posts: "Posts",
  lists: "Lists",
};

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const [section, setSection] = useState<SavedSection>("dishes");
  const [tab, setTab] = useState<"want" | "tried">("want");
  const dishIds = tab === "want" ? profile.favouriteDishIds : profile.reviewedDishIds;
  const dishes = dishIds.map((dishId) => repository.getDishById(dishId)).filter(isDishDetail);
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <ProfileScreenShell title="Saved">
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h1">Saved Dishes</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {profile.favouriteDishIds.length} cravings saved for later
        </AppText>
      </View>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: "row", gap: spacing[2], marginBottom: spacing[3] }}
      >
        {(Object.keys(SECTION_LABELS) as SavedSection[]).map((key) => (
          <Chip
            key={key}
            label={SECTION_LABELS[key]}
            accessibilityLabel={`Saved ${SECTION_LABELS[key].toLowerCase()}`}
            selected={section === key}
            onPress={() => setSection(key)}
          />
        ))}
      </View>
      {section === "stalls" ? (
        <SavedStallsSection
          onOpenStall={(venueId) => rootNavigation.navigate("StallDetail", { venueId })}
        />
      ) : section === "posts" ? (
        <SavedPostsSection
          onOpenPost={(postId) => rootNavigation.navigate("ActivityPostDetail", { postId })}
        />
      ) : section === "lists" ? (
        <SavedListsSection
          onOpenList={(portfolioId) => navigation.navigate("PortfolioDetail", { portfolioId })}
          onOpenAllLists={() => navigation.navigate("ListsHome", undefined, { pop: true })}
        />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing[2], marginBottom: spacing[4] }}>
            <Chip
              label={`Want to try (${profile.favouriteDishIds.length})`}
              selected={tab === "want"}
              onPress={() => setTab("want")}
            />
            <Chip
              label={`Tried (${profile.reviewedDishIds.length})`}
              selected={tab === "tried"}
              onPress={() => setTab("tried")}
            />
          </View>
          {dishes.length ? (
            <View style={{ gap: spacing[4] }}>
              {dishes.map((dish) => {
                const venue = repository.getVenueById(dish.venueId);
                const destination =
                  venue &&
                  formatFullStallAddress(venue, {
                    name: venue.buildingName,
                    address: venue.address,
                    postalCode: venue.postalCode,
                  });
                return (
                  <View
                    key={dish.id}
                    style={[
                      shadows.card,
                      {
                        backgroundColor: palette.surface,
                        borderRadius: componentRadii.card,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={{ height: 180, width: "100%", position: "relative" }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${dish.name}${venue?.name ? ` at ${venue.name}` : ""}`}
                        onPressIn={() => {
                          prefetchDishDetail(dish.id, repository);
                          preloadRoute(rootNavigation, "DishDetail", { dishId: dish.id });
                        }}
                        onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <AccessibleImage
                          source={{ uri: dish.imageUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          decorative
                        />
                      </Pressable>
                      {tab === "want" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${dish.name} from saved`}
                          hitSlop={6}
                          onPress={() => toggleFavourite(dish)}
                          style={{
                            position: "absolute",
                            top: spacing[2],
                            right: spacing[2],
                            width: 36,
                            height: 36,
                            borderRadius: componentRadii.iconButton,
                            backgroundColor: palette.surfaceTranslucent,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Bookmark size={16} color={palette.orange} fill={palette.orange} />
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={{ padding: spacing[4], gap: spacing[3] }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: spacing[2],
                        }}
                      >
                        <AppText variant="h2" style={{ flex: 1 }} numberOfLines={2}>
                          {dish.name}
                        </AppText>
                        <AppText variant="price" style={{ color: palette.orange }}>
                          S${dish.price.toFixed(2)}
                        </AppText>
                      </View>
                      {venue ? (
                        <View
                          style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                        >
                          <Store color={palette.orange} size={15} />
                          <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                            {venue.buildingName ?? venue.name}
                            {venue.unitNumber ? ` · ${venue.unitNumber}` : ""}
                          </AppText>
                        </View>
                      ) : null}
                      {dish.reviewCount > 0 ? (
                        <View
                          style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                        >
                          <Star color={palette.ratingStar} fill={palette.ratingStar} size={15} />
                          <AppText variant="bodySmallBold">{dish.rating.toFixed(1)}</AppText>
                          <AppText variant="bodySmall" tone="secondary">
                            ({dish.reviewCount})
                          </AppText>
                        </View>
                      ) : null}
                      {destination ? (
                        <Button
                          label="Get Directions"
                          leftIcon={<Navigation size={18} color={palette.textOnPrimary} />}
                          onPress={() =>
                            void openTrustedMapsUrl(
                              buildMapsSearchUrl(destination, getStallPin(venue)),
                            )
                          }
                        />
                      ) : (
                        <Button
                          label="View dish"
                          onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                        />
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${dish.name} to mark as eaten or add a review`}
                        onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                        style={{
                          alignSelf: "center",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[1],
                          padding: spacing[1],
                        }}
                      >
                        <CircleCheck color={palette.textSecondary} size={15} />
                        <AppText variant="bodySmallBold" tone="secondary">
                          View dish to mark as eaten or review
                        </AppText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title={tab === "want" ? "Nothing saved yet" : "No dishes tried yet"}
              body={
                tab === "want"
                  ? "Save dishes you want to try and they'll show up here."
                  : "Mark a dish as tried from its page to keep a record here."
              }
              ctaLabel="Discover Dishes"
              onPress={() => rootNavigation.navigate("MainTabs", { screen: "Discover" })}
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

/** Stalls you follow: the stall-level "save" (Follow on a stall page). */
function SavedStallsSection({ onOpenStall }: { onOpenStall: (venueId: string) => void }) {
  const { palette, spacing } = useHungryTheme();
  const followedStallIds = useStallFollowStore((state) => state.followedStallIds);
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const repository = getDataRepository();

  const isLoaded = useStallFollowStore((state) => state.isLoaded);
  const { failed: loadFailed, retry } = useRetryableLoad(loadFollowedStalls, "saved stalls");

  const venues = useMemo(
    () => followedStallIds.map((id) => repository.getVenueById(id)).filter((venue) => !!venue),
    [followedStallIds, repository],
  );

  if (venues.length === 0) {
    if (!isLoaded && !loadFailed) return <ProfileReviewsSkeleton />;
    if (loadFailed) {
      return (
        <EmptyState
          title="Couldn't load saved stalls"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onPress={retry}
        />
      );
    }
    return (
      <EmptyState title="No saved stalls yet" body="Tap Follow on a stall page to keep it here." />
    );
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {venues.map((venue) => (
        <Pressable
          key={venue.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${venue.name}`}
          onPress={() => onOpenStall(venue.id)}
        >
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <BellRing color={palette.orange} size={18} />
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="bodyBold">{venue.name}</AppText>
              {venue.unitNumber ? (
                <AppText variant="bodySmall" tone="secondary">
                  {venue.unitNumber}
                  {venue.floor ? ` · ${venue.floor}` : ""}
                </AppText>
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

/** Your own lists (portfolios); the Lists area has checklists and discovery too. */
function SavedListsSection({
  onOpenList,
  onOpenAllLists,
}: {
  onOpenList: (portfolioId: string) => void;
  onOpenAllLists: () => void;
}) {
  const { spacing } = useHungryTheme();
  const profileId = useProfileStore((state) => state.profile.id);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const items = usePortfolioStore((state) => state.items);
  const mineIds = usePortfolioStore((state) => state.scopeIds.mine);
  const loadPortfolioScope = usePortfolioStore((state) => state.loadPortfolioScope);
  const canLoad = FEATURE_FLAGS.portfoliosEnabled && isAuthenticated;

  useEffect(() => {
    if (!canLoad) return;
    // Your own lists by owner on the server, not a filter over everyone's newest 100.
    void loadPortfolioScope("mine").catch((error) => console.error("Failed to load lists:", error));
  }, [canLoad, loadPortfolioScope, profileId]);

  const ownLists = useMemo(() => {
    const byId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
    return (mineIds ?? [])
      .map((id) => byId.get(id))
      .filter((portfolio): portfolio is Portfolio => Boolean(portfolio));
  }, [mineIds, portfolios]);

  return (
    <View style={{ gap: spacing[3] }}>
      {ownLists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          body="Make a list of places worth recommending, then find it here."
        />
      ) : (
        ownLists.map((portfolio) => (
          <PortfolioCard
            key={portfolio.id}
            portfolio={portfolio}
            itemCount={resolveListItemCount(portfolio, items[portfolio.id])}
            onPress={() => onOpenList(portfolio.id)}
          />
        ))
      )}
      <Button label="All lists" variant="secondary" onPress={onOpenAllLists} />
    </View>
  );
}
