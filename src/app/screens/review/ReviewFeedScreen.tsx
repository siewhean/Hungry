/**
 * ReviewFeedScreen — Tab 3
 * Pure user-review feed. 100% user-generated content.
 * Filter by dish, stall, rating, or recency.
 * No discovery or editorial content here.
 */
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Star, SlidersHorizontal, Search, X, ChevronRight } from "lucide-react-native";
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
};

type FilterMode = "recent" | "top_rated" | "dish" | "location";

// ─── Mock review feed data ────────────────────────────────────────────────────
// Aggregates reviews from all dishes to create a social-style feed.

const MOCK_EXTRA_REVIEWS: ReviewFeedItem[] = [
  {
    dishId: "dish-chicken-rice",
    dishName: "Chicken Rice",
    venueName: "Tian Tian Chicken Rice",
    venueId: "venue-tian-tian",
    review: {
      id: "feed-r-1",
      authorName: "Sarah L.",
      rating: 5,
      createdAt: "2026-04-21T09:30:00Z",
      text: "The best chicken rice in Singapore, no contest. The chilli is life-changing. Came at 11am and the queue was already 20 deep — worth every minute.",
      tags: ["Fragrant", "Juicy", "Must Try"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-laksa",
    dishName: "Laksa",
    venueName: "328 Katong Laksa",
    venueId: "venue-katong-laksa",
    review: {
      id: "feed-r-2",
      authorName: "Ahmad R.",
      rating: 5,
      createdAt: "2026-04-20T13:00:00Z",
      text: "Thick, creamy coconut gravy with perfectly cooked cockles. The cut noodles mean you can eat it with a spoon only — very authentic. Pro tip: go for the large.",
      tags: ["Creamy", "Spicy", "Rich"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-char-kway-teow",
    dishName: "Char Kway Teow",
    venueName: "Hill Street Char Kway Teow",
    venueId: "venue-hill-street-ckt",
    review: {
      id: "feed-r-3",
      authorName: "Wei Ming",
      rating: 4,
      createdAt: "2026-04-19T18:45:00Z",
      text: "Wok hei is real here. The cockles were fresh and the noodles had a nice char. Only gripe: no options for less oil. But if you're here for the full experience, this is it.",
      tags: ["Wok Hei", "Savoury", "Smoky"],
      wouldRecommend: true,
      photos: [],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-bak-chor-mee",
    dishName: "Bak Chor Mee",
    venueName: "Bedok 85 Fengshan Centre",
    venueId: "venue-bedok-85",
    review: {
      id: "feed-r-4",
      authorName: "Emma T.",
      rating: 5,
      createdAt: "2026-04-18T12:00:00Z",
      text: "Minced pork mee pok done right. The vinegar-chilli sauce is perfectly balanced. Pork liver is silky not grainy. Dry version with extra chilli 🔥",
      tags: ["Tangy", "Savoury", "Spicy"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-chicken-rice",
    dishName: "Chicken Rice",
    venueName: "Tian Tian Chicken Rice",
    venueId: "venue-tian-tian",
    review: {
      id: "feed-r-5",
      authorName: "Uncle Tan",
      rating: 4,
      createdAt: "2026-04-17T10:15:00Z",
      text: "Come early or you'll miss the roast chicken. The poached version is better than the roast IMO. Dark soy sauce on the side is a must.",
      tags: ["Comforting", "Juicy"],
      wouldRecommend: true,
      photos: [],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-satay",
    dishName: "Satay",
    venueName: "Lau Pa Sat Satay Street",
    venueId: "venue-lau-pa-sat-satay",
    review: {
      id: "feed-r-6",
      authorName: "Priya S.",
      rating: 5,
      createdAt: "2026-04-16T21:30:00Z",
      text: "Night market vibes. Best eaten outdoors with cold beer. The peanut sauce is thick and fragrant — we went through 3 portions. Great for groups!",
      tags: ["Smoky", "Rich", "Fragrant"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1529564879024-c54e7c2dd0e5?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
];

const FILTER_OPTIONS: { id: FilterMode; label: string }[] = [
  { id: "recent", label: "Most Recent" },
  { id: "top_rated", label: "Top Rated" },
  { id: "dish", label: "By Dish" },
  { id: "location", label: "By Location" },
];

// ─── StarRow ─────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  const { palette } = useHungryTheme();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={palette.amber}
          fill={i <= rating ? palette.amber : "transparent"}
        />
      ))}
    </View>
  );
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({
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
          borderRadius: radii.lg,
          marginHorizontal: spacing[4],
          marginBottom: spacing[4],
          overflow: "hidden",
          borderWidth: 1,
          borderColor: palette.border,
        },
        shadows.card,
      ]}
    >
      {/* Photo */}
      {hasPhoto && (
        <Pressable onPress={() => onPressDish(item.dishId)}>
          <Image
            source={{ uri: item.review.photos[0] }}
            style={{ width: "100%", height: width * 0.55 }}
            contentFit="cover"
          />
        </Pressable>
      )}

      {/* Body */}
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        {/* Author + rating row */}
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                backgroundColor: palette.orange,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText
                style={{
                  color: palette.white,
                  fontWeight: "800",
                  fontSize: 14,
                }}
              >
                {item.review.authorName.charAt(0).toUpperCase()}
              </AppText>
            </View>
            <View>
              <AppText variant="bodySmallBold" style={{ color: palette.text }}>
                {item.review.authorName}
              </AppText>
              <AppText variant="micro" tone="muted">
                {new Date(item.review.createdAt).toLocaleDateString("en-SG", {
                  month: "short",
                  day: "numeric",
                })}
              </AppText>
            </View>
          </View>
          <StarRow rating={item.review.rating} size={14} />
        </View>

        {/* Dish link */}
        <Pressable
          onPress={() => onPressDish(item.dishId)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            backgroundColor: palette.orangeLight,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: radii.md,
            alignSelf: "flex-start",
          }}
        >
          <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
            {item.dishName}
          </AppText>
          <AppText variant="micro" style={{ color: palette.textMuted }}>
            ·
          </AppText>
          <AppText variant="micro" style={{ color: palette.textMuted }} numberOfLines={1}>
            {item.venueName}
          </AppText>
        </Pressable>

        {/* Review text */}
        <AppText variant="body" style={{ color: palette.text, lineHeight: 22 }}>
          {item.review.text}
        </AppText>

        {/* Tags */}
        {item.review.tags.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {item.review.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: palette.bgSoft,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 4,
                  borderRadius: radii.sm,
                }}
              >
                <AppText
                  variant="micro"
                  style={{ color: palette.textSecondary, fontWeight: "600" }}
                >
                  {tag}
                </AppText>
              </View>
            ))}
          </View>
        )}

        {/* Recommend row */}
        {item.review.wouldRecommend && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.success,
              }}
            />
            <AppText variant="micro" style={{ color: palette.success, fontWeight: "600" }}>
              Would recommend
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── ReviewFeedScreen ─────────────────────────────────────────────────────────

