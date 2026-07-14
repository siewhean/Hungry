import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { MapPinned, Search, Utensils } from "lucide-react-native";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, EmptyState, Skeleton } from "@/components/ui";
import type {
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Discover">,
  NativeStackNavigationProp<RootStackParamList>
>;

type CatalogFilter = "all" | "halal" | "japanese" | "western" | "value";

const FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "Near me" },
  { id: "halal", label: "Halal" },
  { id: "japanese", label: "Japanese" },
  { id: "western", label: "Western" },
  { id: "value", label: "Value" },
];

function rawRequest(
  filter: CatalogFilter,
  coordinate: { latitude: number; longitude: number },
): CatalogPageRequest {
  return {
    coordinate,
    radiusMeters: 3_000,
    limit: 24,
    sort: "nearby",
    dietaryFlags: filter === "halal" ? ["halal"] : [],
    cuisineTags: filter === "japanese" || filter === "western" ? [filter] : [],
    maxPrice: filter === "value" ? 8 : undefined,
  };
}

function uniqueDishes(items: CatalogRawDishCard[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.venueId}:${item.name.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function CatalogDiscoverSkeleton() {
  const { radii, spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[5], padding: spacing[4] }}>
      <Skeleton width="42%" height={24} />
      <Skeleton width="100%" height={52} borderRadius={radii.lg} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width="48%" height={132} borderRadius={radii.lg} />
        <Skeleton width="48%" height={132} borderRadius={radii.lg} />
      </View>
      <Skeleton width="55%" height={22} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width={190} height={220} borderRadius={radii.lg} />
        <Skeleton width={190} height={220} borderRadius={radii.lg} />
      </View>
    </View>
  );
}

function RawDishCard({ item, releaseId }: { item: CatalogRawDishCard; releaseId?: string }) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityLabel={`Open ${item.name}`}
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate("CatalogRawDetail", { kind: "dish", id: item.id, releaseId })
      }
      style={{ width: 190 }}
    >
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        <View style={{ backgroundColor: palette.bgSoft, height: 118 }}>
          {item.imageUrl ? (
            <AccessibleImage
              accessibilityLabel={`${item.name} image`}
              contentFit="cover"
              source={{ uri: item.imageUrl }}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <AppText tone="muted" variant="micro">
                Image unavailable
              </AppText>
            </View>
          )}
          {item.verificationStatus !== "approved" ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.pill,
                left: spacing[2],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                position: "absolute",
                top: spacing[2],
              }}
            >
              <AppText tone="muted" variant="micro">
                Unverified
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ gap: spacing[1], minHeight: 94, padding: spacing[2] }}>
          <AppText numberOfLines={2} variant="bodyBold">
            {item.name}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="micro">
            {item.venueName}
          </AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText tone="muted" variant="micro">
              {item.distanceMeters === undefined
                ? "Singapore"
                : `${Math.round(item.distanceMeters)} m`}
            </AppText>
            {item.price !== undefined ? (
              <AppText style={{ color: palette.orange }} variant="price">
                S${item.price.toFixed(2)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RawVenueRow({ item, releaseId }: { item: CatalogRawVenueCard; releaseId?: string }) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, spacing } = useHungryTheme();
  const imageUrl = item.imageUrl ?? item.representativeDish?.imageUrl;
  return (
    <Pressable
      accessibilityLabel={`Open ${item.name}`}
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate("CatalogRawDetail", { kind: "venue", id: item.id, releaseId })
      }
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[3],
          paddingVertical: spacing[2],
        }}
      >
        <View
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: componentRadii.card,
            height: 58,
            overflow: "hidden",
            width: 58,
          }}
        >
          {imageUrl ? (
            <AccessibleImage
              source={{ uri: imageUrl }}
              contentFit="cover"
              style={{ height: "100%", width: "100%" }}
              accessibilityLabel={`${item.name} image`}
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <Utensils color={palette.textMuted} size={20} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: spacing[1] }}>
          <AppText numberOfLines={1} variant="bodyBold">
            {item.name}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="micro">
            {item.representativeDish?.name ?? `${item.menuCount} menu items`}
          </AppText>
          <AppText tone="muted" variant="micro">
            {item.distanceMeters === undefined
              ? (item.buildingName ?? "Singapore")
              : `${Math.round(item.distanceMeters)} m away`}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

