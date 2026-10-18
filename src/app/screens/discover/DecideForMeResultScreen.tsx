import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Sparkles,
  ChevronLeft,
  Shuffle,
  MapPin,
  Star,
  Heart,
  Navigation,
  Share2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { AccessibleImage, AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import { buildMapsSearchUrl, formatFullStallAddress } from "@/features/detail/stallLocation";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { shareLink } from "@/features/share/messagingShare";
import { webShareUrl } from "@/constants/links";
import { blendedMatchScore, TASTE_LABELS } from "@/lib/ai/tasteEngine";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import { useCartStore } from "@/store/useCartStore";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, DishDetail, TasteVector } from "@/types/domain";
import { TASTE_DIMENSIONS } from "@/constants/taste";

function TasteMiniBar({
  label,
  userVal,
  dishVal,
  accentColor,
}: {
  label: string;
  userVal: number;
  dishVal: number;
  accentColor: string;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const diff = Math.abs(userVal - dishVal);
  const match = Math.round((1 - diff / 10) * 100);

  return (
    <View style={{ flex: 1, gap: spacing[1], minWidth: "30%" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="micro">{label}</AppText>
        <AppText variant="micro" tone="muted">
          {match}%
        </AppText>
      </View>
      <View
        style={{
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          height: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            backgroundColor: match >= 70 ? accentColor : palette.textMuted,
            borderRadius: radii.pill,
            height: "100%",
            width: `${match}%`,
          }}
        />
      </View>
    </View>
  );
}

function AnimatedMatchBadge({ percent }: { percent: number }) {
  const { palette, radii, spacing, motion } = useHungryTheme();
  const counter = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    counter.setValue(0);
    const listenerId = counter.addListener(({ value }) => {
      setDisplayValue(Math.round(value));
    });

    Animated.timing(counter, {
      toValue: percent,
      duration: motion.decideForMeCounter,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      counter.removeListener(listenerId);
    };
  }, [counter, motion.decideForMeCounter, percent]);

  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: `${palette.orange}22`,
        borderRadius: radii.pill,
        flexDirection: "row",
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[4],
      }}
    >
      <Sparkles size={16} color={palette.orange} />
      <AppText variant="h3" style={{ color: palette.orange }}>
        {displayValue}% taste match
      </AppText>
    </View>
  );
}

const RADIUS_STEPS_METERS = [500, 1000, 2000, 4000];
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function nextRadius(currentRadius: number) {
  return RADIUS_STEPS_METERS.find((value) => value > currentRadius);
}

function getCandidates(
  repository: DataRepository,
  tasteVector: TasteVector,
  dietaryFlags: DietaryFlag[],
  radius: number,
  maxDishBudget?: number,
) {
  const results = repository.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags,
      tasteValues: tasteVector,
      radius,
    },
    tasteVector,
  );
  if (maxDishBudget === undefined) {
    return results;
  }
  // Budget is a preference, not a hard rule: fall back to every match when nothing fits it.
  const withinBudget = results.filter((dish) => dish.price <= maxDishBudget);
  return withinBudget.length ? withinBudget : results;
}

