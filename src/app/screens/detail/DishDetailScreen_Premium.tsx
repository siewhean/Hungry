import React, { useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions, Pressable, StyleSheet, Share } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Star, ChevronLeft, Share2, Heart, MessageCircle } from "lucide-react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
  FadeInUp,
} from "react-native-reanimated";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  FeedErrorBoundary,
  Screen,
  Skeleton,
} from "@/components/ui";
import { TasteRadar } from "@/components/dish/TasteRadar";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { ImageCarousel } from "@/components/dish/ImageCarousel";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

function DishDetailSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const HERO_HEIGHT = screenWidth * 1.2;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Skeleton width="100%" height={HERO_HEIGHT} borderRadius={0} />
      <View style={{ padding: spacing[4], gap: spacing[6], marginTop: -40 }}>
        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Skeleton width={100} height={24} borderRadius={radii.pill} />
            <Skeleton width={120} height={24} borderRadius={radii.pill} />
          </View>
          <Skeleton width="80%" height={42} />
          <Skeleton width="40%" height={32} />
          <Skeleton width="60%" height={24} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Skeleton width="30%" height={60} borderRadius={radii.lg} />
          <Skeleton width="30%" height={60} borderRadius={radii.lg} />
          <Skeleton width="30%" height={60} borderRadius={radii.lg} />
        </View>
        <Skeleton width="100%" height={300} borderRadius={radii.xl} />
        <View style={{ gap: spacing[2] }}>
          <Skeleton width="40%" height={24} />
          <Skeleton width="100%" height={100} />
        </View>
      </View>
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">;

