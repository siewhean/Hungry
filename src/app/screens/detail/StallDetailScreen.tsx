import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  CircleHelp,
  Heart,
  MapPin,
  MessageCircle,
  MessageCircleMore,
  Send,
  Star,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppText,
  EmptyState,
  FeedErrorBoundary,
  Button,
  Card,
  IconButton,
  Input,
  Skeleton,
} from "@/components/ui";
import { deriveStallCommunityReviews } from "@/features/detail/detailTransforms";
import {
  hasPendingClaimForProfile,
  submitClaimFromStall,
} from "@/features/merchantClaim/submitClaimFromStall";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { PopularVisitorsSection } from "@/components/stall/PopularVisitorsSection";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import {
  CyclingGridImage,
  CYCLING_GRID_IMAGE_INTERVAL_MS,
} from "@/components/discover/CyclingGridImage";
import type { DishDetail } from "@/types/domain";

const CommentIcon = MessageCircle ?? MessageCircleMore;

function StallDetailSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Skeleton width="100%" height={screenWidth * 0.75} borderRadius={0} />
      <View style={{ padding: spacing[4], gap: spacing[6], marginTop: 20 }}>
        <View style={{ gap: spacing[1] }}>
          <Skeleton width={150} height={20} />
          <Skeleton width="70%" height={34} />
          <Skeleton width="40%" height={24} />
        </View>
        <Skeleton width="100%" height={80} borderRadius={radii.lg} />
        <View style={{ gap: spacing[4] }}>
          <Skeleton width={200} height={28} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            <Skeleton width="45%" height={160} borderRadius={radii.lg} />
            <Skeleton width="45%" height={160} borderRadius={radii.lg} />
          </View>
        </View>
      </View>
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