export function ReviewFeedScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const repository = getDataRepository();

  const [filterMode, setFilterMode] = useState<FilterMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Gather reviews from all dishes
  const allReviews = useMemo<ReviewFeedItem[]>(() => {
    const dishes = repository.listBuildings().flatMap((building) =>
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

    // Merge with mock extra reviews
    const combined = [...dishes, ...MOCK_EXTRA_REVIEWS];

    // Sort
    if (filterMode === "top_rated") {
      return [...combined].sort((a, b) => b.review.rating - a.review.rating);
    }
    if (filterMode === "dish") {
      return [...combined].sort((a, b) => a.dishName.localeCompare(b.dishName));
    }
    if (filterMode === "location") {
      return [...combined].sort((a, b) => a.venueName.localeCompare(b.venueName));
    }
    // Default: most recent
    return [...combined].sort(
      (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
    );
  }, [repository, filterMode]);

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return allReviews;
    const q = searchQuery.toLowerCase();
    return allReviews.filter(
      (item) =>
        item.dishName.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.review.text.toLowerCase().includes(q) ||
        item.review.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allReviews, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: ReviewFeedItem }) => (
      <ReviewCard
        item={item}
        onPressDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback(
    (item: ReviewFeedItem) => `${item.review.id}-${item.dishId}`,
    [],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: spacing[2],
          gap: spacing[2],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <AppText variant="h1" style={{ color: palette.text, fontWeight: "900" }}>
              Reviews
            </AppText>
            <AppText variant="micro" tone="muted">
              {filteredReviews.length} community reviews
            </AppText>
          </View>
          <Pressable
            onPress={() => setShowSearch((s) => !s)}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.pill,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showSearch ? (
              <X color={palette.text} size={18} />
            ) : (
              <Search color={palette.text} size={18} />
            )}
          </Pressable>
        </View>

        {/* Search */}
        {showSearch && (
          <Input
            placeholder="Search dish, stall, or taste tag…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        )}

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <Chip
              key={opt.id}
              label={opt.label}
              selected={filterMode === opt.id}
              onPress={() => setFilterMode(opt.id)}
            />
          ))}
        </ScrollView>

        {/* Community badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            backgroundColor: palette.successSoft,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: radii.md,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: palette.success,
            }}
          />
          <AppText variant="micro" style={{ color: palette.success, fontWeight: "700" }}>
            100% user-generated reviews — no paid content
          </AppText>
        </View>
      </View>

      {/* Review feed */}
      <FlatList
        data={filteredReviews}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: spacing[3],
          paddingBottom: spacing[20],
        }}
        ListEmptyComponent={
          <EmptyState
            title="No reviews yet"
            body={searchQuery ? "Try a different search term." : "Be the first to review a dish!"}
          />
        }
      />
    </SafeAreaView>
  );
}