export function DishDetailScreen_Premium({ navigation, route }: Props) {
  const repository = getDataRepository();
  const [isLoading, setIsLoading] = useState(true);
  const deepLinkedDishId = route.params?.dishId ?? route.params?.id ?? "";
  const dish = repository.getDishById(deepLinkedDishId);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [route.params?.dishId]);

  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);

  const { palette, spacing, radii, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const HERO_HEIGHT = screenWidth * 1.2; // Immersive height

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT - 100, HERO_HEIGHT - 40],
      [0, 1],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
      backgroundColor: palette.bg,
      paddingTop: insets.top,
      height: insets.top + 60,
    };
  });

  const heroStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolate.CLAMP);
    const translateY = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT],
      [0, HERO_HEIGHT / 2],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const venue = useMemo(
    () => (dish ? repository.getVenueById(dish.venueId) : undefined),
    [dish, repository],
  );
  const tasteMatch = useMemo(
    () => (dish ? getTasteSimilarityWithDish(profile, dish) : 0),
    [profile, dish],
  );
  const gallery = useMemo(() => (dish ? buildDishGallery(dish) : []), [dish]);
  const isSaved = profile.favouriteDishIds.includes(dish?.id ?? "");

  if (isLoading) {
    return <DishDetailSkeleton />;
  }

  if (!dish || !venue) {
    return (
      <Screen>
        <EmptyState title="Dish not found" body="We couldn't find the dish you're looking for." />
      </Screen>
    );
  }

  const canonicalDishUrl = `https://hungry.sg/dish/${dish.id}`;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* ─── STICKY HEADER ────────────────────────────────────────────────── */}
      <Animated.View style={[styles.stickyHeader, headerStyle, { zIndex: 100 }]}>
        <View style={styles.stickyHeaderContent}>
          <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
            {dish.name}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Star size={14} color={palette.amber} fill={palette.amber} />
            <AppText variant="bodySmallBold">{dish.rating.toFixed(1)}</AppText>
          </View>
        </View>
      </Animated.View>

      {/* ─── NAVIGATION OVERLAY ─────────────────────────────────────────── */}
      <View style={[styles.navOverlay, { top: insets.top, zIndex: 101 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.navBtn}>
          <ChevronLeft color={palette.text} size={24} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() =>
            Share.share({
              title: `${dish.name} · Hungry`,
              message: `Check out ${dish.name} at ${venue.name} on Hungry.\n\n${canonicalDishUrl}`,
              url: canonicalDishUrl,
            })
          }
          style={styles.navBtn}
        >
          <Share2 color={palette.text} size={20} />
        </Pressable>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* ─── HERO PARALLAX ──────────────────────────────────────────────── */}
        <Animated.View style={[styles.heroContainer, { height: HERO_HEIGHT }, heroStyle]}>
          <ImageCarousel images={gallery} width={screenWidth} height={HERO_HEIGHT} />
        </Animated.View>

        {/* ─── CONTENT ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[6], marginTop: -40 }}>
          {/* Header Info */}
          <View style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <Badge label={`${tasteMatch}% Taste Match`} tone="orange" />
              {dish.mustOrder && <Badge label="MUST ORDER" tone="amber" />}
            </View>
            <AppText variant="displayBold">{dish.name}</AppText>
            <AppText variant="h2" tone="secondary" style={{ color: palette.orange }}>
              S${dish.price.toFixed(2)}
            </AppText>
            <AppText variant="bodyLarge" tone="secondary">
              {venue.name} · {venue.unitNumber}
            </AppText>
          </View>

          {/* Quick Stats */}
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Card style={{ flex: 1, padding: spacing[3], alignItems: "center", gap: 4 }}>
              <AppText variant="micro" tone="muted">
                DISTANCE
              </AppText>
              <AppText variant="bodyBold">
                {dish.distanceMeters > 1000
                  ? `${(dish.distanceMeters / 1000).toFixed(1)}km`
                  : `${dish.distanceMeters}m`}
              </AppText>
            </Card>
            <Card style={{ flex: 1, padding: spacing[3], alignItems: "center", gap: 4 }}>
              <AppText variant="micro" tone="muted">
                REVIEWS
              </AppText>
              <AppText variant="bodyBold">{dish.reviews.length}</AppText>
            </Card>
            <Card style={{ flex: 1, padding: spacing[3], alignItems: "center", gap: 4 }}>
              <AppText variant="micro" tone="muted">
                STATUS
              </AppText>
              <AppText variant="bodyBold" tone="success">
                Open
              </AppText>
            </Card>
          </View>

          {/* Taste Radar */}
          <Animated.View entering={FadeInUp.delay(200)}>
            <Card style={styles.radarCard}>
              <AppText variant="h3" style={{ marginBottom: spacing[2] }}>
                Taste Signature
              </AppText>
              <TasteRadar tasteVector={dish.tasteVector} size={280} />
            </Card>
          </Animated.View>

          {/* Dietary & Vibes */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Dietary & Vibes</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {dish.dietaryFlags.map((flag) => (
                <Badge key={flag} label={flag} tone="orange" />
              ))}
              {dish.availabilityFlags.map((flag) => (
                <Badge key={flag} label={flag} tone="neutral" />
              ))}
            </View>
          </View>

          {/* Story / Description */}
          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">The Story</AppText>
            <AppText variant="bodyLarge" style={{ lineHeight: 28 }}>
              {/* @ts-ignore */}
              {dish.description ||
                "A signature local favorite, prepared with traditional methods and fresh ingredients. Every bite is a journey through Singapore's rich culinary heritage."}
            </AppText>
          </View>

          {/* Venue Info */}
          <Card style={{ padding: spacing[4], gap: spacing[3] }}>
            <AppText variant="h3">About the Stall</AppText>
            <View style={{ gap: spacing[2] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText tone="secondary">Hours</AppText>
                <AppText variant="bodySmall">{venue.operatingHours}</AppText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText tone="secondary">Unit</AppText>
                <AppText variant="bodySmall">{venue.unitNumber}</AppText>
              </View>
            </View>
            <Button
              label="View Full Stall"
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
            />
          </Card>
        </View>
      </Animated.ScrollView>

      {/* ─── ACTION DOCK ────────────────────────────────────────────────── */}
      <View style={[styles.actionDock, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
        <Button
          variant={isSaved ? "secondary" : "primary"}
          label={isSaved ? "Saved to Favourites" : "Save Favorite"}
          style={{ flex: 2 }}
          onPress={() => {
            if (!isAuthenticated) {
              setReturnRoute({ name: "DishDetail", params: { dishId: dish.id } });
              navigation.navigate("AuthStack", { screen: "Login" });
              return;
            }
            toggleFavourite(dish);
            showToast({
              message: isSaved ? "Removed from favourites." : "Added to favourites!",
              tone: "success",
            });
          }}
          leftIcon={
            <Heart
              size={20}
              color={isSaved ? palette.orange : palette.white}
              fill={isSaved ? palette.orange : "transparent"}
            />
          }
        />
        <View style={{ flex: 2, flexDirection: "row", gap: spacing[2] }}>
          <Button
            variant="glass"
            label="Rate"
            style={{ flex: 1 }}
            onPress={() =>
              useUIStore.getState().showQuickReview({
                venueId: venue.id,
                venueName: venue.name,
                dishId: dish.id,
                dishName: dish.name,
              })
            }
            leftIcon={<Star size={18} color={palette.text} />}
          />
          <Button
            variant="glass"
            label="Post"
            style={{ flex: 1 }}
            onPress={() =>
              navigation.navigate("ReviewStack", {
                screen: "ReviewMain",
                params: { dishId: dish.id, venueId: dish.venueId },
              })
            }
            leftIcon={<MessageCircle size={18} color={palette.text} />}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  stickyHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 60, // Ensure title doesn't hit the back button area
    paddingRight: 16,
    height: 60,
    gap: 12,
  },
  navOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    height: 60,
    alignItems: "center",
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  heroContainer: {
    width: "100%",
    overflow: "hidden",
  },
  radarCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#FFF9F3",
    borderColor: "#F8EFE4",
  },
  actionDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
});