type ReviewReply = {
  id: string;
  reviewId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

function getStallDishCycleSlides(dish: DishDetail, dishes: DishDetail[]) {
  return [dish, ...dishes.filter((candidate) => candidate.id !== dish.id)].slice(0, 4);
}

function StallMenuDishCard({
  dish,
  dishes,
  index,
  onPress,
  width,
}: {
  dish: DishDetail;
  dishes: DishDetail[];
  index: number;
  onPress: (dish: DishDetail) => void;
  width: number;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const slides = useMemo(() => getStallDishCycleSlides(dish, dishes), [dish, dishes]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDish = slides[activeIndex] ?? dish;
  const handleActiveIndexChange = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  return (
    <Pressable onPress={() => onPress(activeDish)} style={{ width }}>
      <View style={{ gap: spacing[2] }}>
        <CyclingGridImage
          images={slides.map((slide) => slide.imageUrl)}
          cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
          startDelayMs={(index % 4) * 350}
          onActiveIndexChange={handleActiveIndexChange}
          style={{
            width: "100%",
            height: 120,
            borderRadius: componentRadii.card,
          }}
        />
        <View style={{ gap: spacing[1] }}>
          <AppText variant="bodyBold" numberOfLines={1}>
            {activeDish.name}
          </AppText>
          <AppText variant="price" style={{ color: palette.orange }}>
            {activeDish.priceRange}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export function StallDetailScreen({ navigation, route }: Props) {
  const venueId = route.params?.venueId ?? route.params?.id ?? "";
  const repository = getDataRepository();
  const [isLoading, setIsLoading] = useState(true);
  const venue = repository.getVenueById(venueId);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [venueId]);

  const building = venue ? getBuildingById(venue.buildingId) : undefined;
  const dishes = venue ? repository.listDishesByVenue(venue.id) : [];
  const leadDish = dishes[0];

  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [localRepliesByReviewId, setLocalRepliesByReviewId] = useState<
    Record<string, ReviewReply[]>
  >({});
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [isClaimPending, setIsClaimPending] = useState(() => hasPendingClaimForProfile(profile.id));
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const stallAddress = venue
    ? [
        venue.unitNumber,
        building?.name,
        building?.address,
        building?.postalCode ? `Singapore ${building.postalCode}` : undefined,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const shareReviewTarget = useMemo<ReviewShareTarget>(() => {
    return {
      reviewId: `stall-${venue?.id ?? ""}`,
      postId: venue?.id ?? "",
      title: venue?.name ?? "Stall",
      subtitle: `${building?.name ?? "Hungry"} · ${venue?.unitNumber ?? ""}`.trim(),
      imageUrl: leadDish?.imageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${venue?.name ?? "this stall"} at ${building?.name ?? "Hungry"}!`,
      link: `https://hungry.sg/stall/${venue?.id ?? ""}`,
    };
  }, [
    building?.name,
    leadDish?.imageUrl,
    profile.displayName,
    venue?.id,
    venue?.name,
    venue?.unitNumber,
  ]);

  useEffect(() => {
    setIsClaimPending(hasPendingClaimForProfile(profile.id));
  }, [profile.id]);

  const requireAuthForProtectedAction = (message: string) => {
    if (isAuthenticated) {
      return true;
    }

    setReturnRoute({
      name: "StallDetail",
      params: { venueId: venue?.id ?? venueId },
    });
    showToast({ message, tone: "warning" });
    navigation.navigate("AuthStack", { screen: "Login" });
    return false;
  };

  if (isLoading) {
    return <StallDetailSkeleton />;
  }

  if (!venue) {
    return (
      <FeedErrorBoundary
        title="Stall details unavailable"
        body="Couldn't load this dish — try again."
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: palette.bg }}
          edges={["top", "left", "right"]}
        >
          <EmptyState
            title="Stall not found"
            body="The stall you are looking for does not exist in our current directory."
            errorMessage={`Missing stall data for ID: ${venueId || "unknown"}`}
            sendErrorContext="Stall detail"
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const distanceLabel = leadDish
    ? leadDish.distanceMeters > 1000
      ? `${(leadDish.distanceMeters / 1000).toFixed(1)}km away`
      : `${leadDish.distanceMeters}m away`
    : null;
  const operatingStatusLabel = venue.isOpen ? "Open now" : (venue.closureNotice ?? "Closed now");
  const operatingHoursLabel = venue.operatingHours?.trim()
    ? venue.operatingHours.split(" – ")[0]
    : "Hours unavailable";

  const communityReviews = deriveStallCommunityReviews(dishes);
  const reviewedDishIds = profile.reviewedDishIds;
  const hasReviewedDishAtVenue = dishes.some((dish) => reviewedDishIds.includes(dish.id));
  const nextUnreviewedDish = dishes.find((dish) => !reviewedDishIds.includes(dish.id));
  const headerButtonColor = palette.surface;
  const headerButtonBorderColor = palette.border;

  const handleReviewRequiredForTried = () => {
    if (!isAuthenticated) {
      showToast({
        message: "Sign in to review this stall before marking it as visited.",
        tone: "warning",
        duration: 3000,
      });
      setReturnRoute({
        name: "StallDetail",
        params: { venueId: venue?.id ?? venueId },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    if (!venue) {
      showToast({ message: "Sign in again and try again.", tone: "warning", duration: 3000 });
      return;
    }

    const targetDishId = nextUnreviewedDish?.id ?? dishes[0]?.id;
    if (!targetDishId) {
      showToast({
        message: "No dish available for review yet. Add a dish first.",
        tone: "warning",
        duration: 3000,
      });
      return;
    }

    showToast({
      message: "Please review this stall first before marking it as visited.",
      tone: "info",
      duration: 3000,
    });
    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: venue.id, dishId: targetDishId },
    });
  };

  const submitReviewReply = (reviewId: string) => {
    if (!requireAuthForProtectedAction("Sign in to reply to this review.")) {
      return;
    }

    const draft = (replyDraftByReviewId[reviewId] ?? "").trim();
    if (!draft.length) {
      return;
    }

    const reply: ReviewReply = {
      id: `stall-review-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  const openShareSheet = () => {
    if (!venue) {
      return;
    }

    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const handleClaimThisStall = async () => {
    if (isSubmittingClaim) return;
    if (!requireAuthForProtectedAction("Sign in before claiming this stall.")) {
      return;
    }

    setIsSubmittingClaim(true);
    try {
      const result = await submitClaimFromStall({
        profileId: profile.id,
        venueId: venue.id,
        buildingId: venue.buildingId,
        displayName: profile.displayName,
        email: profile.email || undefined,
        isAuthenticated,
        service: getHungryService(),
        localSingleClaimGuardEnabled: getServiceProvider().mode !== "supabase",
        devFallbackEnabled: getServiceProvider().mode !== "supabase",
      });

      if (result.status === "needs_auth") {
        showToast({
          message: "Please sign in before claiming this stall.",
          tone: "warning",
        });
      } else if (result.status === "created") {
        setIsClaimPending(true);
        showToast({
          message: "Claim interest submitted. We will follow up with verification details.",
          tone: "success",
        });
      } else if (result.status === "already_exists") {
        setIsClaimPending(true);
        showToast({
          message: "You have already submitted a claim for a stall.",
          tone: "info",
        });
      } else {
        showToast({
          message: "Unable to submit claim right now. Please try again.",
          tone: "error",
        });
      }
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  return (
    <FeedErrorBoundary
      title="Stall details unavailable"
      body="Couldn't load this dish — try again."
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.topNav,
              {
                backgroundColor: "transparent",
                height: insets.top + 56,
                paddingTop: insets.top,
                paddingHorizontal: spacing[3],
                borderBottomWidth: 0,
                zIndex: zIndex.overlay,
              },
            ]}
          >
            <IconButton
              variant="floating"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              icon={<ChevronLeft color={palette.text} size={24} />}
              style={{ backgroundColor: headerButtonColor, borderColor: headerButtonBorderColor }}
            />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <IconButton
                variant="floating"
                accessibilityLabel={
                  profile.favouriteDishIds.includes(leadDish?.id ?? "")
                    ? "Remove from favourites"
                    : "Save to favourites"
                }
                onPress={() => {
                  if (!requireAuthForProtectedAction("Sign in to save this stall.")) {
                    return;
                  }
                  if (leadDish) {
                    toggleFavourite(leadDish);
                  }
                }}
                icon={
                  <Heart
                    color={palette.text}
                    fill={
                      profile.favouriteDishIds.includes(leadDish?.id ?? "")
                        ? palette.text
                        : "transparent"
                    }
                    size={20}
                  />
                }
                style={{
                  backgroundColor: headerButtonColor,
                  borderColor: headerButtonBorderColor,
                }}
              />
              <IconButton
                variant="floating"
                accessibilityLabel="Share stall"
                onPress={openShareSheet}
                icon={<Send color={palette.text} size={20} />}
                style={{
                  backgroundColor: headerButtonColor,
                  borderColor: headerButtonBorderColor,
                }}
              />
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
          >
            {/* Hero image */}
            <View
              style={{
                width: screenWidth,
                height: screenWidth * 0.75,
                position: "relative",
              }}
            >
              <Image
                source={{ uri: leadDish?.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            </View>

            <View
              style={{
                gap: spacing[6],
                paddingHorizontal: spacing[3],
                paddingTop: spacing[5],
              }}
            >
              {/* Header Content */}
              <View style={{ gap: spacing[1] }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[2],
                    marginBottom: spacing[1],
                  }}
                >
                  <MapPin color={palette.orange} size={14} />
                  <AppText
                    variant="micro"
                    style={{
                      color: palette.orange,
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    {building?.name ?? "Food Centre"}
                  </AppText>
                </View>
                <AppText variant="h1" style={{ fontSize: 28 }}>
                  {venue.name}
                </AppText>
                <AppText variant="bodyLarge" tone="secondary">
                  {[venue.unitNumber, distanceLabel].filter(Boolean).join(" · ")}
                </AppText>
              </View>

              {/* Save / Visited / Add-to-List */}
              {isAuthenticated && venue && (
                <StallInteractionBar
                  stallId={venue.id}
                  userId={profile.id}
                  hasReviewedDishAtVenue={hasReviewedDishAtVenue}
                  reviewPromptText="Please review a dish from this stall before marking it as visited."
                  onReviewRequired={handleReviewRequiredForTried}
                />
              )}

              {/* Attributes */}
              <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <Card style={{ flex: 1, padding: spacing[4], gap: spacing[1] }}>
                  <AppText variant="micro" tone="secondary" style={{ letterSpacing: 0.5 }}>
                    OPERATING
                  </AppText>
                  <AppText variant="bodyLarge" style={{ fontWeight: "700" }}>
                    {operatingStatusLabel}
                  </AppText>
                  <AppText variant="micro" tone="secondary">
                    {operatingHoursLabel}
                  </AppText>
                </Card>
              </View>

              {/* Address */}
              <View style={{ gap: spacing[3] }}>
                <AppText variant="h2">Address</AppText>
                <Card style={{ padding: spacing[4], gap: spacing[2] }}>
                  <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}>
                    <MapPin color={palette.orange} size={18} />
                    <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
                      {stallAddress}
                    </AppText>
                  </View>
                </Card>
              </View>

              <PopularVisitorsSection venueId={venue.id} horizontalPadding={0} />

              {/* Menu */}
              <View style={{ gap: spacing[4] }}>
                <AppText variant="h2">Menu</AppText>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[3],
                  }}
                >
                  {dishes.map((dish, index) => (
                    <StallMenuDishCard
                      key={dish.id}
                      dish={dish}
                      dishes={dishes}
                      index={index}
                      width={(screenWidth - spacing[5] * 2 - spacing[3]) / 2}
                      onPress={(activeDish) =>
                        navigation.navigate("DishDetail", { dishId: activeDish.id })
                      }
                    />
                  ))}
                </View>
              </View>

              {/* Community Reviews */}
              <View style={{ gap: spacing[4] }}>
                <AppText variant="h2">Recent Reviews</AppText>
                {communityReviews.length > 0 ? (
                  communityReviews.map((review) => (
                    <View
                      key={review.id}
                      style={{
                        paddingVertical: spacing[3],
                        borderBottomWidth: 1,
                        borderBottomColor: palette.border,
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          gap: spacing[3],
                        }}
                      >
                        <Image
                          source={{ uri: review.avatarUrl }}
                          style={{
                            borderRadius: radii.pill,
                            height: 40,
                            width: 40,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: spacing[0.5],
                            }}
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={12}
                                color={i < review.rating ? palette.amber : palette.border}
                                fill={i < review.rating ? palette.amber : "transparent"}
                              />
                            ))}
                          </View>
                        </View>
                        <AppText variant="micro" tone="muted">
                          {formatTimeAgo(review.createdAt)}
                        </AppText>
                      </View>
                      <AppText
                        variant="bodySmall"
                        tone="secondary"
                        style={{ marginTop: spacing[2] }}
                      >
                        {review.text}
                      </AppText>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: spacing[2],
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
                            marginTop: spacing[2],
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
                        <View
                          style={{
                            gap: spacing[2],
                            marginTop: spacing[2],
                            paddingLeft: spacing[3],
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
                          <Button
                            label="Post reply"
                            variant="secondary"
                            onPress={() => submitReviewReply(review.id)}
                            disabled={!(replyDraftByReviewId[review.id] ?? "").trim().length}
                          />
                        </View>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="No community reviews yet"
                    body="Write your first review for this stall."
                    icon={<CommentIcon size={36} color={palette.textMuted} />}
                  />
                )}
              </View>

              {FEATURE_FLAGS.merchantClaimCtaEnabled ? (
                <Card style={{ padding: spacing[4], gap: spacing[4] }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText variant="h3">Own this stall?</AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View verification process"
                      onPress={() => navigation.navigate("MerchantClaimExplainer")}
                    >
                      <CircleHelp color={palette.orange} size={18} />
                    </Pressable>
                  </View>
                  <Button
                    label={
                      isSubmittingClaim
                        ? "Submitting..."
                        : isClaimPending
                          ? "Claim Pending"
                          : "Claim this stall"
                    }
                    onPress={() => {
                      void handleClaimThisStall();
                    }}
                    disabled={isSubmittingClaim || isClaimPending}
                  />
                </Card>
              ) : null}
            </View>
          </ScrollView>

          <ReviewShareSheet
            activeReview={activeShareReview}
            innerRef={shareSheetRef}
            bottomInset={insets.bottom}
            onDismiss={() => {
              setActiveShareReview(null);
            }}
            onShared={(reviewId) => {
              incrementShare(reviewId);
            }}
          />
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}

const styles = StyleSheet.create({
  topNav: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
