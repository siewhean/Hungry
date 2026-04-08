/**
 * BitesCarousel — horizontal reel of BiteCards
 *
 * Appears in the Home Feed between the stories row and main vertical feed.
 * Shows 5–8 bite cards from nearby/trending stalls.
 */

import { useCallback } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronRight } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { BiteCard, type Bite } from "./BiteCard";

// ─── Mock data ────────────────────────────────────────────────────────────────
// In production this would come from the API / discovery store

const MOCK_BITES: Bite[] = [
  {
    id: "bite-1",
    dishId: "dish-1",
    dishName: "Char Kway Teow",
    dishImageUrl: "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400",
    venueName: "Lao Wang Char Kway Teow",
    authorName: "Wei Ming",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=11",
    caption: "Smoky wok hei, perfectly charred with big juicy cockles.",
    heartCount: 284,
    commentCount: 31,
    tasteTag: "Spicy",
    createdAt: "2h ago",
  },
  {
    id: "bite-2",
    dishId: "dish-2",
    dishName: "Chicken Rice",
    dishImageUrl: "https://images.unsplash.com/photo-1605098702935-b61af3b4ff3d?w=400",
    venueName: "Tian Tian Hainanese",
    authorName: "Sarah L",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=5",
    caption: "Still the gold standard after 10 years. Not a drop of oil wasted.",
    heartCount: 512,
    commentCount: 68,
    tasteTag: "Savory",
    createdAt: "4h ago",
  },
  {
    id: "bite-3",
    dishId: "dish-3",
    dishName: "Durian Pengat",
    dishImageUrl: "https://images.unsplash.com/photo-1575816577665-34ec38dcc41b?w=400",
    venueName: "Ah Kow Durian",
    authorName: "Ahmad R",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=8",
    caption: "D24 and Mao Shan Wang in one bowl. This is it.",
    heartCount: 173,
    commentCount: 22,
    tasteTag: "Sweet",
    createdAt: "6h ago",
  },
  {
    id: "bite-4",
    dishId: "dish-4",
    dishName: "Laksa",
    dishImageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400",
    venueName: "Marine Parade Laksa",
    authorName: "Emma C",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=47",
    caption: "Thick coconut broth, tons of cockles. Queue was 20min — worth it.",
    heartCount: 349,
    commentCount: 45,
    tasteTag: "Rich",
    createdAt: "8h ago",
  },
  {
    id: "bite-5",
    dishId: "dish-5",
    dishName: "Popiah",
    dishImageUrl: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400",
    venueName: "Kim Choo Kueh Chang",
    authorName: "Uncle Tan",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=52",
    caption: "Freshly rolled popiah, good crunch, not stingy with the filling.",
    heartCount: 97,
    commentCount: 11,
    tasteTag: "Aromatic",
    createdAt: "10h ago",
  },
  {
    id: "bite-6",
    dishId: "dish-6",
    dishName: "Oyster Omelette",
    dishImageUrl: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400",
    venueName: "Bedok 85 Fengshan",
    authorName: "Wei Ling",
    authorAvatarUrl: "https://i.pravatar.cc/64?img=23",
    caption: "Crispy edges, plump oysters. The chilli here is elite.",
    heartCount: 221,
    commentCount: 28,
    tasteTag: "Spicy",
    createdAt: "12h ago",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BitesCarouselProps {
  /** Optional override for the bites data (e.g. from API) */
  bites?: Bite[];
  showHeader?: boolean;
}

export function BitesCarousel({ bites = MOCK_BITES, showHeader = true }: BitesCarouselProps) {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation<any>();

  const renderBite = useCallback(
    ({ item }: { item: Bite }) => (
      <BiteCard
        bite={item}
        onPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
        onDishPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
      />
    ),
    [navigation],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      {showHeader ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing[4],
          }}
        >
          <View>
            <AppText variant="micro" tone="accent" style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
              BITES
            </AppText>
            <AppText variant="h2">Dish drops from the community</AppText>
          </View>
          <Pressable
            onPress={() => navigation.navigate("Post")}
            style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
          >
            <AppText variant="bodySmall" tone="accent">
              See all
            </AppText>
            <ChevronRight size={14} color={palette.orange} />
          </Pressable>
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