function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return undefined;
  }
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m away`
    : `${(distanceMeters / 1000).toFixed(1)} km away`;
}

function getNextDistinctDish(candidates: DishDetail[], currentDishId?: string, currentIndex = 0) {
  if (!candidates.length) {
    return undefined;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  let nextIndex = (currentIndex + 1) % candidates.length;
  let guard = 0;
  while (guard < candidates.length && candidates[nextIndex]?.id === currentDishId) {
    nextIndex = (nextIndex + 1) % candidates.length;
    guard += 1;
  }

  return candidates[nextIndex];
}

export function DecideForMeResultScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const selectedDish = useDiscoveryStore((state) => state.decideForMe);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const showToast = useUIStore((state) => state.showToast);
  const addItemToCart = useCartStore((state) => state.addItem);
  const setActiveOrder = useOrderStore((state) => state.setActiveOrder);
  const [searchRadius, setSearchRadius] = useState(500);
  const [resultIndex, setResultIndex] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;

  const candidates = useMemo(
    () =>
      getCandidates(
        repository,
        profile.tasteVector,
        profile.dietaryPreferences,
        searchRadius,
        profile.maxDishBudget,
      ),
    [
      profile.dietaryPreferences,
      profile.maxDishBudget,
      profile.tasteVector,
      repository,
      searchRadius,
    ],
  );

  useEffect(() => {
    if (!candidates.length) {
      setResultIndex(0);
      if (selectedDish) {
        setDecideForMe(undefined);
      }
      return;
    }

    if (selectedDish) {
      const selectedIndex = candidates.findIndex((dish) => dish.id === selectedDish.id);
      if (selectedIndex >= 0) {
        setResultIndex(selectedIndex);
        return;
      }
    }

    setResultIndex((current) => Math.min(current, candidates.length - 1));
    const nextDish = candidates[Math.min(resultIndex, candidates.length - 1)];
    if (nextDish && nextDish.id !== selectedDish?.id) {
      setDecideForMe(nextDish);
    }
  }, [candidates, resultIndex, selectedDish, setDecideForMe]);

  const dish = candidates[resultIndex] ?? selectedDish;

  useEffect(() => {
    if (!dish) return;
    void getHungryService()
      .recommendations.recordImpression("decide", [dish.id])
      .catch(() => undefined);
  }, [dish?.id]);
  const match = dish
    ? Math.round(blendedMatchScore(profile.tasteVector, dish.tasteVector) * 100)
    : 0;

  const HERO_HEIGHT = screenWidth * 1.1;

  const heroStyle = {
    transform: [
      {
        scale: scrollY.interpolate({
          inputRange: [-100, 0],
          outputRange: [1.2, 1],
          extrapolate: "clamp",
        }),
      },
      {
        translateY: scrollY.interpolate({
          inputRange: [0, HERO_HEIGHT],
          outputRange: [0, HERO_HEIGHT / 2],
          extrapolate: "clamp",
        }),
      },
    ],
  };

  const expandRadius = () => {
    const target = nextRadius(searchRadius);
    if (!target) {
      showToast({ message: "Already searching the widest radius.", tone: "info" });
      return;
    }
    setSearchRadius(target);
  };

  const handleTryAnother = () => {
    if (dish) {
      recordTasteInteraction({
        type: "dismissed",
        surface: "decide",
        dish,
        buttonId: "try_another_pick",
      });
    }
    const nextDish = getNextDistinctDish(candidates, dish?.id, resultIndex);
    if (!nextDish || nextDish.id === dish?.id) {
      const upcomingRadius = nextRadius(searchRadius);
      if (upcomingRadius) {
        setSearchRadius(upcomingRadius);
        showToast({
          message: `Expanded radius to ${(upcomingRadius / 1000).toFixed(1)} km.`,
          tone: "info",
        });
      } else {
        showToast({ message: "No other matching dishes right now.", tone: "info" });
      }
      return;
    }

    const nextIndex = candidates.findIndex((candidate) => candidate.id === nextDish.id);
    if (nextIndex >= 0) {
      setResultIndex(nextIndex);
    }
    setDecideForMe(nextDish);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handleAddToCart = () => {
    if (!dish) {
      return;
    }

    addItemToCart({ dishId: dish.id });
    recordTasteInteraction({
      type: "food_button_click",
      surface: "decide",
      dish,
      buttonId: "add_to_cart",
    });
    setActiveOrder({
      id: `order-${Date.now()}`,
      venueId: dish.venueId,
      totalAmount: dish.price,
      status: "draft",
      createdAt: new Date().toISOString(),
    });
    showToast({
      message: `${dish.name} added to cart.`,
      tone: "success",
    });
  };

  if (!dish) {
    const upcomingRadius = nextRadius(searchRadius);
    return (
      <Screen title="Recommended for you" subtitle="No matching dish for current filters yet.">
        <EmptyState
          title="No match found"
          body={`No dish fits your current filters within ${(searchRadius / 1000).toFixed(1)} km.`}
        />
        {upcomingRadius ? (
          <Button
            label={`Expand radius to ${(upcomingRadius / 1000).toFixed(1)} km`}
            onPress={expandRadius}
          />
        ) : null}
        <Button label="Back to Discover" onPress={() => navigation.navigate("SearchHome")} />
      </Screen>
    );
  }

  const venue = repository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);
  const stallAddress = venue
    ? formatFullStallAddress(venue, {
        name: venue.buildingName ?? building?.name,
        address: venue.address,
        postalCode: venue.postalCode,
      })
    : "";
  const distanceLabel = formatDistance(dish.distanceMeters);
  const isSaved = profile.favouriteDishIds.includes(dish.id);

  const handleDirections = () => {
    if (!stallAddress) return;
    trackAnalyticsEvent("directions_opened", {
      dish_id: dish.id,
      stall_id: dish.venueId,
      source: "decide_for_me",
    });
    recordTasteInteraction({
      type: "food_button_click",
      surface: "decide",
      dish,
      buttonId: "directions",
    });
    void openTrustedMapsUrl(buildMapsSearchUrl(stallAddress));
  };

  const handleSave = () => {
    toggleFavourite(dish);
  };

  const handleShare = () => {
    void shareLink(
      {
        kind: "dish",
        id: dish.id,
        message: `${dish.name}${venue?.name ? ` at ${venue.name}` : ""}, S$${dish.price.toFixed(2)}`,
        url: webShareUrl("dish", dish.id),
      },
      "system_share",
    );
  };
  const tasteDims: { key: keyof TasteVector; label: string }[] = [
    { key: "sweet", label: "Sweet" },
    { key: "spicy", label: "Spicy" },
    { key: "sour", label: "Sour" },
    { key: "salty", label: "Salty" },
    { key: "rich", label: "Rich" },
    { key: "aromatic", label: "Aroma" },
  ];
  const sortedDims = tasteDims
    .map((dimension) => ({
      ...dimension,
      diff: Math.abs(profile.tasteVector[dimension.key] - dish.tasteVector[dimension.key]),
    }))
    .sort((left, right) => left.diff - right.diff);
  const topMatch = sortedDims[0];
  const explanation =
    match >= 80
      ? `This dish is dialled in to your taste profile — especially the ${topMatch.label.toLowerCase()}.`
      : match >= 60
        ? `A strong pick based on your ${topMatch.label.toLowerCase()} and ${sortedDims[1].label.toLowerCase()} preferences.`
        : `A nearby pick that still aligns with your strongest taste dimensions.`;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Navigation Overlay */}
      <View style={[styles.navOverlay, { top: insets.top, zIndex: 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.navBtn, { backgroundColor: palette.surfaceTranslucent }]}
        >
          <ChevronLeft color={palette.text} size={24} />
        </Pressable>
        <AppText variant="h3" style={{ flex: 1, textAlign: "center", marginRight: 40 }}>
          Recommended
        </AppText>
      </View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Parallax Hero */}
        <Animated.View style={[styles.heroContainer, { height: HERO_HEIGHT }, heroStyle]}>
          <AccessibleImage
            source={{ uri: dish.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={`${dish.name} photo`}
          />
          <LinearGradient
            colors={["transparent", palette.mediaScrimSubtle, palette.bg]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Content */}
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[6], marginTop: -40 }}>
          <AnimatedMatchBadge percent={match} />

          <View style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <Badge label={`Radius ${(searchRadius / 1000).toFixed(1)} km`} tone="neutral" />
              {dish.mustOrder && <Badge label="MUST ORDER" tone="amber" />}
            </View>
            <AppText variant="displayBold">{dish.name}</AppText>
            <AppText variant="h2" tone="secondary" style={{ color: palette.orange }}>
              S${dish.price.toFixed(2)}
            </AppText>
            <AppText variant="bodyLarge" tone="secondary">
              {venue?.name} · {venue?.unitNumber}
            </AppText>
            {distanceLabel ? (
              <AppText variant="body" tone="muted">
                {distanceLabel}
              </AppText>
            ) : null}
          </View>

          {/* Why this dish? */}
          <Card
            style={{
              backgroundColor: palette.bgSoft,
              borderLeftColor: palette.orange,
              borderLeftWidth: 4,
              padding: spacing[4],
            }}
          >
            <AppText
              variant="micro"
              style={{ color: palette.orange, fontWeight: "800", marginBottom: 4 }}
            >
              WHY THIS DISH?
            </AppText>
            <AppText variant="body" style={{ lineHeight: 22 }}>
              {explanation}
            </AppText>
          </Card>

          {/* Taste Breakdown */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Palate Match</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {tasteDims.map((dimension) => (
                <TasteMiniBar
                  key={dimension.key}
                  label={TASTE_LABELS[dimension.key]}
                  userVal={profile.tasteVector[dimension.key]}
                  dishVal={dish.tasteVector[dimension.key]}
                  accentColor={palette.orange}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Description</AppText>
            <AppText variant="body" tone="secondary" style={{ lineHeight: 24 }}>
              {dish.description ||
                "A flavorful local specialty recommended specifically for your current taste profile and proximity."}
            </AppText>
          </View>

          <View style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: "row", gap: spacing[3] }}>
              {stallAddress ? (
                <Button
                  label="Directions"
                  variant="secondary"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  leftIcon={<Navigation size={18} color={palette.text} />}
                  onPress={handleDirections}
                />
              ) : null}
              <Button
                label={isSaved ? "Saved" : "Save"}
                variant="secondary"
                fullWidth={false}
                style={{ flex: 1 }}
                accessibilityLabel={
                  isSaved ? `Remove ${dish.name} from saved` : `Save ${dish.name}`
                }
                leftIcon={
                  <Heart
                    size={18}
                    color={isSaved ? palette.orange : palette.text}
                    fill={isSaved ? palette.orange : "transparent"}
                  />
                }
                onPress={handleSave}
              />
            </View>
            <Button
              label="Share with friends"
              variant="secondary"
              leftIcon={<Share2 size={18} color={palette.text} />}
              onPress={handleShare}
            />
            <Button
              label="View Stall Details"
              variant="secondary"
              onPress={() => {
                recordTasteInteraction({
                  type: "food_button_click",
                  surface: "decide",
                  dish,
                  buttonId: "view_stall_details",
                });
                navigation.navigate("StallDetail", { venueId: dish.venueId });
              }}
            />
            <Button
              label="Try Another Pick"
              variant="ghost"
              leftIcon={<Shuffle size={18} color={palette.text} />}
              onPress={handleTryAnother}
            />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Action Dock */}
      <View
        style={[
          styles.actionDock,
          {
            backgroundColor: palette.surfaceTranslucent,
            borderTopColor: palette.inverseSurfaceBarely,
            paddingBottom: Math.max(insets.bottom, spacing[4]),
          },
        ]}
      >
        <Button label="Add to cart" style={{ flex: 1 }} onPress={handleAddToCart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroContainer: {
    width: "100%",
    overflow: "hidden",
  },
  actionDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
});
