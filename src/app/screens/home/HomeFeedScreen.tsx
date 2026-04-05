import { useCallback } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { PlayCircle, Send, Heart, MessageCircle } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { AppText, Badge, Card, Screen } from "@/components/ui";
import { getHomeFeed, type HomeFeedItem } from "@/features/home/feed";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const IMAGE_HEIGHT = 320;
const ICON_SIZE = 22;

export function HomeFeedScreen() {
  const navigation = useNavigation<any>();
  const { palette, radii, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const feed = getHomeFeed(profile);

  const navigateToStall = useCallback(
    (venueId: string) => navigation.navigate("StallDetail", { venueId }),
    [navigation],
  );

  const navigateToDish = useCallback(
    (dishId: string) => navigation.navigate("DishDetail", { dishId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: HomeFeedItem }) => (
      <Card
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: radii.lg,
          borderWidth: 0,
          marginHorizontal: 0,
        }}
      >
        {/* ---- Hero image with overlay text ---- */}
        <Pressable onPress={() => navigateToStall(item.venueId)}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.mediaUrl }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
            />

            {/* Dark gradient overlay so white text is always readable */}
            <View style={styles.gradient} />

            {/* Stall name + location overlaid bottom-left */}
            <View style={[styles.imageTextOverlay, { padding: spacing[4] }]}>
              <AppText
                variant="h1"
                style={styles.overlayTitle}
                numberOfLines={1}
              >
                {item.venue.name}
              </AppText>
              <AppText variant="bodySmall" style={styles.overlaySubtitle}>
                {item.authorLocation}
              </AppText>
            </View>

            {/* Centered play button for video posts */}
            {item.mediaType === "video" && (
              <View style={styles.playButtonContainer}>
                <View style={styles.playButtonBackdrop}>
                  <PlayCircle color="#FFFFFF" size={52} strokeWidth={1.5} />
                </View>
              </View>
            )}
          </View>
        </Pressable>

        {/* ---- Social row + caption + dish tags ---- */}
        <View
          style={[
            styles.belowImageSection,
            {
              paddingHorizontal: spacing[4],
              paddingTop: spacing[3],
              paddingBottom: spacing[4],
              gap: spacing[3],
            },
          ]}
        >
          {/* Icon row */}
          <View style={[styles.iconRow, { gap: spacing[4] }]}>
            <Pressable hitSlop={8}>
              <Heart color={palette.text} size={ICON_SIZE} />
            </Pressable>
            <Pressable hitSlop={8}>
              <MessageCircle color={palette.text} size={ICON_SIZE} />
            </Pressable>
            <Pressable hitSlop={8}>
              <Send color={palette.text} size={ICON_SIZE} />
            </Pressable>
          </View>

          {/* Caption */}
          {item.caption ? (
            <AppText numberOfLines={2}>{item.caption}</AppText>
          ) : null}

          {/* Dish badge chips */}
          {item.dishes.length > 0 && (
            <View style={[styles.badgeRow, { gap: spacing[2] }]}>
              {item.dishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => navigateToDish(dish.id)}
                >
                  <Badge label={dish.name} tone="orange" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Card>
    ),
    [palette, radii, spacing, navigateToStall, navigateToDish],
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={feed}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{
          gap: spacing[5],
          paddingBottom: spacing[8],
        }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function keyExtractor(item: HomeFeedItem) {
  return item.id;
}

const styles = StyleSheet.create({
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: SCREEN_WIDTH,
    position: "relative",
  },
  heroImage: {
    height: IMAGE_HEIGHT,
    width: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: IMAGE_HEIGHT * 0.55,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  imageTextOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTitle: {
    color: "#FFFFFF",
  },
  overlaySubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonBackdrop: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  belowImageSection: {},
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
