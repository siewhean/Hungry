import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useEffect, useState, useRef, useMemo } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";

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
  StickyBottomBar,
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
import { openTrustedDeliveryUrl } from "@/lib/security/safeLinking";
import { useCartStore } from "@/store/useCartStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";

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
  const addItemToCart = useCartStore((state) => state.addItem);
  const setActiveOrder = useOrderStore((state) => state.setActiveOrder);
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
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
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const distanceLabel = leadDish
    ? leadDish.distanceMeters > 1000
      ? `${(leadDish.distanceMeters / 1000).toFixed(1)}km away`
      : `${leadDish.distanceMeters}m away`
    : "Check Map";

  const communityReviews = deriveStallCommunityReviews(dishes);

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

  const handleOrderDelivery = () => {
    if (!requireAuthForProtectedAction("Sign in to order from this stall.")) {
      return;
    }

    const deliveryLink = venue.deliveryLinks[0];
    if (deliveryLink) {
      void openTrustedDeliveryUrl(
        deliveryLink.platform,
        deliveryLink.nativeUrl,
        deliveryLink.webUrl,
      );
      return;
    }

    if (!leadDish) {
      showToast({ message: "No menu item is available to add yet.", tone: "info" });
      return;
    }

    addItemToCart({ dishId: leadDish.id });
    setActiveOrder({
      id: `order-${Date.now()}`,
      venueId: venue.id,
      totalAmount: leadDish.price,
      status: "draft",
      createdAt: new Date().toISOString(),
    });
    showToast({ message: `${leadDish.name} added to cart.`, tone: "success" });
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
            <LinearGradient
              colors={[palette.overlay, "transparent"]}
              style={[StyleSheet.absoluteFill, { height: 100 }]}
            />
            <IconButton
              variant="floating"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              icon={<ChevronLeft color={palette.text} size={24} />}
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
              />
              <IconButton
                variant="floating"
                accessibilityLabel="Share stall"
                onPress={openShareSheet}
                icon={<Send color={palette.text} size={20} />}
              />
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[24] }}
          >
            {/* Hero image - 16:9 Ratio */}
            <View
              style={{
                width: screenWidth,
                height: screenWidth * (9 / 16),
                position: "relative",
              }}
            >
              <Animated.View style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: leadDish?.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Animated.View>
              <LinearGradient
                colors={[`${palette.bg}00`, `${palette.bg}B3`, palette.bg]}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 80,
                }}
              />
              {/* Rating Pill + Hygiene Shield - Floating */}
              <View
                style={{
                  position: "absolute",
                  bottom: -spacing[2],
                  left: profile.leftHandedMode ? spacing[4] : undefined,
                  right: profile.leftHandedMode ? undefined : spacing[4],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[2],
                }}
              >
                <View
                  style={[
                    {
                      backgroundColor: palette.amber,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[1],
                      ...shadows.floating,
                    },
                  ]}
                >
                  <Star color={palette.surface} fill={palette.surface} size={14} />
                  <AppText
                    style={{
                      color: palette.surface,
                      fontWeight: "800",
                      fontSize: 15,
                    }}
                  >
                    {(leadDish?.rating ?? 4.8).toFixed(1)}
                  </AppText>
                </View>
              </View>
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
                  {venue.unitNumber} · {distanceLabel}
                </AppText>
              </View>

              {/* Save / Tried / Add-to-List */}
              {isAuthenticated && venue && (
                <StallInteractionBar stallId={venue.id} userId={profile.id} />
              )}

              {/* Attributes */}
              <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <Card style={{ flex: 1, padding: spacing[4], gap: spacing[1] }}>
                  <AppText variant="micro" tone="secondary" style={{ letterSpacing: 0.5 }}>
                    OPERATING
                  </AppText>
                  <AppText variant="bodyLarge" style={{ fontWeight: "700" }}>
                    Open Now
                  </AppText>
                  <AppText variant="micro" tone="secondary">
                    {venue.operatingHours.split(" – ")[0]}
                  </AppText>
                </Card>
              </View>

              {/* Dishes Grid */}
              <View style={{ gap: spacing[4] }}>
                <AppText variant="h2">Signature Dishes</AppText>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[3],
                  }}
                >
                  {dishes.map((dish) => (
                    <Pressable
                      key={dish.id}
                      onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                      style={{
                        width: (screenWidth - spacing[5] * 2 - spacing[3]) / 2,
                      }}
                    >
                      <View style={{ gap: spacing[2] }}>
                        <Image
                          source={{ uri: dish.imageUrl }}
                          style={{
                            width: "100%",
                            height: 120,
                            borderRadius: radii.lg,
                          }}
                          contentFit="cover"
                        />
                        <View style={{ gap: spacing[1] }}>
                          <AppText variant="bodyBold" numberOfLines={1}>
                            {dish.name}
                          </AppText>
                          <AppText variant="price" style={{ color: palette.orange }}>
                            {dish.priceRange}
                          </AppText>
                        </View>
                      </View>
                    </Pressable>
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

          <StickyBottomBar
            actions={[
              {
                label: venue.deliveryLinks.length > 0 ? "Order delivery" : "Add to cart",
                variant: "secondary",
                onPress: handleOrderDelivery,
              },
              {
                label: "Directions",
                variant: "primary",
                icon: <MapPin color={palette.textOnPrimary} size={18} />,
                onPress: () => {
                  navigation.navigate("MapZoomedIn", { buildingId: venue.buildingId });
                },
              },
            ]}
          />

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
