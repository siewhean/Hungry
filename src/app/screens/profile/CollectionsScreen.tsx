import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Bookmark, ChevronRight, FolderHeart, MapPin, Search, Utensils } from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AccessibleImage, AppText, Input } from "@/components/ui";
import {
  WANT_TO_TRY_COLLECTION_ID,
  buildCollectionFoods,
  searchCollectionFoods,
  type CollectionFood,
} from "@/features/collections/collectionSearch";
import { reportError } from "@/lib/monitoring/reportError";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
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

  const portfolios = useMemo(() => {
    const ids = new Set(mineIds ?? []);
    return allPortfolios.filter((portfolio) =>
      mineIds ? ids.has(portfolio.id) : portfolio.ownerId === profileId,
    );
  }, [allPortfolios, mineIds, profileId]);

  // Load the diner's lists, then the items in them so their food can be searched.
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const store = usePortfolioStore.getState();
    void store
      .loadPortfolioScope("mine")
      .then(() => {
        if (!active) return undefined;
        const { scopeIds, loadPortfolioItems } = usePortfolioStore.getState();
        return Promise.all(
          // n-plus-one-ok: the list store loads items one list at a time; a diner has a handful of lists.
          (scopeIds.mine ?? []).map((portfolioId) => loadPortfolioItems(portfolioId)),
        );
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "Collections", action: "loadCollections" });
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const buildings = useMemo(
    () => new Map(repository.listBuildings().map((building) => [building.id, building])),
    [repository],
  );
  const foods = useMemo(
    () =>
      buildCollectionFoods({
        savedDishIds,
        portfolios,
        itemsByPortfolio,
        getDish: (dishId) => repository.getDishById(dishId),
        getBuilding: (buildingId) => buildings.get(buildingId),
      }),
    [buildings, itemsByPortfolio, portfolios, repository, savedDishIds],
  );
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => (trimmedQuery ? searchCollectionFoods(foods, trimmedQuery) : []),
    [foods, trimmedQuery],
  );

  const rootNavigation = getRootNavigation(navigation as never);
  const openDish = (food: CollectionFood) => {
    rootNavigation.navigate("DishDetail", { dishId: food.dishId });
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
          <AppText variant="bodySmall" tone="secondary">
            {results.length === 0
              ? `Nothing in your collections matches "${trimmedQuery}".`
              : `${results.length} ${results.length === 1 ? "food" : "foods"} in your collections`}
          </AppText>
          {results.map((food) => (
            <FoodRow key={food.key} food={food} onPress={() => openDish(food)} />
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
                Hold Save on any dish to add it to a new collection.
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
  const countLabel = `${count} ${count === 1 ? "food" : "foods"}`;
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
      accessibilityLabel={`${food.dishName} at ${food.venueName}, in ${food.collectionName}`}
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
      <AppText
        variant="micro"
        style={{ color: palette.orange, fontWeight: "700", maxWidth: 96 }}
        numberOfLines={1}
      >
        {food.collectionId === WANT_TO_TRY_COLLECTION_ID ? "Want to try" : food.collectionName}
      </AppText>
    </Pressable>
  );
}
