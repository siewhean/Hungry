/**
 * ReviewFeedScreenV2 — Enhanced Tab 3
 * Pure user-review feed with optimized filtering and search.
 * 100% user-generated content badge.
 * Filter by Dish, Location, Rating, and Recent.
 */
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Star, Search, Filter, ShieldCheck, Heart } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Input, Chip, EmptyState } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useHungryTheme } from "@/theme";
import type { DishDetail, Review } from "@/types/domain";

// ─── Types ──────────────────────────────────────────────────────────────────

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

type ReviewFeedItem = {
  review: Review;
  dish: DishDetail;
  dishName: string;
  venueName: string;
  venueId: string;
  dishId: string;
  isVegetarian?: boolean; // Added for Sarah
};

type FilterMode = "Recent" | "Rating" | "Dish" | "Location" | "Vegetarian";

// ─── Mock review feed data ────────────────────────────────────────────────────

const MOCK_REVIEWS_V2: ReviewFeedItem[] = [
  {
    dishId: "dish-v-1",
    dishName: "Vegetarian Bee Hoon",
    venueName: "Ruyi Vegetarian",
    venueId: "venue-ruyi",
    isVegetarian: true,
    review: {
      id: "v2-r-1",
      authorName: "Sarah L.",
      rating: 5,
      createdAt: "2026-04-22T10:00:00Z",
      text: "Hard to find good vegetarian options in Maxwell, but this is a gem! The crispy 'duck' is so good and not too oily. Perfect for vegetarians looking for authentic local taste.",
      tags: ["Vegetarian", "Crispy", "Local"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-v-2",
    dishName: "Truffle Roast Duck",
    venueName: "Fook Seng Golden Duck",
    venueId: "venue-fook-seng",
    review: {
      id: "v2-r-2",
      authorName: "Ahmad R.",
      rating: 5,
      createdAt: "2026-04-21T13:30:00Z",
      text: "The truffle aroma hits you before the plate even arrives. Duck skin is glass-like. Best roast duck I've had this year. Price is reasonable for the quality.",
      tags: ["Truffle", "Crispy", "Premium"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-v-3",
    dishName: "Thunder Tea Rice",
    venueName: "Hakka Thunder Tea",
    venueId: "venue-hakka-tea",
    isVegetarian: true,
    review: {
      id: "v2-r-3",
      authorName: "Wei Ming",
      rating: 4,
      createdAt: "2026-04-20T12:00:00Z",
      text: "Very healthy and refreshing. The tea broth is bitter but in a good way. Lots of vegetables and tofu. A bit of a queue during lunch hour.",
      tags: ["Healthy", "Hakka", "Vegetarian"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
];

const FILTER_CHIPS: FilterMode[] = ["Recent", "Rating", "Dish", "Location", "Vegetarian"];

// ─── ReviewCardV2 ─────────────────────────────────────────────────────────────

function ReviewCardV2({
  item,
  onPressDish,
}: {
  item: ReviewFeedItem;
  onPressDish: (dishId: string) => void;
}) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const { width } = useWindowDimensions();
  const hasPhoto = item.review.photos.length > 0;

  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: radii.xl,
          marginHorizontal: spacing[4],
          marginBottom: spacing[4],
          overflow: "hidden",
          borderWidth: 1,
          borderColor: palette.border,
        },
        shadows.card,
      ]}
    >
      {/* Photo with Overlay Info */}
      {hasPhoto && (
        <Pressable onPress={() => onPressDish(item.dishId)} style={{ position: "relative" }}>
          <Image
            source={{ uri: item.review.photos[0] }}
            style={{ width: "100%", height: width * 0.6 }}
            contentFit="cover"
          />
          {item.isVegetarian && (
            <View
              style={{
                position: "absolute",
                top: spacing[3],
                right: spacing[3],
                backgroundColor: "rgba(34, 197, 94, 0.9)",
                paddingHorizontal: spacing[2],
                paddingVertical: 4,
                borderRadius: radii.sm,
              }}
            >
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "700" }}>
                VEGETARIAN
              </AppText>
            </View>
          )}
        </Pressable>
      )}

      {/* Content */}
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        {/* User Info & Rating */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: palette.orangeLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText style={{ color: palette.orange, fontWeight: "800" }}>
                {item.review.authorName.charAt(0)}
              </AppText>
            </View>
            <View>
              <AppText variant="bodyBold">{item.review.authorName}</AppText>
              <AppText variant="micro" tone="muted">
                {new Date(item.review.createdAt).toLocaleDateString()}
              </AppText>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: palette.amberLight,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Star size={12} color={palette.amber} fill={palette.amber} />
            <AppText variant="bodySmallBold" style={{ color: palette.amber }}>
              {item.review.rating.toFixed(1)}
            </AppText>
          </View>
        </View>

        {/* Dish Details */}
        <Pressable
          onPress={() => onPressDish(item.dishId)}
          style={{
            backgroundColor: palette.bgSoft,
            padding: spacing[3],
            borderRadius: radii.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="bodySmallBold" numberOfLines={1}>
              {item.dishName}
            </AppText>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              {item.venueName}
            </AppText>
          </View>
          <Heart size={16} color={palette.textMuted} />
        </Pressable>

        {/* Review Body */}
        <AppText variant="body" style={{ color: palette.text, lineHeight: 22 }}>
          {item.review.text}
        </AppText>

        {/* Tags */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {item.review.tags.map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: palette.border,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <AppText variant="micro" style={{ color: palette.textSecondary }}>
                #{tag}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── ReviewFeedScreenV2 ───────────────────────────────────────────────────────

export function ReviewFeedScreenV2() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing, radii } = useHungryTheme();
  const repository = getDataRepository();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterMode>("Recent");

  // Get data from repository and merge with mocks
  const allReviews = useMemo<ReviewFeedItem[]>(() => {
    const fromRepo = repository.listBuildings().flatMap((building) =>
      repository.listVenuesByBuilding(building.id).flatMap((venue) =>
        repository.listDishesByVenue(venue.id).flatMap((dish) =>
          dish.reviews.map((review) => ({
            review,
            dish,
            dishId: dish.id,
            dishName: dish.name,
            venueName: dish.venueName,
            venueId: dish.venueId,
          })),
        ),
      ),
    );

    const combined = [...MOCK_REVIEWS_V2, ...fromRepo];

    // Apply sorting
    if (activeFilter === "Rating") {
      return combined.sort((a, b) => b.review.rating - a.review.rating);
    }
    if (activeFilter === "Dish") {
      return combined.sort((a, b) => a.dishName.localeCompare(b.dishName));
    }
    if (activeFilter === "Location") {
      return combined.sort((a, b) => a.venueName.localeCompare(b.venueName));
    }
    if (activeFilter === "Vegetarian") {
      return combined.filter((item) =>
        item.review.tags.some((t) => t.toLowerCase() === "vegetarian"),
      );
    }

    return combined.sort(
      (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
    );
  }, [repository, activeFilter]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return allReviews;
    const q = searchQuery.toLowerCase();
    return allReviews.filter(
      (item) =>
        item.dishName.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.review.text.toLowerCase().includes(q),
    );
  }, [allReviews, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: ReviewFeedItem }) => (
      <ReviewCardV2
        item={item}
        onPressDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
      />
    ),
    [navigation],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Header Section */}
      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: spacing[4] }}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <View>
            <AppText variant="h1" style={{ fontWeight: "900" }}>
              Feed
            </AppText>
            <AppText variant="micro" tone="muted">
              What&apos;s the community eating?
            </AppText>
          </View>
          <View
            style={{
              backgroundColor: palette.successSoft,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <ShieldCheck size={14} color={palette.success} />
            <AppText variant="micro" style={{ color: palette.success, fontWeight: "700" }}>
              100% USER CONTENT
            </AppText>
          </View>
        </View>

        {/* Search Bar */}
        <View style={{ position: "relative" }}>
          <Input
            placeholder="Search dish or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            style={{ borderRadius: radii.pill, backgroundColor: palette.surface }}
          />
        </View>

        {/* Filters */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Filter size={18} color={palette.orange} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            {FILTER_CHIPS.map((chip) => (
              <Chip
                key={chip}
                label={chip}
                selected={activeFilter === chip}
                onPress={() => setActiveFilter(chip)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Feed List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.review.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: spacing[4], paddingBottom: spacing[24] }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No reviews found" body="Try adjusting your filters or search query." />
        }
      />
    </SafeAreaView>
  );
}
