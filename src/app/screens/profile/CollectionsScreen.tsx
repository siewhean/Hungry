import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Bookmark,
  ChevronRight,
  FolderHeart,
  MapPin,
  Plus,
  Search,
  Utensils,
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AccessibleImage, AppText, Button, Input } from "@/components/ui";
import type { PortfolioItemDetailRow } from "@/lib/services/types";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  WANT_TO_TRY_COLLECTION_ID,
  buildCollectionFoods,
  buildingAreaName,
  collectCollectionItemIds,
  detailKey,
  indexItemDetails,
  searchCollectionFoods,
  type CollectionFood,
} from "@/features/collections/collectionSearch";
import { reportError } from "@/lib/monitoring/reportError";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { getPortfolioOwnerId, usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Collections">;

/**
 * The diner's collections (Want to try and their lists) with one search across every food
 * in them: by the dish name, its caption, the stall, or the place or area it is in.
 */
export function CollectionsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const repository = getDataRepository();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const profileId = useProfileStore((state) => state.profile.id);
  const savedDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const allPortfolios = usePortfolioStore((state) => state.portfolios);
  const mineIds = usePortfolioStore((state) => state.scopeIds.mine);
  const itemsByPortfolio = usePortfolioStore((state) => state.items);
  const [query, setQuery] = useState("");

  const sharedIds = usePortfolioStore((state) => state.scopeIds.shared);
  const ownerId = isAuthenticated ? getPortfolioOwnerId() : profileId;

  const portfolios = useMemo(() => {
    const ids = new Set(mineIds ?? []);
    return allPortfolios.filter((portfolio) =>
      mineIds ? ids.has(portfolio.id) : portfolio.ownerId === ownerId,
    );
  }, [allPortfolios, mineIds, ownerId]);
  // Search also covers lists shared with you.
  const searchablePortfolios = useMemo(() => {
    const shared = new Set(sharedIds ?? []);
    return [
      ...portfolios,
      ...allPortfolios.filter(
        (portfolio) => shared.has(portfolio.id) && !portfolios.includes(portfolio),
      ),
    ];
  }, [allPortfolios, portfolios, sharedIds]);

  // Load the diner's lists (and shared ones), then all their items in one read.
  const [listsLoading, setListsLoading] = useState(true);
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    setListsLoading(true);
    void (async () => {
      try {
        const store = usePortfolioStore.getState();
        await Promise.all([
          store.loadPortfolioScope("mine"),
          store.loadPortfolioScope("shared").catch(() => undefined),
        ]);
        const { scopeIds } = usePortfolioStore.getState();
        await store.loadItemsForPortfolios([...(scopeIds.mine ?? []), ...(scopeIds.shared ?? [])]);
      } catch (error) {
        reportError(error, { screen: "Collections", action: "loadCollections" });
      } finally {
        if (active) setListsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, ownerId]);

  // Names and photos for every saved dish and stall come from the server in one call, so
  // items outside the app's local catalog cache are found too.
  const wanted = useMemo(
    () =>
      collectCollectionItemIds({
        savedDishIds,
        portfolios: searchablePortfolios,
        itemsByPortfolio,
      }),
    [itemsByPortfolio, savedDishIds, searchablePortfolios],
  );
  const wantedKey = `${wanted.dishIds.join(",")}|${wanted.stallIds.join(",")}`;
  const [details, setDetails] = useState<{
    key: string;
    rows: Map<string, PortfolioItemDetailRow>;
  }>();
  const [detailsFailed, setDetailsFailed] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    setDetailsFailed(false);
    getHungryService()
      .discovery.getItemDetails(wanted)
      .then((rows) => {
        if (active) setDetails({ key: wantedKey, rows: indexItemDetails(rows) });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "Collections", action: "loadItemDetails" });
        if (active) setDetailsFailed(true);
      });
    return () => {
      active = false;
    };
    // wantedKey stands for `wanted`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, wantedKey]);
  const isSearchLoading = listsLoading || (!detailsFailed && details?.key !== wantedKey);

  const foods = useMemo(() => {
    // Building and area are not in the detail rows yet; use the local catalog when it has them.
    // Read fresh on every rebuild, so buildings that hydrate after mount are picked up.
    const buildings = new Map(
      repository.listBuildings().map((building) => [building.id, building]),
    );
    return buildCollectionFoods({
      savedDishIds,
      portfolios: searchablePortfolios,
      itemsByPortfolio,
      getDetail: (itemType, id) => details?.rows.get(detailKey(itemType, id)),
      getPlace: (dishId) => {
        const dish = repository.getDishById(dishId);
        if (!dish) return undefined;
        const building = buildings.get(dish.buildingId);
        return {
          placeName: building?.name,
          areaName: buildingAreaName(building),
          description: dish.description,
        };
      },
    });
  }, [details, itemsByPortfolio, repository, savedDishIds, searchablePortfolios]);
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => (trimmedQuery ? searchCollectionFoods(foods, trimmedQuery) : []),
    [foods, trimmedQuery],
  );

  const rootNavigation = getRootNavigation(navigation as never);
  const openFood = (food: CollectionFood) => {
    if (food.itemType === "stall" && food.stallId) {
      rootNavigation.navigate("StallDetail", { venueId: food.stallId });
    } else if (food.dishId) {
      rootNavigation.navigate("DishDetail", { dishId: food.dishId });
    }
  };

  return (
    <ProfileScreenShell title="Collections" subtitle="Your saved food, all in one place.">
      <Input
        accessibilityLabel="Search your collections"
        value={query}
        onChangeText={setQuery}
        placeholder="Search food, captions or a place"
        leftIcon={<Search color={palette.textMuted} size={18} />}
        returnKeyType="search"
      />

      {trimmedQuery ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
            {results.length === 0 && isSearchLoading
              ? "Searching your collections…"
              : results.length === 0
                ? detailsFailed
                  ? "Couldn't search your collections. Check your connection and try again."
                  : `Nothing in your collections matches "${trimmedQuery}".`
                : `${results.length} ${results.length === 1 ? "item" : "items"} in your collections`}
          </AppText>
          {results.map((food) => (
            <FoodRow key={food.key} food={food} onPress={() => openFood(food)} />
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing[3] }}>
          <CollectionRow
            title="Want to try"
            count={savedDishIds.length}
            icon={<Bookmark color={palette.orange} size={20} />}
            onPress={() => navigation.navigate("Favourites")}
          />
          {portfolios.map((portfolio) => (
            <CollectionRow
              key={portfolio.id}
              title={portfolio.name}
              count={itemsByPortfolio[portfolio.id]?.length ?? portfolio.itemCount ?? 0}
              icon={<FolderHeart color={palette.orange} size={20} />}
              onPress={() => navigation.navigate("PortfolioDetail", { portfolioId: portfolio.id })}
            />
          ))}
          {FEATURE_FLAGS.portfoliosEnabled ? (
            <Button
              label="New collection"
              variant="secondary"
              leftIcon={<Plus color={palette.text} size={18} />}
              onPress={() => navigation.navigate("PortfolioCreate")}
            />
          ) : null}
          {portfolios.length === 0 ? (
            <View
              style={{
                backgroundColor: palette.bgSoft,
                borderRadius: componentRadii.card,
                gap: spacing[1],
                padding: spacing[4],
              }}
            >
              <AppText variant="bodyBold">Make a collection</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {
                  "Tap New collection, then add dishes and stalls to it, or use Save to list on a dish page."
                }
              </AppText>
            </View>
          ) : null}
        </View>
      )}
    </ProfileScreenShell>
  );
}

