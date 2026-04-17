import {
  Animated,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Star } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  FeedErrorBoundary,
  InlineBanner,
  Input,
} from "@/components/ui";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { TASTE_DIMENSIONS } from "@/constants/taste";

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">;

type ReviewReply = {
  id: string;
  reviewId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export function DishDetailScreen({ navigation, route }: Props) {
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const repository = getDataRepository();
  const deepLinkedDishId = route.params?.dishId ?? route.params?.id ?? "";
  const dish = repository.getDishById(deepLinkedDishId);
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroScrollX = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastTrackedDishId = useRef<string | null>(null);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [localRepliesByReviewId, setLocalRepliesByReviewId] = useState<
    Record<string, ReviewReply[]>
  >({});

  const venue = useMemo(
    () => (dish ? repository.getVenueById(dish.venueId) : undefined),
    [dish, repository],
  );
  const tasteMatch = useMemo(
    () => (dish ? getTasteSimilarityWithDish(profile, dish) : 0),
    [profile, dish],
  );
  const gallery = useMemo(() => (dish ? buildDishGallery(dish) : []), [dish]);

  const maxTasteScore = useMemo(() => {
    if (!dish) return 0;
    const scores = TASTE_DIMENSIONS.map((d) => dish.tasteVector[d.key] ?? 0);
    if (scores.length === 0) return 0;
    return Math.max(...scores);
  }, [dish]);

  const indicatorDotSize = 7;
  const indicatorStep = 14;
  const indicatorTrackWidth = Math.max(
    indicatorDotSize,
    indicatorDotSize + Math.max(0, gallery.length - 1) * indicatorStep,
  );

  useEffect(() => {
    if (!dish || lastTrackedDishId.current === dish.id) {
      return;
    }

    lastTrackedDishId.current = dish.id;
    trackAnalyticsEvent(
      "dish_viewed",
      {
        dish_id: dish.id,
        venue_id: dish.venueId,
        building_id: dish.buildingId,
      },
      isAuthenticated ? { userId: profile.id } : undefined,
    );
  }, [dish, isAuthenticated, profile.id]);

  if (!dish || !venue) {
    return (
      <FeedErrorBoundary
        title="Dish details unavailable"
        body="Couldn't load this dish — try again."
      >
        <SafeAreaView
          style={{ backgroundColor: palette.bg, flex: 1 }}
          edges={["top", "left", "right"]}
        >
          <EmptyState
            title="Dish not found"
            body="This dish is no longer available in the current mock dataset."
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const deliveryAvailable = venue.deliveryLinks.length > 0;
  const isSaved = profile.favouriteDishIds.includes(dish.id);

  const submitReviewReply = (reviewId: string) => {
    const draft = (replyDraftByReviewId[reviewId] ?? "").trim();
    if (!draft.length) {
      return;
    }

    const reply: ReviewReply = {
      id: `dish-review-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reviewId,
      authorName: profile.displayName,
      text: draft,
      createdAt: new Date().toISOString(),
    };

    setLocalRepliesByReviewId((prev) => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] ?? []), reply],
    }));
    setReplyDraftByReviewId((prev) => ({
      ...prev,
      [reviewId]: "",
    }));
  };

  return (
    <FeedErrorBoundary title="Dish details unavailable" body="Couldn't load this dish — try again.">
      <SafeAreaView
        style={{ backgroundColor: palette.bg, flex: 1 }}
        edges={["top", "left", "right"]}
      >
        <View style={{ flex: 1 }}>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: true,
            })}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            {/* Hero image carousel - Fixed 4:3 Aspect Ratio */}
            <View
              style={{
                width: screenWidth,
                height: screenWidth * 0.75,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                bounces={false}
                scrollEventThrottle={16}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: heroScrollX } } }], {
                  useNativeDriver: true,
                })}
                snapToInterval={screenWidth}
                snapToAlignment="start"
                style={{ width: screenWidth, height: "100%" }}
              >
                {gallery.map((uri) => (
                  <View key={uri} style={{ height: "100%", width: screenWidth }}>
                    <Animated.View
                      style={StyleSheet.absoluteFill}
                      // @ts-ignore
                      sharedTransitionTag={gallery[0] === uri ? `dish-image-${dish.id}` : undefined}
                    >
                      <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                    </Animated.View>
                  </View>
                ))}
              </Animated.ScrollView>

              {/* Gradient Overlay (requested) */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.4)"]}
                style={{
                  bottom: 0,
                  height: "100%",
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
                pointerEvents="none"
              />

              {/* Rating Pill - Floating in bottom corners of image */}
              <View
                style={{
                  position: "absolute",
                  bottom: spacing[3],
                  left: profile.leftHandedMode ? spacing[4] : undefined,
                  right: profile.leftHandedMode ? undefined : spacing[4],
                }}
              >
                <View
                  style={[
                    {
                      backgroundColor: palette.amber,
                      borderRadius: radii.pill,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    },
                    shadows.floating,
                  ]}
                >
                  <Star color={palette.white} fill={palette.white} size={14} />
                  <AppText
                    style={{
                      color: palette.white,
                      fontWeight: "800",
                      fontSize: 15,
                    }}
                  >
                    {dish.rating.toFixed(1)}
                  </AppText>
                </View>
              </View>

              {/* Page Indicators */}
              <View
                pointerEvents="none"
                style={{
                  alignItems: "center",
                  bottom: 12,
                  left: 0,
                  position: "absolute",
                  right: 0,
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: "rgba(0,0,0,0.2)",
                    borderRadius: radii.pill,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                  }}
                >
                  <View
                    style={{
                      height: indicatorDotSize,
                      position: "relative",
                      width: indicatorTrackWidth,
                    }}
                  >
                    {gallery.map((uri, index) => (
                      <View
                        key={`${uri}-${index}`}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.4)",
                          borderRadius: radii.pill,
                          height: indicatorDotSize,
                          left: index * indicatorStep,
                          position: "absolute",
                          top: 0,
                          width: indicatorDotSize,
                        }}
                      />
                    ))}
                    <Animated.View
                      style={{
                        backgroundColor: palette.white,
                        borderRadius: radii.pill,
                        height: indicatorDotSize,
                        left: 0,
                        position: "absolute",
                        top: 0,
                        transform: [
                          {
                            translateX: heroScrollX.interpolate({
                              inputRange: [0, Math.max(1, gallery.length - 1) * screenWidth],
                              outputRange: [0, Math.max(0, gallery.length - 1) * indicatorStep],
                              extrapolate: "clamp",
                            }),
                          },
                        ],
                        width: indicatorDotSize,
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View
              style={{
                gap: spacing[5],
                paddingHorizontal: spacing[3],
                paddingTop: spacing[5],
              }}
            >
              {/* Title & Trust */}
              <View style={{ gap: spacing[1] }}>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[2],
                    marginBottom: spacing[1],
                  }}
                >
                  <Badge label={`${tasteMatch}% match`} tone="orange" />
                  {dish.mustOrder && <Badge label="Must Order" tone="amber" />}
                </View>
                <AppText variant="h1" style={{ fontSize: 28 }}>
                  {dish.name}
                </AppText>
                <AppText variant="bodyLarge" tone="secondary">
                  {venue.name} · {venue.unitNumber}
                </AppText>
                <AppText variant="price" style={{ fontSize: 20, color: palette.orange }}>
                  {dish.priceRange}
                </AppText>
              </View>

              {/* Taste graph */}
              <View>
                <AppText variant="h3">Taste Profile</AppText>
                <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
                  {TASTE_DIMENSIONS.map((dimension) => {
                    const score = dish.tasteVector[dimension.key] ?? 0;
                    const isDominant = score === maxTasteScore && score > 0;
                    const progressWidth =
                      `${Math.max(0, Math.min(100, Math.round((score / 10) * 100)))}%` as const;

                    return (
                      <View key={dimension.key} style={{ gap: spacing[1] }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <AppText
                            variant="bodySmall"
                            style={{ fontWeight: isDominant ? "700" : "400" }}
                          >
                            {dimension.label}
                          </AppText>
                          <AppText variant="micro" tone="secondary">
                            {score.toFixed(1)}
                          </AppText>
                        </View>
                        <View
                          style={{
                            backgroundColor: palette.border,
                            borderRadius: radii.pill,
                            height: 8,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: isDominant ? palette.orange : palette.orangeLight,
                              borderRadius: radii.pill,
                              height: "100%",
                              width: progressWidth,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Closure notice */}
              {venue.closureNotice ? (
                <InlineBanner message={venue.closureNotice} tone="warning" />
              ) : null}

              {/* Order / delivery */}
              <Card>
                <AppText variant="h3">Order Now</AppText>
                {deliveryAvailable ? (
                  <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
                    {venue.deliveryLinks.map((link) => (
                      <DeliveryPlatformButton
                        key={link.platform}
                        link={link}
                        dishId={dish.id}
                        venueId={venue.id}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    title="Dine-in only"
                    body="This stall has no verified delivery links yet."
                  />
                )}
              </Card>

              {/* Reviews */}
              <View style={{ gap: spacing[4] }}>
                <AppText variant="h2">Community Reviews</AppText>
                {dish.reviews.length ? (
                  dish.reviews.map((review) => (
                    <Card key={review.id} style={{ gap: spacing[2] }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Star color={palette.amber} fill={palette.amber} size={12} />
                          <AppText variant="micro" style={{ fontWeight: "700" }}>
                            {review.rating}
                          </AppText>
                        </View>
                      </View>
                      <AppText variant="bodySmall" tone="secondary">
                        {review.text}
                      </AppText>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Reply to review by ${review.authorName}`}
                          onPress={() =>
                            setActiveReplyReviewId((current) =>
                              current === review.id ? null : review.id,
                            )
                          }
                        >
                          <AppText variant="micro" tone="accent">
                            Reply
                          </AppText>
                        </Pressable>
                        {(localRepliesByReviewId[review.id]?.length ?? 0) > 0 ? (
                          <AppText variant="micro" tone="muted">
                            {localRepliesByReviewId[review.id]?.length} repl
                            {(localRepliesByReviewId[review.id]?.length ?? 0) === 1 ? "y" : "ies"}
                          </AppText>
                        ) : null}
                      </View>

                      {(localRepliesByReviewId[review.id] ?? []).length > 0 ? (
                        <View
                          style={{
                            gap: spacing[2],
                            paddingLeft: spacing[3],
                            borderLeftWidth: 1,
                            borderLeftColor: palette.border,
                          }}
                        >
                          {(localRepliesByReviewId[review.id] ?? []).map((reply) => (
                            <View key={reply.id} style={{ gap: 2 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <AppText variant="micro">{reply.authorName}</AppText>
                                <AppText variant="micro" tone="muted">
                                  {formatTimeAgo(reply.createdAt)}
                                </AppText>
                              </View>
                              <AppText variant="bodySmall" tone="secondary">
                                {reply.text}
                              </AppText>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {activeReplyReviewId === review.id ? (
                        <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                          <View
                            style={{
                              backgroundColor: palette.bgSoft,
                              borderRadius: radii.md,
                              borderWidth: 1,
                              borderColor: palette.border,
                              paddingHorizontal: spacing[3],
                              paddingVertical: spacing[2],
                            }}
                          >
                            <Input
                              placeholder={`Reply to ${review.authorName}`}
                              value={replyDraftByReviewId[review.id] ?? ""}
                              onChangeText={(text) => {
                                setReplyDraftByReviewId((prev) => ({
                                  ...prev,
                                  [review.id]: text,
                                }));
                              }}
                              multiline
                            />
                          </View>
                          <Button
                            label="Post reply"
                            variant="secondary"
                            onPress={() => submitReviewReply(review.id)}
                            disabled={!(replyDraftByReviewId[review.id] ?? "").trim().length}
                          />
                        </View>
                      ) : null}
                    </Card>
                  ))
                ) : (
                  <AppText tone="secondary">No reviews yet. Be the first!</AppText>
                )}
              </View>
            </View>
          </Animated.ScrollView>

          {/* CTA Dock - Horizontally Aligned Sticky Bottom */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: palette.bg,
              paddingHorizontal: spacing[3],
              paddingTop: spacing[3],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              flexDirection: "row",
              gap: spacing[3],
              borderTopWidth: 1,
              borderTopColor: palette.border,
            }}
          >
            <Button
              style={{ flex: 2 }}
              label={isSaved ? "Saved" : "Save Favorite"}
              variant={isSaved ? "secondary" : "primary"}
              onPress={() => {
                if (!isAuthenticated) {
                  setReturnRoute({
                    name: "DishDetail",
                    params: { dishId: dish.id },
                  });
                  navigation.navigate("AuthStack", { screen: "Login" });
                  return;
                }
                toggleFavourite(dish);
                showToast({
                  message: isSaved ? "Removed from favourites." : "Saved to favourites!",
                  tone: "success",
                });
              }}
            />
            <Button
              style={{ flex: 1 }}
              label="Review"
              variant="secondary"
              onPress={() => {
                if (!isAuthenticated) {
                  setReturnRoute({
                    name: "ReviewStack",
                    params: {
                      screen: "ReviewMain",
                      params: { venueId: dish.venueId, dishId: dish.id },
                    },
                  });
                  navigation.navigate("AuthStack", { screen: "Login" });
                  return;
                }
                navigation.navigate("ReviewStack", {
                  screen: "ReviewMain",
                  params: { venueId: dish.venueId, dishId: dish.id },
                });
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
