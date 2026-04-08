import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Bookmark, Heart, MessageCircle, PlayCircle, Plus, Send } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Card, EmptyState } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, type HomeFeedItem } from "@/features/home/feed";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

const IMAGE_HEIGHT = 430;
const ICON_SIZE = 22;

export function HomeFeedScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const profile = useProfileStore((state) => state.profile);
  const feed = getHomeFeed(profile);
  const stories = useMemo(() => feed.slice(0, 5), [feed]);
  const isCompact = screenWidth < 390;
  const socialRailWidth = isCompact ? 52 : 56;

  const navigateToStall = useCallback(
    (venueId: string) => navigation.navigate("StallDetail", { venueId }),
    [navigation],
  );

  const navigateToDish = useCallback(
    (dishId: string) => navigation.navigate("DishDetail", { dishId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: HomeFeedItem; index: number }) => {
      const leadDish = item.dishes[0];
      const reactionCount = (leadDish?.reviewCount ?? 24) + 36 + index * 4;
      const commentCount = Math.max(12, Math.round(reactionCount / 4));
      const bookmarkCount = Math.max(8, Math.round(commentCount / 2));

      return (
        <Card
          style={[
            shadows.floating,
            {
              padding: 0,
              overflow: "hidden",
              borderRadius: radii.lg,
              borderColor: palette.border,
              marginHorizontal: 0,
            },
          ]}
        >
          <Pressable onPress={() => navigateToStall(item.venueId)}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
              />

              <View style={styles.gradient} />

              <View
                style={[
                  styles.topMetaRow,
                  {
                    left: spacing[4],
                    right: spacing[4],
                    top: spacing[4],
                  },
                ]}
              >
                <View
                  style={[
                    styles.accountChip,
                    {
                      backgroundColor: "rgba(255,255,255,0.16)",
                      borderColor: "rgba(255,255,255,0.28)",
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatarRing,
                      {
                        borderColor: palette.orange,
                        height: 28,
                        width: 28,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: item.authorAvatarUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                    />
                  </View>
                  <AppText
                    variant="bodySmall"
                    tone="inverse"
                    numberOfLines={1}
                    style={styles.accountText}
                  >
                    {item.authorName}
                  </AppText>
                </View>
                <AppText variant="micro" tone="inverse" style={styles.timestamp}>
                  {item.createdAt}
                </AppText>
              </View>

              <View
                style={[
                  styles.socialRail,
                  {
                    borderRadius: radii.lg,
                    gap: spacing[2],
                    bottom: isCompact ? 18 : 20,
                    paddingVertical: spacing[3],
                    right: spacing[4],
                    width: socialRailWidth,
                  },
                ]}
              >
                <SocialAction icon={<Heart color="#FFFFFF" size={ICON_SIZE} />} count={reactionCount} />
                <SocialAction icon={<MessageCircle color="#FFFFFF" size={ICON_SIZE} />} count={commentCount} />
                <SocialAction icon={<Send color="#FFFFFF" size={ICON_SIZE} />} count={6} />
                <SocialAction icon={<Bookmark color="#FFFFFF" size={ICON_SIZE} />} count={bookmarkCount} />
              </View>

              <View
                style={[
                  styles.imageTextOverlay,
                  {
                    left: spacing[4],
                    right: spacing[4] + socialRailWidth + spacing[3],
                    bottom: spacing[4],
                    gap: spacing[2],
                  },
                ]}
              >
                {leadDish ? (
                  <AppText variant="bodySmall" style={styles.overlayEyebrow}>
                    {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
                  </AppText>
                ) : null}
                <AppText variant="h1" style={styles.overlayTitle} numberOfLines={2}>
                  {leadDish?.name ?? item.venue.name}
                </AppText>
                <AppText
                  variant="bodySmall"
                  style={styles.overlaySubtitle}
                  numberOfLines={isCompact ? 1 : 2}
                >
                  {item.caption}
                </AppText>
              </View>

              {item.mediaType === "video" ? (
                <View style={styles.playButtonContainer}>
                  <View style={styles.playButtonBackdrop}>
                    <PlayCircle color="#FFFFFF" size={54} strokeWidth={1.4} />
                  </View>
                </View>
              ) : null}
            </View>
          </Pressable>

          <View
            style={[
              styles.belowImageSection,
              {
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[4],
                gap: spacing[3],
              },
            ]}
          >
            <View style={styles.metaRow}>
              <AppText variant="bodySmall">{item.authorLocation}</AppText>
              <AppText variant="bodySmall" tone="muted">
                Best for {leadDish?.tasteTags.slice(0, 2).join(" · ") ?? "quick picks"}
              </AppText>
            </View>

            {item.dishes.length > 0 ? (
              <View style={[styles.inlineLinksRow, { gap: spacing[2] }]}>
                {item.dishes.map((dish, dishIndex) => (
                  <View key={dish.id} style={styles.inlineLinkWrap}>
                    <Pressable onPress={() => navigateToDish(dish.id)}>
                      <AppText variant="bodySmall" tone="accent" style={styles.inlineDishLink}>
                        {dish.name}
                      </AppText>
                    </Pressable>
                    {dishIndex < item.dishes.length - 1 ? (
                      <AppText variant="bodySmall" tone="muted">
                        •
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      );
    },
    [
      isCompact,
      navigateToDish,
      navigateToStall,
      palette.border,
      palette.orange,
      radii.lg,
      radii.pill,
      shadows.floating,
      socialRailWidth,
      spacing,
    ],
  );

  const listHeader = useMemo(
    () => (
      <View style={{ gap: spacing[4], paddingTop: spacing[1] }}>
        <View style={{ gap: spacing[1] }}>
          <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
            APPETITE SCROLL
          </AppText>
          <AppText variant="h1">Tonight&apos;s food stories</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Browse what stalls are pushing out right now, then jump straight into the dish.
          </AppText>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[3] }}
        >
          {stories.map((story) => (
            <Pressable
              key={story.id}
              onPress={() => navigateToStall(story.venueId)}
              style={{ width: 78, gap: spacing[2], alignItems: "center" }}
            >
              <View
                style={[
                  styles.storyRing,
                  {
                    borderColor: palette.orange,
                    borderRadius: radii.pill,
                    padding: 3,
                  },
                ]}
              >
                <Image
                  source={{ uri: story.authorAvatarUrl }}
                  style={{ width: 58, height: 58, borderRadius: 29 }}
                  contentFit="cover"
                />
              </View>
              <AppText
                variant="micro"
                style={styles.storyLabel}
                numberOfLines={2}
              >
                {story.venue.name}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Bites section */}
        <View style={{ gap: spacing[2] }}>
          <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
            BITES · DISH MICRO-REVIEWS
          </AppText>
          <BitesCarousel />
        </View>
      </View>
    ),
    [navigateToStall, palette.orange, radii.pill, spacing, stories],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={{ flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[3] }}>
        <FlatList
          data={feed}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              title="No food stories yet"
              body="The home feed is ready, but there are no items in the current mock feed."
            />
          }
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: spacing[5],
            paddingBottom: spacing[16] + insets.bottom + 88,
          }}
          showsVerticalScrollIndicator={false}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!isAuthenticated) {
              setReturnRoute("Post");
              navigation.navigate("AuthStack", { screen: "Login" });
              return;
            }
            navigation.navigate("Post");
          }}
          style={[
            styles.fab,
            {
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              bottom: 72 + insets.bottom,
              right: spacing[5],
            },
            shadows.floating,
          ]}
        >
          <Plus color="#FFFFFF" size={20} />
          <AppText variant="bodySmall" tone="inverse" style={styles.fabLabel}>
            Post
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function keyExtractor(item: HomeFeedItem) {
  return item.id;
}

function SocialAction({
  icon,
  count,
}: {
  icon: ReactNode;
  count: number;
}) {
  return (
    <View style={styles.socialAction}>
      {icon}
      <AppText variant="micro" tone="inverse">
        {count}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: "100%",
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
    height: IMAGE_HEIGHT * 0.75,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  topMetaRow: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  accountChip: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    maxWidth: "54%",
  },
  accountText: {
    fontFamily: "Nunito_600SemiBold",
  },
  timestamp: {
    minWidth: 56,
    textAlign: "right",
  },
  flex: {
    flex: 1,
  },
  avatarRing: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  socialRail: {
    position: "absolute",
    alignItems: "center",
    backgroundColor: "rgba(17,24,39,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  socialAction: {
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  imageTextOverlay: {
    position: "absolute",
  },
  overlayTitle: {
    color: "#FFFFFF",
  },
  overlayEyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Nunito_600SemiBold",
    textTransform: "uppercase",
  },
  overlaySubtitle: {
    color: "rgba(255,255,255,0.85)",
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonBackdrop: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  belowImageSection: {},
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  inlineLinksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  inlineLinkWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  inlineDishLink: {
    fontFamily: "Nunito_600SemiBold",
  },
  storyRing: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
  },
  storyLabel: {
    textAlign: "center",
  },
  sectionEyebrow: {
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fab: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    position: "absolute",
  },
  fabLabel: {
    fontFamily: "Nunito_600SemiBold",
  },
});
