import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { ArrowLeft, Heart, MapPin, Navigation, Send, Star } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card, EmptyState, Screen } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { openTrustedDeliveryUrl } from "@/lib/security/safeLinking";
import { useCartStore } from "@/store/useCartStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import type { DeliveryLink, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetailV2">;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const HERO_HEIGHT = 240;

function formatDistance(distanceMeters?: number): string | null {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return null;
  }
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)}km away`;
  }
  return `${Math.round(distanceMeters)}m away`;
}

function formatVenueStatus(venue: VenueSummary) {
  if (!venue.isOpen) {
    return venue.closureNotice ?? "Closed now";
  }
  return venue.operatingHours;
}

export function StallDetailScreenV2({ route }: Props) {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { componentRadii, palette, spacing, radii } = useHungryTheme();

  const venueId = route.params?.venueId ?? route.params?.id ?? "";
  const venue = useMemo(() => repository.getVenueById(venueId), [venueId, repository]);
  const dishes = useMemo(() => repository.listDishesByVenue(venueId), [venueId, repository]);
  const leadDish = dishes[0];

  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const addItemToCart = useCartStore((state) => state.addItem);
  const setActiveOrder = useOrderStore((state) => state.setActiveOrder);
  const showToast = useUIStore((state) => state.showToast);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const shareReviewTarget = useMemo<ReviewShareTarget>(() => {
    return {
      reviewId: `stall-${venue?.id ?? ""}`,
      postId: venue?.id ?? "",
      title: venue?.name ?? "Stall",
      subtitle:
        `${venue?.buildingId ?? ""}${venue?.unitNumber ? ` · ${venue.unitNumber}` : ""}`.trim(),
      imageUrl: leadDish?.imageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${venue?.name ?? "this stall"} at ${venue?.buildingId ?? "Hungry"}!`,
      link: `https://hungry.sg/stall/${venue?.id ?? ""}`,
    };
  }, [
    leadDish?.imageUrl,
    profile.displayName,
    venue?.buildingId,
    venue?.id,
    venue?.name,
    venue?.unitNumber,
  ]);

  const openShareSheet = () => {
    if (!venue) {
      return;
    }

    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  if (!venue) {
    return (
      <Screen>
        <EmptyState
          title="Stall not found"
          body="This stall could not be found. It may have moved or been removed."
          errorMessage={`Missing stall data for ID: ${route.params?.venueId || "unknown"}`}
          sendErrorContext="Stall detail"
          ctaLabel="Go back"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const isSaved = leadDish ? profile.favouriteDishIds.includes(leadDish.id) : false;
  const deliveryLinks = venue.deliveryLinks ?? [];
  const distanceLabel = formatDistance(leadDish?.distanceMeters);
  const statusLabel = formatVenueStatus(venue);
  const statusColor = venue.isOpen
    ? palette.success
    : venue.closureNotice
      ? palette.amber
      : palette.textMuted;
  const totalReviewCount = dishes.reduce((sum, dish) => sum + dish.reviewCount, 0);
  const displayRating =
    dishes.length > 0
      ? dishes.reduce((sum, dish) => sum + dish.rating, 0) / dishes.length
      : undefined;
  const reviewItems = dishes.flatMap((dish) =>
    dish.reviews.map((review) => ({
      ...review,
      dishName: dish.name,
    })),
  );
  const tasteRows = leadDish
    ? TASTE_DIMENSIONS.map((dimension) => ({
        label: dimension.label,
        value: Math.max(0, Math.min(10, leadDish.tasteVector[dimension.key])),
      }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 3)
    : [];

  const formatDeliveryPlatform = (platform: DeliveryLink["platform"]) =>
    platform === "grabfood" ? "GrabFood" : "Foodpanda";

  const handleSaveStall = () => {
    if (!leadDish) {
      showToast({ message: "No dish is available to save for this stall.", tone: "info" });
      return;
    }

    toggleFavourite(leadDish);
    showToast({
      message: isSaved ? "Removed from favourites." : "Saved top dish to favourites.",
      tone: "success",
    });
  };

  const handleAddLeadDishToCart = () => {
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

  const handleDeliveryLink = (link: DeliveryLink) => {
    void openTrustedDeliveryUrl(link.platform, link.nativeUrl, link.webUrl);
  };

  const handlePrimaryOrderAction = () => {
    const preferredLink = deliveryLinks[0];
    if (preferredLink) {
      handleDeliveryLink(preferredLink);
      return;
    }

    handleAddLeadDishToCart();
  };

  return (
    <Screen scroll={false} style={{ backgroundColor: palette.bg }}>
      {/* Hero Image */}
      <View style={{ height: HERO_HEIGHT, width: "100%", overflow: "hidden" }}>
        <Image
          source={{ uri: dishes[0]?.imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }]} />

        {/* Top Actions */}
        <View
          style={{
            position: "absolute",
            top: spacing[4],
            left: spacing[4],
            right: spacing[4],
            flexDirection: "row",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 36,
              height: 36,
              borderRadius: componentRadii.iconButton,
              backgroundColor: palette.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSaved ? "Remove top dish from favourites" : "Save top dish"}
              onPress={handleSaveStall}
              style={{
                width: 36,
                height: 36,
                borderRadius: componentRadii.iconButton,
                backgroundColor: palette.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Heart
                color={isSaved ? palette.error : palette.text}
                fill={isSaved ? palette.error : "transparent"}
                size={18}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share stall"
              style={{
                width: 36,
                height: 36,
                borderRadius: componentRadii.iconButton,
                backgroundColor: palette.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={openShareSheet}
            >
              <Send color={palette.text} size={18} />
            </Pressable>
          </View>
        </View>

        {/* Title Overlay */}
        <View
          style={{ position: "absolute", bottom: spacing[4], left: spacing[4], right: spacing[4] }}
        >
          <AppText variant="display" tone="inverse" style={{ fontSize: 24 }}>
            {venue.name}
          </AppText>
          <AppText variant="bodySmall" tone="inverse" style={{ opacity: 0.9 }}>
            {venue.buildingId.replace("hc-", "").replace("-", " ")}
          </AppText>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Info Block */}
        <View
          style={{ padding: spacing[4], flexDirection: "row", justifyContent: "space-between" }}
        >
          <View style={{ flex: 1, gap: spacing[1.5] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <MapPin size={14} color={palette.textMuted} />
              <AppText variant="bodySmall" tone="secondary">
                {[
                  venue.unitNumber,
                  venue.buildingId.replace("hc-", "").replace("-", " "),
                  distanceLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <AppText variant="bodySmallBold" style={{ color: statusColor }}>
                {statusLabel}
              </AppText>
              {displayRating !== undefined && totalReviewCount > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                  <Star size={12} color={palette.amber} fill={palette.amber} />
                  <AppText variant="bodySmallBold">{displayRating.toFixed(1)}</AppText>
                  <AppText variant="bodySmall" tone="muted">
                    ({totalReviewCount})
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>

          {venue.verificationStatus === "verified" ? (
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 40,
                  backgroundColor: palette.successSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                }}
              >
                <AppText style={{ color: palette.success, fontWeight: "900", fontSize: 16 }}>
                  V
                </AppText>
              </View>
              <AppText variant="micro" tone="muted" style={{ marginTop: 4 }}>
                Verified
              </AppText>
            </View>
          ) : null}
        </View>

        <View
          style={{ height: 1, backgroundColor: palette.border, marginHorizontal: spacing[4] }}
        />

        {/* Dishes Carousel */}
        <View style={{ marginTop: spacing[4] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingHorizontal: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Their dishes
            </AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
          >
            {dishes.map((dish) => (
              <Card key={dish.id} style={{ width: 140, padding: 0, overflow: "hidden" }}>
                <Image
                  source={{ uri: dish.imageUrl }}
                  style={{ width: "100%", height: 95, backgroundColor: palette.bgSoft }}
                  contentFit="cover"
                />
                <View style={{ padding: spacing[2] }}>
                  <AppText variant="bodySmallBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary">
                    {dish.reviewCount > 0
                      ? `${dish.rating.toFixed(1)} · ${dish.reviewCount} reviews`
                      : "No reviews yet"}
                  </AppText>
                  <AppText variant="bodySmallBold" tone="accent" style={{ marginTop: 2 }}>
                    S${dish.price.toFixed(2)}
                  </AppText>
                </View>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Delivery Row */}
        {deliveryLinks.length > 0 ? (
          <View style={{ marginTop: spacing[6], paddingHorizontal: spacing[4] }}>
            <AppText variant="bodySmallBold" style={{ marginBottom: spacing[2] }}>
              Order delivery via
            </AppText>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              {deliveryLinks.slice(0, 2).map((link) => (
                <Pressable
                  key={`${link.platform}-${link.webUrl}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Order from ${formatDeliveryPlatform(link.platform)}`}
                  onPress={() => handleDeliveryLink(link)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radii.md,
                    backgroundColor: palette.bgSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <AppText style={{ fontSize: 16 }}>
                    {link.platform === "grabfood" ? "G" : "P"}
                  </AppText>
                  <AppText variant="bodySmallBold">{formatDeliveryPlatform(link.platform)}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {tasteRows.length > 0 ? (
          <View
            style={{
              margin: spacing[4],
              padding: spacing[4],
              backgroundColor: palette.bgSoft,
              borderRadius: componentRadii.card,
            }}
          >
            <AppText variant="bodySmallBold" style={{ marginBottom: spacing[3] }}>
              Taste profile{totalReviewCount > 0 ? ` (${totalReviewCount} reviews)` : ""}
            </AppText>
            <View style={{ gap: spacing[2] }}>
              {tasteRows.map((item) => (
                <View
                  key={item.label}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
                >
                  <AppText
                    variant="micro"
                    tone="secondary"
                    style={{ width: 60, textAlign: "right" }}
                  >
                    {item.label}
                  </AppText>
                  <View
                    style={{
                      flex: 1,
                      height: 6,
                      backgroundColor: palette.border,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(item.value * 10)}%`,
                        height: "100%",
                        backgroundColor: palette.orange,
                      }}
                    />
                  </View>
                  <AppText variant="micro" tone="secondary" style={{ width: 30 }}>
                    {Math.round(item.value * 10)}%
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Reviews */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: spacing[3],
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Recent reviews
            </AppText>
          </View>
          {reviewItems.length > 0 ? (
            reviewItems.slice(0, 2).map((review) => (
              <Card key={review.id} style={{ backgroundColor: palette.bgSoft, borderWidth: 0 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[2],
                    marginBottom: spacing[1],
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: componentRadii.iconButton,
                      backgroundColor: palette.infoSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText style={{ fontSize: 14 }}>{review.authorName.slice(0, 1)}</AppText>
                  </View>
                  <AppText variant="bodySmallBold">{review.authorName}</AppText>
                  <View style={{ flexDirection: "row", gap: 1 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={10}
                        color={palette.amber}
                        fill={i <= review.rating ? palette.amber : "transparent"}
                      />
                    ))}
                  </View>
                </View>
                <AppText variant="bodySmall" style={{ lineHeight: 20 }}>
                  {review.text}
                </AppText>
                <AppText variant="micro" tone="muted" style={{ marginTop: 4 }}>
                  {new Date(review.createdAt).toLocaleDateString()} · {review.dishName}
                </AppText>
              </Card>
            ))
          ) : (
            <Card style={{ backgroundColor: palette.bgSoft, borderWidth: 0 }}>
              <AppText variant="bodySmall" tone="secondary">
                Reviews from diners will appear here once available.
              </AppText>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing[4],
          backgroundColor: palette.surface,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          flexDirection: "row",
          gap: spacing[3],
          paddingBottom: Math.max(insets.bottom, spacing[4]),
        }}
      >
        <Button
          variant="secondary"
          style={{ flex: 1, height: 52 }}
          leftIcon={<Navigation size={18} color={palette.text} />}
          label="Directions"
          onPress={() => navigation.navigate("MapZoomedIn", { buildingId: venue.buildingId })}
        />
        <Button
          variant="primary"
          style={{ flex: 2, height: 52 }}
          label={deliveryLinks.length > 0 ? "Order delivery" : "Add to cart"}
          onPress={handlePrimaryOrderAction}
        />
      </View>

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
    </Screen>
  );
}