/** Raw V2 Discover surface. It intentionally consumes raw cards directly. */
export function CatalogDiscoverHome() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, radii, semanticSpacing, spacing } = useHungryTheme();
  const coordinate = useLocationStore((state) => state.currentLocation);
  const service = getCatalogRawService();
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [dishes, setDishes] = useState<CatalogRawDishCard[]>([]);
  const [venues, setVenues] = useState<CatalogRawVenueCard[]>([]);
  const [releaseId, setReleaseId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const request = useMemo(() => rawRequest(filter, coordinate), [coordinate, filter]);
  const load = useCallback(async () => {
    if (!service) {
      setError("The catalog service is unavailable.");
      setLoading(false);
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const [dishPage, venuePage] = await Promise.all([
        service.listDishes(request),
        service.listVenues({ ...request, limit: 24 }),
      ]);
      if (version !== requestVersion.current) return;
      setDishes(uniqueDishes(dishPage.items));
      setVenues(venuePage.items);
      setReleaseId(dishPage.releaseId || venuePage.releaseId || undefined);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      setDishes([]);
      setVenues([]);
      setError(loadError instanceof Error ? loadError.message : "Could not load the catalog.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [request, service]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const openBrowse = useCallback(
    (browseMode: "dishes" | "stalls") => navigation.navigate("SearchResults", { browseMode }),
    [navigation],
  );

  if (loading && !dishes.length && !venues.length) return <CatalogDiscoverSkeleton />;
  if (error && !dishes.length && !venues.length) {
    return (
      <EmptyState
        title="Catalog unavailable"
        body={error}
        ctaLabel="Retry"
        onPress={() => void load()}
      />
    );
  }
  if (!dishes.length && !venues.length) {
    const hasFilter = filter !== "all";
    return (
      <EmptyState
        title={hasFilter ? "No nearby matches" : "No nearby catalog results"}
        body={
          hasFilter ? "Try another filter or browse the full directory." : "Try again in a moment."
        }
        ctaLabel={hasFilter ? "Clear filter" : "Retry"}
        onPress={hasFilter ? () => setFilter("all") : () => void load()}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing[5],
        paddingBottom: spacing[12],
        paddingHorizontal: semanticSpacing.screenEdge,
        paddingTop: spacing[3],
      }}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: palette.bg }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <AppText variant="h2">Discover</AppText>
          <AppText tone="secondary" variant="micro">
            Nearby dishes and stalls
          </AppText>
        </View>
        <Pressable
          accessibilityLabel="Open map"
          accessibilityRole="button"
          onPress={() => navigation.navigate("DiscoverMap")}
          style={{ backgroundColor: palette.bgSoft, borderRadius: radii.md, padding: spacing[3] }}
        >
          <MapPinned color={palette.text} size={20} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Search dishes and stalls"
        accessibilityRole="button"
        onPress={() => openBrowse("dishes")}
        style={{
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[2],
          padding: spacing[3],
        }}
      >
        <Search color={palette.textMuted} size={20} />
        <AppText tone="muted" variant="body">
          Dishes, stalls, or hawker centres…
        </AppText>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2] }}
      >
        {FILTERS.map((option) => {
          const active = filter === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(option.id)}
              style={{
                backgroundColor: active ? palette.orange : palette.bgSoft,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              }}
            >
              <AppText
                style={{ color: active ? palette.textInverse : palette.text }}
                variant="bodyBold"
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Pressable
          accessibilityLabel="Browse stalls and restaurants"
          accessibilityRole="button"
          onPress={() => openBrowse("stalls")}
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.lg,
            flex: 1,
            gap: spacing[2],
            minHeight: 116,
            padding: spacing[3],
          }}
        >
          <Utensils color={palette.orange} size={26} />
          <AppText variant="bodyBold">Stalls & Restaurants</AppText>
          <AppText tone="secondary" variant="micro">
            Browse venues near you
          </AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Browse dishes"
          accessibilityRole="button"
          onPress={() => openBrowse("dishes")}
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.lg,
            flex: 1,
            gap: spacing[2],
            minHeight: 116,
            padding: spacing[3],
          }}
        >
          <Search color={palette.orange} size={26} />
          <AppText variant="bodyBold">Dishes</AppText>
          <AppText tone="secondary" variant="micro">
            Find your craving first
          </AppText>
        </Pressable>
      </View>

      <View style={{ gap: spacing[3] }}>
        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          <AppText variant="h3">Nearby dishes</AppText>
          <Pressable accessibilityRole="button" onPress={() => openBrowse("dishes")}>
            <AppText style={{ color: palette.orange }} variant="bodyBold">
              See all
            </AppText>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[3] }}
        >
          {dishes.slice(0, 8).map((item) => (
            <RawDishCard key={item.id} item={item} releaseId={releaseId} />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: spacing[2] }}>
        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          <AppText variant="h3">Stalls near you</AppText>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate("DiscoverMap")}>
            <AppText style={{ color: palette.orange }} variant="bodyBold">
              Map view
            </AppText>
          </Pressable>
        </View>
        {venues.slice(0, 8).map((item) => (
          <RawVenueRow key={item.id} item={item} releaseId={releaseId} />
        ))}
      </View>
    </ScrollView>
  );
}
