import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Sparkles, ChevronLeft, Shuffle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { AccessibleImage, AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import { isUsableDiscoverImageUrl } from "@/features/discover/bites";
import { formatDiscoverPrice, getDishFallbackImageSource } from "@/features/discover/presentation";
import { blendedMatchScore, TASTE_LABELS } from "@/lib/ai/tasteEngine";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, TasteVector, VenueSummary } from "@/types/domain";
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
const DECIDE_RESULT_LIMIT = 20;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function nextRadius(currentRadius: number) {
  return RADIUS_STEPS_METERS.find((value) => value > currentRadius);
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
  const service = getHungryService();
  const serviceProviderMode = getServiceProvider().mode;
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const recommendationContextRef = useRef({
    dietaryPreferences: profile.dietaryPreferences,
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    tasteVector: profile.tasteVector,
  });
  const recommendationContext = recommendationContextRef.current;
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const showToast = useUIStore((state) => state.showToast);
  const [searchRadius, setSearchRadius] = useState(500);
  const [resultIndex, setResultIndex] = useState(0);
  const [candidates, setCandidates] = useState<DishDetail[]>([]);
  const [venue, setVenue] = useState<VenueSummary>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestRevision, setRequestRevision] = useState(0);
  const [remoteImageFailed, setRemoteImageFailed] = useState(false);
  const hasRecordedInitialPickRef = useRef(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setCandidates([]);
    setResultIndex(0);
    void service.discovery
      .searchDishes(
        {
          query: "",
          categories: [],
          dietaryFlags: recommendationContext.dietaryPreferences,
          tasteValues: recommendationContext.tasteVector,
          radius: searchRadius,
          latitude: recommendationContext.latitude,
          longitude: recommendationContext.longitude,
        },
        recommendationContext.tasteVector,
      )
      .then((results) => {
        if (!active) return;
        const nextCandidates = results.slice(0, DECIDE_RESULT_LIMIT).map((result) => result.dish);
        setCandidates(nextCandidates);
        const firstDish = nextCandidates[0];
        if (firstDish) {
          setDecideForMe(firstDish);
          if (!hasRecordedInitialPickRef.current) {
            hasRecordedInitialPickRef.current = true;
            recordTasteInteraction({
              type: "food_button_click",
              surface: "decide",
              dish: firstDish,
              buttonId: "decide_for_me",
            });
          }
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Recommendations are temporarily unavailable.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    recommendationContext,
    recordTasteInteraction,
    requestRevision,
    searchRadius,
    service,
    setDecideForMe,
  ]);

  const dish = candidates[resultIndex];

  useEffect(() => {
    setRemoteImageFailed(false);
  }, [dish?.id, dish?.imageUrl]);

  useEffect(() => {
    let active = true;
    if (!dish) {
      setVenue(undefined);
      return undefined;
    }
    void service.discovery
      .getVenue(dish.venueId)
      .then((nextVenue) => {
        if (active) setVenue(nextVenue);
      })
      .catch(() => {
        if (active) setVenue(undefined);
      });
    return () => {
      active = false;
    };
  }, [dish, service]);
  const match = dish
    ? Math.round(blendedMatchScore(recommendationContext.tasteVector, dish.tasteVector) * 100)
    : 0;
  const showSourceBackedImage =
    serviceProviderMode === "supabase" &&
    isUsableDiscoverImageUrl(dish?.imageUrl) &&
    !remoteImageFailed;
  const venueLabel = dish
    ? [venue?.name?.trim() || dish.venueName.trim(), venue?.unitNumber?.trim()]
        .filter(Boolean)
        .join(" · ")
    : "";

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

  const retrySearch = () => {
    setRequestRevision((revision) => revision + 1);
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

  if (!dish) {
    const upcomingRadius = nextRadius(searchRadius);
    return (
      <Screen title="Recommended for you" subtitle="No matching dish for current filters yet.">
        {isLoading ? (
          <View
            accessibilityLabel="Loading recommendations"
            accessibilityRole="progressbar"
            style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[8] }}
          >
            <ActivityIndicator color={palette.orange} />
            <AppText variant="body" tone="secondary">
              Finding your best nearby match…
            </AppText>
          </View>
        ) : (
          <>
            <EmptyState
              title={loadError ? "Recommendations unavailable" : "No match found"}
              body={
                loadError ??
                `No dish fits your current filters within ${(searchRadius / 1000).toFixed(1)} km.`
              }
            />
            {loadError ? (
              <Button label="Try again" onPress={retrySearch} />
            ) : upcomingRadius ? (
              <Button
                label={`Expand radius to ${(upcomingRadius / 1000).toFixed(1)} km`}
                onPress={expandRadius}
              />
            ) : null}
            <Button label="Back to Discover" onPress={() => navigation.navigate("SearchHome")} />
          </>
        )}
      </Screen>
    );
  }

  const building = findBuildingById(dish.buildingId);
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
      diff: Math.abs(
        recommendationContext.tasteVector[dimension.key] - dish.tasteVector[dimension.key],
      ),
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
          useNativeDriver: Platform.OS !== "web",
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Parallax Hero */}
        <Animated.View style={[styles.heroContainer, { height: HERO_HEIGHT }, heroStyle]}>
          <AccessibleImage
            source={
              showSourceBackedImage ? { uri: dish.imageUrl } : getDishFallbackImageSource(dish)
            }
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
            onError={showSourceBackedImage ? () => setRemoteImageFailed(true) : undefined}
            accessibilityLabel={`${dish.name}${
              showSourceBackedImage ? " photo" : " representative image"
            }`}
          />
          {!showSourceBackedImage ? (
            <View
              pointerEvents="none"
              style={{
                backgroundColor: palette.imageLabelSurface,
                borderRadius: radii.pill,
                left: spacing[4],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                position: "absolute",
                bottom: spacing[12],
              }}
            >
              <AppText variant="micro" style={{ color: palette.textOnDark, fontWeight: "900" }}>
                REPRESENTATIVE
              </AppText>
            </View>
          ) : null}
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
              {formatDiscoverPrice(dish)}
            </AppText>
            {venueLabel ? (
              <AppText variant="bodyLarge" tone="secondary">
                {venueLabel}
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
                  userVal={recommendationContext.tasteVector[dimension.key]}
                  dishVal={dish.tasteVector[dimension.key]}
                  accentColor={palette.orange}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Description</AppText>
            <AppText variant="body" tone="secondary" style={{ lineHeight: 24 }}>
              {dish.description || "No source-backed description is available for this dish yet."}
            </AppText>
          </View>

          <View style={{ gap: spacing[3] }}>
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
});
