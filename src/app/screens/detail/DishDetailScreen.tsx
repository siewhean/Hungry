import { ActivityIndicator, Animated, View, useWindowDimensions, Pressable } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Send, Star } from "lucide-react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import {
  AppText,
  AccessibleImage,
  Badge,
  Button,
  Card,
  EmptyState,
  FeedErrorBoundary,
  InlineBanner,
  Input,
} from "@/components/ui";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { ImageCarousel } from "@/components/dish/ImageCarousel";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import {
  DetailSaveActionsCard,
  useDetailSaveActions,
} from "@/features/checklistPortfolio/DetailSaveActions";
import { CustomerPromotionCard } from "@/components/promotion/CustomerPromotionCard";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import {
  buildMapsSearchUrl,
  formatFoodCentreLocation,
  formatFullStallAddress,
} from "@/features/detail/stallLocation";
import type { DishDetail, MerchantPromotion } from "@/types/domain";

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
  const serviceProviderMode = getServiceProvider().mode;
  const deepLinkedDishId = route.params?.dishId ?? route.params?.id ?? "";
  const cachedDish = repository.getDishById(deepLinkedDishId);
  const [hydratedDish, setHydratedDish] = useState<DishDetail | undefined>();
  const [hasLoadedDishDetail, setHasLoadedDishDetail] = useState(
    serviceProviderMode === "supabase" ? false : Boolean(cachedDish),
  );
  const dish = hydratedDish ?? (serviceProviderMode === "supabase" ? undefined : cachedDish);
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const addReviewedDish = useProfileStore((state) => state.addReviewedDish);
  const removeReviewedDish = useProfileStore((state) => state.removeReviewedDish);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const stallInteraction = dish?.venueId ? stallInteractions[dish.venueId] : undefined;
  const markTried = useStallInteractionStore((state) => state.markTried);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastTrackedDishId = useRef<string | null>(null);
  const trackedPromotionEvents = useRef<Set<string>>(new Set());
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [localRepliesByReviewId, setLocalRepliesByReviewId] = useState<
    Record<string, ReviewReply[]>
  >({});
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [isTryingFood, setIsTryingFood] = useState(false);
  const [loadedReviews, setLoadedReviews] = useState<DishDetail["reviews"] | null>(null);
  const [activePromotions, setActivePromotions] = useState<MerchantPromotion[]>([]);
  const detailSaveActions = useDetailSaveActions({
    navigation,
    target: { itemType: "dish", id: dish?.id ?? deepLinkedDishId, label: dish?.name ?? "Dish" },
  });

  const cachedVenue = useMemo(
    () => (dish ? repository.getVenueById(dish.venueId) : undefined),
    [dish, repository],
  );
  const [hydratedVenue, setHydratedVenue] = useState<typeof cachedVenue>();
  const [hasLoadedVenueDetail, setHasLoadedVenueDetail] = useState(Boolean(cachedVenue));
  const venue = hydratedVenue ?? cachedVenue;
  const building = dish ? getBuildingById(dish.buildingId) : undefined;
  const foodCentreLocation = formatFoodCentreLocation(building);
  const fullStallAddress = venue ? formatFullStallAddress(venue, building) : "";
  const tasteMatch = useMemo(
    () => (dish ? getTasteSimilarityWithDish(profile, dish) : 0),
    [profile, dish],
  );
  const gallery = useMemo(() => (dish ? buildDishGallery(dish) : []), [dish]);
  const shareReviewTarget = useMemo<ReviewShareTarget>(() => {
    return {
      reviewId: `dish-${dish?.id ?? ""}`,
      postId: "",
      title: dish?.name ?? "Dish",
      subtitle: `${venue?.name ?? ""}${venue?.unitNumber ? ` · ${venue.unitNumber}` : ""}`,
      imageUrl: gallery[0] ?? dish?.imageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${dish?.name ?? "this dish"} at ${venue?.name ?? "this venue"} (${
        dish?.priceRange ?? "Price unavailable"
      }).`,
      link: `https://hungry.sg/dish/${dish?.id ?? ""}`,
    };
  }, [dish, gallery, profile.displayName, venue?.name, venue?.unitNumber]);

  const maxTasteScore = useMemo(() => {
    if (!dish) return 0;
    const scores = TASTE_DIMENSIONS.map((d) => dish.tasteVector[d.key] ?? 0);
    if (scores.length === 0) return 0;
    return Math.max(...scores);
  }, [dish]);

  useEffect(() => {
    let active = true;
    setHydratedDish(undefined);
    setHasLoadedDishDetail(serviceProviderMode === "supabase" ? false : Boolean(cachedDish));
    if (!deepLinkedDishId || (cachedDish && serviceProviderMode !== "supabase")) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getDish(deepLinkedDishId)
      .then((nextDish) => {
        if (!active) return;
        setHydratedDish(nextDish);
        setHasLoadedDishDetail(true);
      })
      .catch(() => {
        if (active) setHasLoadedDishDetail(true);
      });

    return () => {
      active = false;
    };
  }, [cachedDish, deepLinkedDishId, serviceProviderMode]);

  useEffect(() => {
    let active = true;
    setHydratedVenue(undefined);
    setHasLoadedVenueDetail(Boolean(cachedVenue));
    if (!dish?.venueId || cachedVenue) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getVenue(dish.venueId)
      .then((nextVenue) => {
        if (!active) return;
        setHydratedVenue(nextVenue);
        setHasLoadedVenueDetail(true);
      })
      .catch(() => {
        if (active) setHasLoadedVenueDetail(true);
      });

    return () => {
      active = false;
    };
  }, [cachedVenue, dish?.venueId]);

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
    void getHungryService().discovery.recordDishView(dish.id, {
      userId: isAuthenticated ? profile.id : undefined,
    });
  }, [dish, isAuthenticated, profile.id]);

  useEffect(() => {
    let active = true;
    setLoadedReviews(null);
    if (!dish) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .reviews.getReviewsForDish(dish.id)
      .then((reviews) => {
        if (active) setLoadedReviews(reviews);
      })
      .catch(() => {
        if (active) setLoadedReviews(serviceProviderMode === "mock" ? dish.reviews : []);
      });

    return () => {
      active = false;
    };
  }, [dish, serviceProviderMode]);

  useEffect(() => {
    let active = true;
    if (!dish) {
      setActivePromotions([]);
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.listActivePromotionsForTarget({ venueId: dish.venueId, dishId: dish.id })
      .then((promotions) => {
        if (active) setActivePromotions(promotions);
      })
      .catch(() => {
        if (active) setActivePromotions([]);
      });

    return () => {
      active = false;
    };
  }, [dish]);

  useEffect(() => {
    if (!dish || activePromotions.length === 0) return;
    activePromotions.forEach((promotion) => {
      const eventKey = `${dish.id}:${promotion.id}`;
      if (trackedPromotionEvents.current.has(eventKey)) return;
      trackedPromotionEvents.current.add(eventKey);
      void getHungryService().discovery.recordMerchantActionEvent({
        eventType: "promotion_impression",
        promotionId: promotion.id,
        venueId: dish.venueId,
        dishId: dish.id,
        userId: isAuthenticated ? profile.id : undefined,
      });
      void getHungryService().discovery.recordMerchantActionEvent({
        eventType: "promotion_dish_view",
        promotionId: promotion.id,
        venueId: dish.venueId,
        dishId: dish.id,
        userId: isAuthenticated ? profile.id : undefined,
      });
    });
  }, [activePromotions, dish, isAuthenticated, profile.id]);

  const openShareSheet = () => {
    if (!dish || !venue) {
      return;
    }

    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "share",
      venueId: venue.id,
      dishId: dish.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const openStallMaps = () => {
    if (!fullStallAddress) return;
    void openTrustedMapsUrl(buildMapsSearchUrl(fullStallAddress));
  };

  const isDetailLoading =
    (Boolean(deepLinkedDishId) && !dish && !hasLoadedDishDetail) ||
    (Boolean(dish?.venueId) && !venue && !hasLoadedVenueDetail);

  if (isDetailLoading) {
    return (
      <SafeAreaView
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
          flex: 1,
          justifyContent: "center",
          padding: spacing[6],
        }}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator color={palette.orange} />
        <AppText variant="bodySmall" tone="secondary" style={{ marginTop: spacing[3] }}>
          Loading dish details...
        </AppText>
      </SafeAreaView>
    );
  }

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
            body="This dish is no longer available in the current data source."
            errorMessage={`Missing dish data for ID: ${deepLinkedDishId || "unknown"}`}
            sendErrorContext="Dish detail"
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const deliveryAvailable = venue.deliveryLinks.length > 0;
  const isSaved = profile.favouriteDishIds.includes(dish.id);
  const isDishTried = profile.reviewedDishIds.includes(dish.id);
  const isVenueVisited = stallInteraction?.isTried ?? false;
  const visibleReviews = loadedReviews ?? (serviceProviderMode === "mock" ? dish.reviews : []);

  const handleTryFood = async () => {
    if (isTryingFood) return;

    if (!isAuthenticated) {
      setReturnRoute({
        name: "DishDetail",
        params: { dishId: dish.id },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    setIsTryingFood(true);
    try {
      const markResult = await markTried(profile.id, dish.venueId);

      if (markResult.isTried) {
        addReviewedDish(dish.id);
        showToast({
          message:
            markResult.pointsAwarded > 0
              ? "+5 Food Cred"
              : isVenueVisited
                ? "Marked as tried again."
                : "Marked this stall as visited.",
          tone: "success",
          duration: 3000,
        });
      } else {
        removeReviewedDish(dish.id);
        await useFoodCredStore
          .getState()
          .adjustPoints(-markResult.pointsAwarded, dish.venueId, "stall_marked_tried");

        showToast({
          message: markResult.pointsAwarded > 0 ? "-5 Food Cred" : "Food try check removed.",
          tone: "success",
          duration: 3000,
        });
      }
    } finally {
      setIsTryingFood(false);
    }
  };

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
            <ImageCarousel images={gallery} width={screenWidth} height={screenWidth * 0.75}>
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
                      borderRadius: componentRadii.button,
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
            </ImageCarousel>

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
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing[2],
                  }}
                >
                  <AppText variant="h1" style={{ fontSize: 28, flex: 1 }}>
                    {dish.name}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${dish.name}`}
                    onPress={openShareSheet}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.border,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1.5],
                    }}
                  >
                    <Send size={16} color={palette.text} />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${venue.name} stall details`}
                  onPress={() => navigation.navigate("StallDetail", { venueId: dish.venueId })}
                  hitSlop={8}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <AppText variant="bodyLarge" tone="secondary">
                    {venue.name} · {venue.unitNumber}
                  </AppText>
                </Pressable>
                {foodCentreLocation ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open maps for ${fullStallAddress}`}
                    onPress={openStallMaps}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        alignItems: "flex-start",
                        flexDirection: "row",
                        gap: spacing[1.5],
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <MapPin color={palette.orange} size={16} />
                    <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
                      {foodCentreLocation}
                    </AppText>
                  </Pressable>
                ) : null}
                <AppText variant="price" style={{ fontSize: 20, color: palette.orange }}>
                  {dish.priceRange}
                </AppText>
              </View>

              {activePromotions.length > 0 ? (
                <View style={{ gap: spacing[3] }}>
                  <AppText variant="h3">Active promotion</AppText>
                  {activePromotions.map((promotion) => (
                    <CustomerPromotionCard
                      key={promotion.id}
                      promotion={promotion}
                      ctaLabel="View stall"
                      onPress={() => {
                        void getHungryService().discovery.recordMerchantActionEvent({
                          eventType: "promotion_click",
                          promotionId: promotion.id,
                          venueId: dish.venueId,
                          dishId: dish.id,
                          userId: isAuthenticated ? profile.id : undefined,
                        });
                        navigation.navigate("StallDetail", { venueId: dish.venueId });
                      }}
                    />
                  ))}
                </View>
              ) : null}

              {FEATURE_FLAGS.collectionsEnabled ? (
                <DetailSaveActionsCard
                  title="Save this dish"
                  body="Add it to a checklist for later, or keep it in a private Hungry Portfolio."
                  onAddToChecklist={detailSaveActions.addToChecklist}
                  onAddToPortfolio={detailSaveActions.addToPortfolio}
                  isAddingToChecklist={detailSaveActions.isAddingToChecklist}
                  isAddingToPortfolio={detailSaveActions.isAddingToPortfolio}
                />
              ) : null}

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
                    title="No delivery links listed"
                    body="We do not have verified delivery links for this stall yet."
                  />
                )}
              </Card>

              {/* Reviews */}
              <View style={{ gap: spacing[4] }}>
                <AppText variant="h2">Community Reviews</AppText>
                {visibleReviews.length ? (
                  visibleReviews.map((review) => (
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
                      {review.photos.length > 0 ? (
                        <View style={{ flexDirection: "row", gap: spacing[2] }}>
                          {review.photos.slice(0, 3).map((photoUrl, index) => (
                            <AccessibleImage
                              key={`${review.id}-${photoUrl}`}
                              source={{ uri: photoUrl }}
                              style={{
                                borderRadius: radii.md,
                                height: 72,
                                width: 72,
                              }}
                              contentFit="cover"
                              accessibilityLabel={`Review photo ${index + 1} by ${
                                review.authorName
                              }`}
                            />
                          ))}
                        </View>
                      ) : null}

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
                  <EmptyState
                    title="No reviews yet"
                    body="Be the first to review this dish."
                    icon={<Star size={36} color={palette.textMuted} />}
                  />
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
                if (!isSaved) {
                  void getHungryService().discovery.recordMerchantActionEvent({
                    eventType: "save",
                    venueId: dish.venueId,
                    dishId: dish.id,
                    userId: profile.id,
                  });
                  activePromotions.forEach((promotion) => {
                    void getHungryService().discovery.recordMerchantActionEvent({
                      eventType: "promotion_save",
                      promotionId: promotion.id,
                      venueId: dish.venueId,
                      dishId: dish.id,
                      userId: profile.id,
                    });
                  });
                }
                showToast({
                  message: isSaved ? "Removed from favourites." : "Saved to favourites!",
                  tone: "success",
                });
              }}
            />
            <Button
              style={{ flex: 1 }}
              label="Tried"
              variant="secondary"
              onPress={handleTryFood}
              disabled={isTryingFood}
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

          <ReviewShareSheet
            activeReview={activeShareReview}
            innerRef={shareSheetRef}
            bottomInset={insets.bottom}
            onDismiss={() => {
              setActiveShareReview(null);
            }}
            onShared={(postId, channel) => {
              incrementShare(postId, channel);
            }}
          />
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
