/**
 * BitesCarousel — horizontal reel of BiteCards
 *
 * Appears in the Home Feed between the stories row and main vertical feed.
 * Shows 5–8 bite cards from nearby/trending stalls.
 */

import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronRight } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText } from "@/components/ui";
import { createDefaultBites, type HomeBite } from "@/features/home/bites";
import { useHungryTheme } from "@/theme";
import { BiteCard } from "./BiteCard";

// ─── Component ────────────────────────────────────────────────────────────────

interface BitesCarouselProps {
  /** Optional override for the bites data (e.g. from API) */
  bites?: HomeBite[];
  showHeader?: boolean;
}

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function BitesCarousel({ bites, showHeader = true }: BitesCarouselProps) {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation<RootNavigation>();
  const { width: screenWidth } = useWindowDimensions();
  const [likedBites, setLikedBites] = useState<Record<string, boolean>>({});
  const fallbackBites = useMemo(() => createDefaultBites(), []);
  const biteData = bites?.length ? bites : fallbackBites;
  const horizontalInset = 0;
  const cardWidth = Math.max(300, screenWidth - spacing[4] * 2);
  const snapInterval = cardWidth + spacing[3];

  const renderBite = useCallback(
    ({ item }: { item: HomeBite }) => (
      <BiteCard
        bite={item}
        width={cardWidth}
        liked={Boolean(likedBites[item.id])}
        onToggleLike={() =>
          setLikedBites((current) => ({ ...current, [item.id]: !current[item.id] }))
        }
        onPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
        onDishPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
        onCommentPress={() => navigation.navigate("DishDetail", { dishId: item.dishId })}
      />
    ),
    [cardWidth, likedBites, navigation],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      {showHeader ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing[2],
            paddingHorizontal: 0,
            paddingRight: 0,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing[2] }}>
            <AppText variant="micro" tone="accent" style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
              BITES
            </AppText>
            <AppText variant="h2" numberOfLines={2}>
              Dish drops from the community
            </AppText>
          </View>
          <Pressable
            onPress={() => navigation.navigate("SearchHome")}
            style={{ flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 }}
          >
            <AppText variant="bodySmall" tone="accent">
              See more
            </AppText>
            <ChevronRight size={14} color={palette.orange} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={biteData}
        keyExtractor={(item) => item.id}
        renderItem={renderBite}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToAlignment="start"
        snapToInterval={snapInterval}
        contentContainerStyle={{
          gap: spacing[3],
          paddingHorizontal: horizontalInset,
        }}
      />
    </View>
  );
}
