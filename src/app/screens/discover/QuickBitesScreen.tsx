import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, MapPinned, Heart } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, ExpandableSearchLauncher, Screen, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useLocationStore } from "@/store/useLocationStore";
import { getHomeBitesFeed } from "@/features/home/bites";
import { dishes as mockDishes } from "@/lib/services/mock/data";
import type { Bite } from "@/lib/services/types";
import { useSearchStore } from "@/store/useSearchStore";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type QuickBitesRoute = RouteProp<RootStackParamList, "QuickBites">;
export type DiscoverCollection = NonNullable<
  NonNullable<RootStackParamList["QuickBites"]>["collection"]
>;

export const COLLECTION_COPY: Record<
  NonNullable<DiscoverCollection>,
  {
    title: string;
    placeholder: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  quickBites: {
    title: "Quick Bites",
    placeholder: "Find quick bites...",
    emptyTitle: "No quick bites found nearby",
    emptyBody: "Try changing your filters or search query.",
  },
  trending: {
    title: "Trending",
    placeholder: "Find trending dishes...",
    emptyTitle: "No trending dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  editorChoice: {
    title: "Editor's Choice",
    placeholder: "Find curated dishes...",
    emptyTitle: "No editor's picks found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  budget: {
    title: "Budget Under S$8",
    placeholder: "Find budget dishes...",
    emptyTitle: "No budget dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  lateNight: {
    title: "Late Night Makan",
    placeholder: "Find late night food...",
    emptyTitle: "No late night dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
};

const CUISINES = [
  "All",
  "Local",
  "Halal",
  "Japanese",
  "Western",
  "Noodles",
  "Rice",
  "Spicy",
  "Dessert",
];

// Pre-generate 40 items to ensure a long feed
const AUTHOR_NAMES = [
  "Sarah Lim",
  "Emma Watson",
  "Tan Ah Teck",
  "Joy Wang",
  "Ken Tan",
  "Lia Low",
  "Wei Ming",
  "Ahmad K",
];
const DISH_NAMES = [
  "Chicken Rice",
  "Chicken Satay",
  "Sliced Fish Ban Mian",
  "Wagyu Burger",
  "Salmon Don",
  "Laksa",
  "Mala Xiang Guo",
  "Pandan Cake",
];
const FALLBACK_DISH_IMAGE_URL =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800";
const DISH_IMAGE_URLS: Record<string, string> = {
  "Chicken Rice": "https://upload.wikimedia.org/wikipedia/commons/7/71/Hainanese_Chicken_Rice.jpg",
  "Chicken Satay":
    "https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&q=80&w=800",
  "Sliced Fish Ban Mian":
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=800",
  "Wagyu Burger":
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800",
  "Salmon Don":
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=800",
  Laksa:
    "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&q=80&w=800",
  "Mala Xiang Guo":
    "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=800",
  "Pandan Cake":
    "https://images.unsplash.com/photo-1621236378699-8597fac6bb4d?auto=format&fit=crop&q=80&w=800",
};
const DISH_ID_BY_NAME: Record<string, string> = {
  "Chicken Rice": "dish-chicken-rice",
  "Chicken Satay": "dish-satay",
  "Sliced Fish Ban Mian": "dish-ban-mian",
  "Wagyu Burger": "dish-wagyu-burger",
  "Salmon Don": "dish-salmon-don",
  Laksa: "dish-laksa",
  "Mala Xiang Guo": "dish-mala-xiang-guo",
  "Pandan Cake": "dish-pandan-cake",
};
const DISH_BY_ID = new Map(mockDishes.map((dish) => [dish.id, dish]));

function getDishImageUrl(dishName: string, photoUrl?: string) {
  return DISH_IMAGE_URLS[dishName] || photoUrl?.trim() || FALLBACK_DISH_IMAGE_URL;
}

function getDishId(dishName: string, dishId?: string) {
  return DISH_ID_BY_NAME[dishName] || dishId || "dish-chicken-rice";
}

function withFoodImages(bites: Bite[]) {
  return bites.map((bite) => ({
    ...bite,
    ...getDishSyncedFields(bite),
  }));
}

function getDishSyncedFields(bite: Bite) {
  const dishId = getDishId(bite.dishName, bite.dishId);
  const dish = DISH_BY_ID.get(dishId);

  if (!dish) {
    return {
      dishId,
      photoUrl: getDishImageUrl(bite.dishName, bite.photoUrl),
    };
  }

  return {
    buildingId: dish.buildingId,
    dishId: dish.id,
    dishName: dish.name,
    photoUrl: dish.imageUrl,
    price: dish.price,
    rating: dish.rating,
    unitNumber: dish.unitNumber,
    venueId: dish.venueId,
    venueName: dish.venueName,
  };
}

const MOCK_ITEMS: Bite[] = Array.from({ length: 40 }).map((_, i) => ({
  id: `bite-mock-${i}`,
  authorId: `user-${i % 8}`,
  authorName: AUTHOR_NAMES[i % 8],
  authorAvatar: `https://i.pravatar.cc/64?u=${i}`,
  dishId: getDishId(DISH_NAMES[i % 8]),
  dishName: DISH_NAMES[i % 8],
  venueId: `venue-${i % 8}`,
  venueName: "Delicious Food Stall",
  unitNumber: `#01-${10 + i}`,
  buildingId: "building-maxwell",
  buildingName: "Maxwell Food Centre",
  photoUrl: getDishImageUrl(DISH_NAMES[i % 8]),
  caption: `Absolutely delicious ${DISH_NAMES[i % 8]}! A must-try local favorite. #food #singapore`,
  tasteStamp: { sweet: 1, spicy: 2, sour: 1, salty: 4, rich: 5, aromatic: 4 },
  cravingCount: Math.floor(Math.random() * 1000),
  savedCount: Math.floor(Math.random() * 200),
  rating: 4.0 + Math.random(),
  price: 3.5 + Math.random() * 10,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
}));

export function getDiscoverBiteCollection(
  collection: DiscoverCollection,
  bites: Bite[] = MOCK_ITEMS,
) {
  const bitesWithImages = withFoodImages(bites);
  if (collection === "budget") {
    return bitesWithImages.filter((bite) => bite.price < 8);
  }
  if (collection === "editorChoice") {
    return bitesWithImages.filter((bite) => bite.rating >= 4.4);
  }
  if (collection === "trending") {
    return [...bitesWithImages].sort((a, b) => b.cravingCount - a.cravingCount);
  }
  if (collection === "lateNight") {
    return bitesWithImages.filter(
      (bite) =>
        bite.caption.toLowerCase().includes("late") ||
        bite.dishName.toLowerCase().includes("satay") ||
        bite.dishName.toLowerCase().includes("laksa") ||
        bite.dishName.toLowerCase().includes("mala"),
    );
  }
  return bitesWithImages;
}

export function QuickBitesScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<QuickBitesRoute>();
  const { palette, spacing, radii } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const collection: DiscoverCollection = route.params?.collection ?? "quickBites";
  const collectionCopy = COLLECTION_COPY[collection];

  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [bites, setBites] = useState<Bite[]>(MOCK_ITEMS);
  const [isLoading, setIsLoading] = useState(true);
  const searchQuery = useSearchStore((state) => state.filters.query);
  const updateSearchQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2 - 32 - 12, 240),
    [screenWidth, spacing],
  );

  const submitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      rememberSearch(trimmed);
    }
    navigation.navigate("SearchHome");
  }, [navigation, rememberSearch, searchQuery]);

  // ── Animation Logic ────────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const CHIPS_HEIGHT = 64;

  const chipsOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const chipsHeightAnim = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [CHIPS_HEIGHT, 0],
    extrapolate: "clamp",
  });

  const chipsTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -20],
    extrapolate: "clamp",
  });

  useEffect(() => {
    // Sync with location and real feed if available
    const loadBites = async () => {
      try {
        const feed = await getHomeBitesFeed(currentLocation.latitude, currentLocation.longitude);
        if (feed && feed.length > 0) {
          // Prepend real feed to mock items
          const existingIds = new Set(MOCK_ITEMS.map((b) => b.id));
          const newUniqueBites = feed
            .filter((b) => !existingIds.has(b.id))
            .map((b) => ({
              ...b,
              dishId: getDishId(b.dishName, b.dishId),
              photoUrl: getDishImageUrl(b.dishName, b.photoUrl),
            }));
          setBites([...newUniqueBites, ...MOCK_ITEMS]);
        }
      } catch (err) {
        console.warn("Failed to fetch live bites, using fallback list.");
      } finally {
        setIsLoading(false);
      }
    };
    void loadBites();
  }, [currentLocation]);

  const collectionBites = useMemo(() => {
    return getDiscoverBiteCollection(collection, bites);
  }, [bites, collection]);

  const filteredBites = useMemo(() => {
    const list = collectionBites
      .filter((bite) => {
        const cuisine = selectedCuisine.toLowerCase();
        const matchesCuisine =
          cuisine === "all" ||
          bite.caption.toLowerCase().includes(cuisine) ||
          bite.dishName.toLowerCase().includes(cuisine);

        return matchesCuisine;
      })
      .map((bite) => {
        // Assign deterministic distance for mock items
        const dist = (parseInt(bite.id.replace(/\D/g, "") || "0") % 800) + 50;
        return { ...bite, distance: dist };
      });

    return list.sort((a, b) => a.distance - b.distance);
  }, [collectionBites, selectedCuisine]);

  const numColumns = 2;
  const itemWidth = screenWidth / numColumns;

  const renderBiteItem = useCallback(
    ({ item }: { item: Bite & { distance: number } }) => (
      <Pressable
        onPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
        style={{
          width: itemWidth,
          height: itemWidth * 1.35,
          backgroundColor: palette.surface,
          borderRightWidth: 0.5,
          borderBottomWidth: 0.5,
          borderColor: palette.border,
        }}
      >
        <Image source={{ uri: item.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.8)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardContent}>
          <View style={styles.authorBadge}>
            <Avatar uri={item.authorAvatar} name={item.authorName} size={18} />
            <AppText
              variant="micro"
              style={{ color: palette.white, fontWeight: "700", fontSize: 10 }}
            >
              {item.authorName}
            </AppText>
          </View>
          <View style={{ flex: 1 }} />
          <AppText
            variant="bodySmallBold"
            style={{ color: palette.white, marginBottom: 2 }}
            numberOfLines={1}
          >
            {item.dishName}
          </AppText>
          <View style={styles.metaRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <MapPinned size={10} color={palette.white} />
              <AppText
                variant="micro"
                style={{ color: palette.white, fontWeight: "600", fontSize: 10 }}
              >
                {item.distance}m
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Heart
                size={10}
                color={palette.white}
                fill={palette.white}
                style={{ opacity: 0.8 }}
              />
              <AppText
                variant="micro"
                style={{ color: palette.white, fontWeight: "700", fontSize: 10 }}
              >
                {item.cravingCount}
              </AppText>
            </View>
          </View>
        </View>
      </Pressable>
    ),
    [itemWidth, palette, navigation],
  );

  const renderFoodCarousel = useCallback(
    () =>
      filteredBites.length ? (
        <View style={{ paddingVertical: spacing[5], gap: spacing[3] }}>
          <View style={{ paddingHorizontal: spacing[4] }}>
            <AppText variant="h3">{collectionCopy.title}</AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
          >
            {filteredBites.map((bite) => (
              <Pressable
                key={`carousel-${bite.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Open ${bite.dishName} at ${bite.venueName}`}
                onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                style={[
                  styles.carouselCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: radii.lg,
                  },
                ]}
              >
                <Image
                  source={{ uri: bite.photoUrl }}
                  style={{ height: 104, width: "100%" }}
                  contentFit="cover"
                />
                <View style={{ padding: spacing[2], gap: 2 }}>
                  <AppText variant="bodySmallBold" numberOfLines={1}>
                    {bite.dishName}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {bite.venueName}
                  </AppText>
                  <AppText variant="price" style={{ color: palette.orange }}>
                    S${bite.price.toFixed(2)}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null,
    [
      collectionCopy.title,
      filteredBites,
      navigation,
      palette.border,
      palette.orange,
      palette.surface,
      radii.lg,
      spacing,
    ],
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            backgroundColor: palette.bg,
            zIndex: 10,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
          <AppText variant="h2" style={{ flex: 1 }}>
            {collectionCopy.title}
          </AppText>
          <ExpandableSearchLauncher
            query={searchQuery}
            onQueryChange={updateSearchQuery}
            onSubmit={submitSearch}
            iconAlignment="right"
            iconSize={40}
            barHeight={40}
            placeholder="Search dishes..."
            expandedWidth={searchBarWidth}
            borderColor={palette.border}
            backgroundColor={palette.bgSoft}
            textColor={palette.text}
            onClear={() => updateSearchQuery("")}
          />
        </View>

        <Animated.View
          style={{
            height: chipsHeightAnim,
            opacity: chipsOpacity,
            transform: [{ translateY: chipsTranslateY }],
            overflow: "hidden",
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: spacing[3], gap: spacing[2] }}
          >
            {CUISINES.map((cuisine) => (
              <Chip
                key={cuisine}
                label={cuisine}
                selected={selectedCuisine === cuisine}
                onPress={() => setSelectedCuisine(cuisine)}
              />
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      <View style={{ flex: 1, width: "100%" }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={palette.orange} size="large" />
          </View>
        ) : (
          <FlashList
            data={filteredBites}
            renderItem={renderBiteItem}
            keyExtractor={(item) => item.id}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            scrollEventThrottle={16}
            // @ts-ignore
            estimatedItemSize={220}
            numColumns={numColumns}
            contentContainerStyle={{ paddingBottom: spacing[12] }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View
                style={{
                  marginTop: spacing[12],
                  alignItems: "center",
                  gap: spacing[4],
                  width: "100%",
                }}
              >
                <AppText style={styles.emptyStateIcon}>🥣</AppText>
                <View
                  style={{ alignItems: "center", gap: spacing[1], paddingHorizontal: spacing[8] }}
                >
                  <AppText variant="h3" style={{ textAlign: "center" }}>
                    {collectionCopy.emptyTitle}
                  </AppText>
                  <AppText tone="muted" style={{ textAlign: "center" }}>
                    {collectionCopy.emptyBody}
                  </AppText>
                </View>
              </View>
            }
            ListFooterComponent={renderFoodCarousel}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12 },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  backBtn: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  emptyStateIcon: {
    fontSize: 48,
    height: 72,
    lineHeight: 64,
    textAlign: "center",
    width: 72,
  },
  cardContent: { ...StyleSheet.absoluteFillObject, padding: 10, justifyContent: "flex-end" },
  authorBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 4,
    paddingRight: 8,
    borderRadius: 12,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  carouselCard: {
    borderWidth: 1,
    overflow: "hidden",
    width: 168,
  },
});
