import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  TextInput,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, Search, Mic, MapPinned, Heart, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, Screen, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useLocationStore } from "@/store/useLocationStore";
import { getHomeBitesFeed } from "@/features/home/bites";
import type { Bite } from "@/lib/services/types";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

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
const PHOTO_URLS = [
  "https://images.unsplash.com/photo-1605098702935-b61af3b4ff3d?w=800",
  "https://images.unsplash.com/photo-1541529086526-db283c563270?w=800",
  "https://images.unsplash.com/photo-1555126634-323283e090fa?w=800",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
  "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
  "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800",
  "https://images.unsplash.com/photo-1621236378699-8597fac6bb4d?w=800",
];

const MOCK_ITEMS: Bite[] = Array.from({ length: 40 }).map((_, i) => ({
  id: `bite-mock-${i}`,
  authorId: `user-${i % 8}`,
  authorName: AUTHOR_NAMES[i % 8],
  authorAvatar: `https://i.pravatar.cc/64?u=${i}`,
  dishId: `dish-${i % 8}`,
  dishName: DISH_NAMES[i % 8],
  venueId: `venue-${i % 8}`,
  venueName: "Delicious Food Stall",
  unitNumber: `#01-${10 + i}`,
  buildingId: "building-maxwell",
  buildingName: "Maxwell Food Centre",
  photoUrl: PHOTO_URLS[i % 8],
  caption: `Absolutely delicious ${DISH_NAMES[i % 8]}! A must-try local favorite. #food #singapore`,
  tasteStamp: { sweet: 1, spicy: 2, sour: 1, salty: 4, rich: 5, aromatic: 4 },
  cravingCount: Math.floor(Math.random() * 1000),
  savedCount: Math.floor(Math.random() * 200),
  rating: 4.0 + Math.random(),
  price: 3.5 + Math.random() * 10,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
}));

export function QuickBitesScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing, radii } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const currentLocation = useLocationStore((state) => state.currentLocation);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [bites, setBites] = useState<Bite[]>(MOCK_ITEMS);
  const [isLoading, setIsLoading] = useState(true);

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
              photoUrl:
                b.photoUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
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

  const filteredBites = useMemo(() => {
    const list = bites
      .filter((bite) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          !query ||
          bite.authorName.toLowerCase().includes(query) ||
          bite.caption.toLowerCase().includes(query) ||
          bite.dishName.toLowerCase().includes(query);

        const cuisine = selectedCuisine.toLowerCase();
        const matchesCuisine =
          cuisine === "all" ||
          bite.caption.toLowerCase().includes(cuisine) ||
          bite.dishName.toLowerCase().includes(cuisine);

        return matchesSearch && matchesCuisine;
      })
      .map((bite) => {
        // Assign deterministic distance for mock items
        const dist = (parseInt(bite.id.replace(/\D/g, "") || "0") % 800) + 50;
        return { ...bite, distance: dist };
      });

    return list.sort((a, b) => a.distance - b.distance);
  }, [bites, searchQuery, selectedCuisine]);

  const numColumns = 2;
  const itemWidth = screenWidth / numColumns;

  const renderBiteItem = useCallback(
    ({ item }: { item: Bite & { distance: number } }) => (
      <Pressable
        onPress={() => navigation.navigate("StallDetail", { venueId: item.venueId })}
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
        <View style={styles.searchRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: palette.surface,
                borderRadius: radii.md,
                borderColor: palette.border,
              },
            ]}
          >
            <Search color={palette.textMuted} size={18} />
            <TextInput
              placeholder="Find quick bites..."
              placeholderTextColor={palette.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.textInput, { color: palette.text }]}
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <X color={palette.textMuted} size={18} />
              </Pressable>
            ) : (
              <Mic color={palette.textMuted} size={18} />
            )}
          </View>
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
                <AppText style={{ fontSize: 48 }}>🥣</AppText>
                <View
                  style={{ alignItems: "center", gap: spacing[1], paddingHorizontal: spacing[8] }}
                >
                  <AppText variant="h3" style={{ textAlign: "center" }}>
                    No bites found nearby
                  </AppText>
                  <AppText tone="muted" style={{ textAlign: "center" }}>
                    Try changing your filters or search query.
                  </AppText>
                </View>
              </View>
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
  },
  textInput: { flex: 1, height: "100%", fontSize: 16, paddingVertical: 0 },
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
});
