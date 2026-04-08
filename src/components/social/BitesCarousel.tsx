/**
 * BitesCarousel — horizontal reel of BiteCards
 *
 * Appears in the Home Feed between the stories row and main vertical feed.
 * Shows 5–8 bite cards from nearby/trending stalls.
 */

import { useCallback } from "react";
import { FlatList, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppText } from "@/components/ui";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { BiteCard, type Bite } from "./BiteCard";

// ─── Mock data ────────────────────────────────────────────────────────────────
// dish IDs and venue IDs match src/lib/services/mock/data.ts

const MOCK_BITES: Bite[] = [
  {
    id: "bite-1",
    dishId: "dish-char-kway-teow",
    venueId: "venue-old-airport-char-kway-teow",
    dishName: "Char Kway Teow",
    dishImageUrl: "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400",
    venueName: "Lao Wang Char Kway Teow",
    authorName: "Wei Ming",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=11",
    caption: "Smoky wok hei, perfectly charred with big juicy cockles 🔥",
    heartCount: 284,
    commentCount: 31,
    tasteTag: "🌶️ Spicy",
    createdAt: "2h ago",
  },
  {
    id: "bite-2",
    dishId: "dish-chicken-rice",
    venueId: "venue-tian-tian",
    dishName: "Chicken Rice",
    dishImageUrl: "https://images.unsplash.com/photo-1605098702935-b61af3b4ff3d?w=400",
    venueName: "Tian Tian Hainanese",
    authorName: "Sarah L",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=5",
    caption: "Still the gold standard after 10 years. Not a drop of oil wasted.",
    heartCount: 512,
    commentCount: 68,
    tasteTag: "🧂 Savory",
    createdAt: "4h ago",
  },
  {
    id: "bite-3",
    dishId: "dish-cheng-tng",
    venueId: "venue-maxwell-cheng-tng",
    dishName: "Cheng Tng",
    dishImageUrl: "https://images.unsplash.com/photo-1575816577665-34ec38dcc41b?w=400",
    venueName: "Maxwell Cheng Tng",
    authorName: "Ahmad R",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=8",
    caption: "Light and floral. Perfect after a heavy meal.",
    heartCount: 173,
    commentCount: 22,
    tasteTag: "🍯 Sweet",
    createdAt: "6h ago",
  },
  {
    id: "bite-4",
    dishId: "dish-laksa",
    venueId: "venue-maxwell-laksa",
    dishName: "Laksa",
    dishImageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400",
    venueName: "Maxwell Laksa",
    authorName: "Emma C",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=47",
    caption: "Thick coconut broth, tons of cockles. Queue was 20min — worth it.",
    heartCount: 349,
    commentCount: 45,
    tasteTag: "🥩 Rich",
    createdAt: "8h ago",
  },
  {
    id: "bite-5",
    dishId: "dish-ban-mian",
    venueId: "venue-amoy-ban-mian",
    dishName: "Ban Mian",
    dishImageUrl: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400",
    venueName: "Amoy Street Ban Mian",
    authorName: "Uncle Tan",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=52",
    caption: "Silky handmade noodles, crispy ikan bilis, runny egg on top.",
    heartCount: 97,
    commentCount: 11,
    tasteTag: "🌿 Aromatic",
    createdAt: "10h ago",
  },
  {
    id: "bite-6",
    dishId: "dish-satay",
    venueId: "venue-satay-street",
    dishName: "Satay",
    dishImageUrl: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400",
    venueName: "Satay Street",
    authorName: "Wei Ling",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=23",
    caption: "Charcoal-grilled, juicy skewers with thick peanut sauce.",
    heartCount: 221,
    commentCount: 28,
    tasteTag: "🌶️ Spicy",
    createdAt: "12h ago",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BitesCarouselProps {
  bites?: Bite[];
  showHeader?: boolean;
}

export function BitesCarousel({ bites = MOCK_BITES, showHeader = true }: BitesCarouselProps) {
  const { spacing } = useHungryTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const renderBite = useCallback(
    ({ item }: { item: Bite }) => (
      <BiteCard
        bite={item}
        onPress={() => navigation.navigate("StallDetail", { venueId: item.venueId })}
        onDishPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
      />
    ),
    [navigation],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      {showHeader ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <AppText variant="micro" tone="accent" style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
            BITES
          </AppText>
          <AppText variant="h2">Dish drops from the community</AppText>
        </View>
      ) : null}

      <FlatList
        data={bites}
        keyExtractor={(item) => item.id}
        renderItem={renderBite}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: spacing[3],
          paddingHorizontal: spacing[4],
        }}
      />
    </View>
  );
}