function CollectionRow({
  title,
  count,
  icon,
  onPress,
}: {
  title: string;
  count: number;
  icon: ReactNode;
  onPress: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const countLabel = `${count} ${count === 1 ? "item" : "items"}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${countLabel}`}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? palette.bgSoft : palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 64,
        padding: spacing[4],
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.orangeLight,
          borderRadius: 12,
          height: 40,
          justifyContent: "center",
          width: 40,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          {countLabel}
        </AppText>
      </View>
      <ChevronRight color={palette.textMuted} size={20} />
    </Pressable>
  );
}

function FoodRow({ food, onPress }: { food: CollectionFood; onPress: () => void }) {
  const { palette, radii, spacing } = useHungryTheme();
  const where = [food.placeName, food.areaName].filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        food.itemType === "stall"
          ? `${food.dishName}, stall, in ${food.collectionName}`
          : `${food.dishName} at ${food.venueName}, in ${food.collectionName}`
      }
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[3],
        opacity: pressed ? 0.8 : 1,
        paddingVertical: spacing[1],
      })}
    >
      {food.imageUrl ? (
        <AccessibleImage
          source={{ uri: food.imageUrl }}
          decorative
          contentFit="cover"
          style={{ borderRadius: radii.md, height: 64, width: 64 }}
        />
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.bgSoft,
            borderRadius: radii.md,
            height: 64,
            justifyContent: "center",
            width: 64,
          }}
        >
          <Utensils color={palette.orange} size={22} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {food.dishName}
        </AppText>
        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
          {food.venueName}
        </AppText>
        {where ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
            <MapPin color={palette.textMuted} size={12} />
            <AppText variant="micro" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {where}
            </AppText>
          </View>
        ) : null}
        {food.caption ? (
          <AppText variant="micro" tone="secondary" numberOfLines={1}>
            {`"${food.caption}"`}
          </AppText>
        ) : null}
      </View>
      {/* Only named lists get a tag; Want to try is the default home for saved food. */}
      {food.collectionId === WANT_TO_TRY_COLLECTION_ID ? null : (
        <AppText
          variant="micro"
          style={{ color: palette.orangeText, fontWeight: "700", maxWidth: 96 }}
          numberOfLines={1}
        >
          {food.collectionName}
        </AppText>
      )}
    </Pressable>
  );
}
