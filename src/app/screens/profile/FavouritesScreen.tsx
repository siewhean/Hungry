import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { BellRing, Bookmark, Heart, Star } from "lucide-react-native";

import { PortfolioCard } from "@/components/portfolio";
import { AccessibleImage, AppText, Button, Card, Chip, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { resolveListItemCount } from "@/features/checklistPortfolio/listLabels";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import type { CatalogRawDishDetail } from "@/lib/services/catalog";
import { loadCatalogFavourites } from "@/lib/services/catalog/favourites";
import {
  getCatalogRawService,
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;
type SavedSection = "dishes" | "stalls" | "lists";

const SECTION_LABELS: Record<SavedSection, string> = {
  dishes: "Dishes",
  stalls: "Stalls",
  lists: "Lists",
};

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const [section, setSection] = useState<SavedSection>("dishes");
  const [tab, setTab] = useState<"want" | "tried">("want");
  const dishIds = tab === "want" ? profile.favouriteDishIds : profile.reviewedDishIds;
  const dishes = dishIds.map((dishId) => repository.getDishById(dishId)).filter(isDishDetail);
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <ProfileScreenShell title="Saved" subtitle="Dishes, stalls and lists you've kept for later.">
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
      ) : section === "lists" ? (
        <SavedListsSection
          onOpenList={(portfolioId) => navigation.navigate("PortfolioDetail", { portfolioId })}
          onOpenAllLists={() => navigation.navigate("ListsHome")}
        />
      ) : getServiceProvider().mode === "supabase" ? (
        <CatalogSavedDishes navigation={navigation} />
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
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: spacing[4],
              }}
            >
              {dishes.map((dish) => {
                const venue = repository.getVenueById(dish.venueId);
                return (
                  <View
                    key={dish.id}
                    style={[
                      shadows.card,
                      {
                        width: "47%",
                        backgroundColor: palette.surface,
                        borderRadius: componentRadii.card,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    {/* Open and Remove are sibling controls: no nested interactive elements. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${dish.name}${venue?.name ? ` at ${venue.name}` : ""}`}
                      onPressIn={() => {
                        prefetchDishDetail(dish.id, repository);
                        preloadRoute(rootNavigation, "DishDetail", { dishId: dish.id });
                      }}
                      onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                    >
                      <View style={{ height: 120, width: "100%" }}>
                        <AccessibleImage
                          source={{ uri: dish.imageUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          decorative
                        />
                      </View>
                      <View style={{ padding: spacing[3], gap: spacing[1] }}>
                        <AppText variant="bodyBold" numberOfLines={1}>
                          {dish.name}
                        </AppText>
                        <AppText variant="micro" tone="secondary" numberOfLines={1}>
                          {venue?.name}
                        </AppText>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: spacing[1],
                          }}
                        >
                          <AppText
                            style={{
                              color: palette.orange,
                              fontWeight: "800",
                              fontSize: 13,
                            }}
                          >
                            S${dish.price.toFixed(2)}
                          </AppText>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing[1],
                            }}
                          >
                            <Star color={palette.amber} fill={palette.amber} size={10} />
                            <AppText variant="micro" style={{ fontWeight: "700" }}>
                              {dish.rating.toFixed(1)}
                            </AppText>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                    {tab === "want" ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${dish.name} from saved`}
                        hitSlop={6}
                        onPress={() =>
                          void toggleFavourite(dish).then((result) => {
                            if (result.status === "failed") {
                              showToast({ message: result.message, tone: "error" });
                            }
                          })
                        }
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

/** Stalls you follow: the stall-level "save" (Follow on a stall page). */
/** Supabase: saved dish ids are catalog ids, so they resolve through the release catalog. */
function CatalogSavedDishes({ navigation }: Pick<Props, "navigation">) {
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, spacing } = useHungryTheme();
  const rootNavigation = getRootNavigation(navigation as any);
  const [dishes, setDishes] = useState<CatalogRawDishDetail[]>([]);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const hasLoadedRef = useRef(false);
  const favouriteKey = favouriteDishIds.join(",");

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const service = getCatalogRawService();
    if (!service) {
      setDishes([]);
      setUnavailableCount(0);
      setLoadError(null);
      setIsLoading(false);
      return;
    }
    // Only the first load shows the spinner; refreshes keep the list visible.
    if (!hasLoadedRef.current) setIsLoading(true);
    setLoadError(null);
    const result = await loadCatalogFavourites({
      getFavouriteDishIds: () => getHungryService().profile.getFavouriteDishIds(),
      getDish: (id) => service.getDish(id),
    });
    if (loadVersion.current !== version) return;
    if (result.status === "error") {
      setLoadError(result.message);
    } else {
      hasLoadedRef.current = true;
      setDishes(result.dishes);
      setUnavailableCount(result.unavailableCount);
    }
    setIsLoading(false);
  }, []);

  // Re-resolve when the saved set changes (e.g. a dish saved elsewhere).
  useEffect(() => {
    void load();
    return () => {
      loadVersion.current += 1;
    };
  }, [favouriteKey, load]);

  const removeFavourite = async (dish: CatalogRawDishDetail) => {
    setPendingDishId(dish.id);
    try {
      const result = await toggleFavourite({ id: dish.id, venueId: dish.venueId });
      showToast(
        result.status === "failed"
          ? { message: result.message, tone: "error" }
          : { message: "Removed from favourites.", tone: "success" },
      );
      if (result.status === "removed") {
        setDishes((current) => current.filter((item) => item.id !== dish.id));
      }
    } finally {
      setPendingDishId(null);
    }
  };

  return (
    <>
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Loading favourites" color={palette.orange} />
      ) : loadError ? (
        <EmptyState
          title="Couldn't load favourites"
          body={`${loadError} Check your connection and try again.`}
          ctaLabel="Retry"
          onPress={() => void load()}
        />
      ) : dishes.length ? (
        <View style={{ gap: spacing[3] }}>
          {dishes.map((dish) => (
            <View
              key={dish.id}
              style={{
                alignItems: "center",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                padding: spacing[3],
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.name} at ${dish.venueName}`}
                onPress={() =>
                  rootNavigation.navigate("CatalogRawDetail", { kind: "dish", id: dish.id })
                }
                style={{ flex: 1, gap: spacing[1] }}
              >
                <AppText variant="bodyBold" numberOfLines={1}>
                  {dish.name}
                </AppText>
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {dish.venueName}
                </AppText>
                {dish.price !== undefined ? (
                  <AppText style={{ color: palette.orange, fontWeight: "800", fontSize: 13 }}>
                    S${dish.price.toFixed(2)}
                  </AppText>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${dish.name} from favourites`}
                accessibilityState={{ busy: pendingDishId === dish.id }}
                disabled={pendingDishId === dish.id}
                onPress={() => void removeFavourite(dish)}
                style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
              >
                {pendingDishId === dish.id ? (
                  <ActivityIndicator color={palette.error} />
                ) : (
                  <Heart size={18} color={palette.error} fill={palette.error} />
                )}
              </Pressable>
            </View>
          ))}
          {unavailableCount > 0 ? (
            <AppText tone="muted" variant="micro">
              {unavailableCount === 1
                ? "1 saved dish is not in the current catalog."
                : `${unavailableCount} saved dishes are not in the current catalog.`}
            </AppText>
          ) : null}
        </View>
      ) : (
        <EmptyState
          title={unavailableCount > 0 ? "Saved dishes unavailable" : "No favourites yet"}
          body={
            unavailableCount > 0
              ? "Your saved dishes are not in the current catalog."
              : "Tap Save to favourites on any dish to keep it here."
          }
          ctaLabel="Discover Dishes"
          onPress={() => rootNavigation.navigate("MainTabs", { screen: "Discover" })}
        />
      )}
    </>
  );
}

function SavedStallsSection({ onOpenStall }: { onOpenStall: (venueId: string) => void }) {
  const { palette, spacing } = useHungryTheme();
  const followedStallIds = useStallFollowStore((state) => state.followedStallIds);
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const repository = getDataRepository();

  useEffect(() => {
    void loadFollowedStalls().catch(() => {});
  }, [loadFollowedStalls]);

  const venues = useMemo(
    () => followedStallIds.map((id) => repository.getVenueById(id)).filter((venue) => !!venue),
    [followedStallIds, repository],
  );

  if (venues.length === 0) {
    return (
      <EmptyState
        title="No saved stalls yet"
        body="Tap Follow on a stall page to keep it here and hear about its menu changes."
      />
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
  const isLoaded = usePortfolioStore((state) => state.isLoaded);
  const loadPortfolios = usePortfolioStore((state) => state.loadPortfolios);
  const canLoad = FEATURE_FLAGS.portfoliosEnabled && isAuthenticated;

  useEffect(() => {
    if (!canLoad || isLoaded) return;
    void loadPortfolios().catch((error) => console.error("Failed to load lists:", error));
  }, [canLoad, isLoaded, loadPortfolios]);

  const ownLists = useMemo(
    () => portfolios.filter((portfolio) => portfolio.ownerId === profileId),
    [portfolios, profileId],
  );

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
