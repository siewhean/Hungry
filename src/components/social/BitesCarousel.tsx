/**
 * BitesCarousel — horizontal reel of BiteCards
 *
 * Appears in the Home Feed between the stories row and main vertical feed.
 * Shows 5–8 bite cards from nearby/trending stalls.
 */

import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronRight } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getHomeBitesFeed } from "@/features/home/bites";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import { BiteCard } from "./BiteCard";

// ─── Component ────────────────────────────────────────────────────────────────

interface BitesCarouselProps {
  /** Optional override for the bites data (e.g. from API) */
  bites?: Bite[];
  showHeader?: boolean;
  horizontalInset?: number;
}

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function BitesCarousel({
  bites,
  showHeader = true,
  horizontalInset = 0,
}: BitesCarouselProps) {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation<RootNavigation>();
  const { width: screenWidth } = useWindowDimensions();
  const [fallbackBites, setFallbackBites] = useState<Bite[]>([]);
  const [likedBites, setLikedBites] = useState<Record<string, boolean>>({});
  const [commentedBites, setCommentedBites] = useState<Record<string, boolean>>({});
  const biteData = bites?.length ? bites : fallbackBites;
  const cardWidth = Math.max(300, screenWidth - spacing[4] * 2);
  const snapInterval = cardWidth + spacing[3];
  const commentsEnabled = FEATURE_FLAGS.commentsEnabled;

  useEffect(() => {
    if (bites?.length) {
      return;
    }
    void getHomeBitesFeed().then((resolvedBites) => {
      setFallbackBites(resolvedBites);
    });
  }, [bites]);

  const renderBite = useCallback(
    ({ item }: { item: Bite }) => (
      <BiteCard
        bite={item}
        width={cardWidth}
        liked={Boolean(likedBites[item.id])}
        commented={commentsEnabled && Boolean(commentedBites[item.id])}
        onToggleLike={() =>
          setLikedBites((current) => ({
            ...current,
            [item.id]: !current[item.id],
          }))
        }
        onCommentPress={
          commentsEnabled
            ? () =>
                setCommentedBites((current) => ({
                  ...current,
                  [item.id]: !current[item.id],
                }))
            : undefined
        }
      />
    ),
    [cardWidth, commentedBites, commentsEnabled, likedBites],
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
            <AppText
              variant="micro"
              tone="accent"
              style={{ letterSpacing: 0.8, textTransform: "uppercase" }}
            >
              BITES
            </AppText>
            <AppText variant="h2" numberOfLines={2}>
              Dish drops from the community
            </AppText>
          </View>
          <Pressable
            onPress={() => navigation.navigate("SearchHome")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              flexShrink: 0,
            }}
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
