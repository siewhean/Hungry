import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Linking, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
} from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import { blendedMatchScore, TASTE_LABELS } from "@/lib/ai/tasteEngine";
import { getDataRepository } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, DishDetail, TasteVector } from "@/types/domain";

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
        paddingVertical: spacing[2],
      }}
    >
      <Sparkles size={14} color={palette.orange} />
      <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
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
) {
  return repository.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags,
      tasteValues: tasteVector,
      radius,
    },
    tasteVector,
  );
}

function getNextDistinctDish(
  candidates: DishDetail[],
  currentDishId?: string,
  currentIndex = 0,
) {
  if (!candidates.length) {
    return undefined;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  let nextIndex = (currentIndex + 1) % candidates.length;
  let guard = 0;
  while (
    guard < candidates.length &&
    candidates[nextIndex]?.id === currentDishId
  ) {
    nextIndex = (nextIndex + 1) % candidates.length;
    guard += 1;
  }

  return candidates[nextIndex];
}

export function DecideForMeResultScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { palette, spacing, radii } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const selectedDish = useDiscoveryStore((state) => state.decideForMe);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const showToast = useUIStore((state) => state.showToast);
  const [searchRadius, setSearchRadius] = useState(500);
  const [resultIndex, setResultIndex] = useState(0);
  const trackedResultKey = useRef<string | null>(null);
  const trackedNoMatchRadius = useRef<number | null>(null);

  const candidates = useMemo(
    () =>
      getCandidates(
        repository,
        profile.tasteVector,
        profile.dietaryPreferences,
        searchRadius,
      ),
    [profile.dietaryPreferences, profile.tasteVector, repository, searchRadius],
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
      const selectedIndex = candidates.findIndex(
        (dish) => dish.id === selectedDish.id,
      );
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
  const match = dish
    ? Math.round(blendedMatchScore(profile.tasteVector, dish.tasteVector) * 100)
    : 0;

  useEffect(() => {
    if (!dish) {
      if (trackedNoMatchRadius.current !== searchRadius) {
        trackAnalyticsEvent("decide_for_me_no_match", {
          radius_m: searchRadius,
        });
        trackedNoMatchRadius.current = searchRadius;
      }
      return;
    }

    trackedNoMatchRadius.current = null;
    const resultKey = `${dish.id}:${searchRadius}`;
    if (trackedResultKey.current === resultKey) {
      return;
    }
    trackedResultKey.current = resultKey;
    trackAnalyticsEvent("decide_for_me_result_shown", {
      dish_id: dish.id,
      venue_id: dish.venueId,
      building_id: dish.buildingId,
      radius_m: searchRadius,
      match_score: match,
      distance_m: dish.distanceMeters,
    });
  }, [dish, match, searchRadius]);

  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dish) {
      return;
    }

    cardAnim.setValue(0);
    Animated.spring(cardAnim, {
      damping: 14,
      mass: 0.9,
      stiffness: 140,
      toValue: 1,
      useNativeDriver: true,
    }).start();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [cardAnim, dish?.id]);

  const expandRadius = () => {
    const target = nextRadius(searchRadius);
    if (!target) {
      showToast({
        message: "Already searching the widest radius.",
        tone: "info",
      });
      return;
    }
    trackAnalyticsEvent("decide_for_me_radius_expanded", {
      from_radius_m: searchRadius,
      new_radius_m: target,
    });
    setSearchRadius(target);
  };

  if (!dish) {
    const upcomingRadius = nextRadius(searchRadius);
    return (
      <Screen
        title="Recommended for you"
        subtitle="A single dish picked for your taste profile."
      >
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
        <Button
          label="Back to Discover"
          onPress={() => navigation.navigate("SearchHome")}
        />
      </Screen>
    );
  }

  const venue = repository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);
  const tasteDims: Array<{ key: keyof TasteVector; label: string }> = [
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
        profile.tasteVector[dimension.key] - dish.tasteVector[dimension.key],
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

  const handleTryAnother = () => {
    const nextDish = getNextDistinctDish(candidates, dish.id, resultIndex);
    if (!nextDish || nextDish.id === dish.id) {
      const upcomingRadius = nextRadius(searchRadius);
      if (upcomingRadius) {
        setSearchRadius(upcomingRadius);
        showToast({
          message: `Expanded radius to ${(upcomingRadius / 1000).toFixed(1)} km.`,
          tone: "info",
        });
      } else {
        showToast({
          message: "No other matching dishes right now.",
          tone: "info",
        });
      }
      return;
    }

    const nextIndex = candidates.findIndex(
      (candidate) => candidate.id === nextDish.id,
    );
    if (nextIndex >= 0) {
      setResultIndex(nextIndex);
    }
    setDecideForMe(nextDish);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => {},
    );
  };

  return (
    <Screen
      title="Recommended for you"
      subtitle="One dish picked from your current taste profile."
    >
      <View style={{ gap: spacing[5] }}>
        <Animated.View
          style={{
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
              {
                scale: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <Card style={{ gap: spacing[4], overflow: "hidden", padding: 0 }}>
            <Image
              source={{ uri: dish.imageUrl }}
              style={{ height: 240, width: "100%" }}
              contentFit="cover"
            />
            <View style={{ gap: spacing[4], padding: spacing[4] }}>
              <AnimatedMatchBadge percent={match} />

              <View style={{ gap: spacing[1] }}>
                <AppText variant="h1">{dish.name}</AppText>
                <AppText tone="secondary">{venue?.name}</AppText>
                <AppText tone="muted">
                  {building?.name}
                  {venue ? ` · ${venue.floor} ${venue.unitNumber}` : ""}
                </AppText>
                <AppText variant="price" style={{ marginTop: spacing[1] }}>
                  S${dish.price.toFixed(2)}
                </AppText>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing[2],
                }}
              >
                <Badge
                  label={`Radius ${(searchRadius / 1000).toFixed(1)} km`}
                  tone="neutral"
                />
                {dish.tasteTags.slice(0, 3).map((tag) => (
                  <Badge key={tag} label={tag} tone="amber" />
                ))}
              </View>

              <View
                style={{
                  backgroundColor: palette.surfaceRaised,
                  borderLeftColor: palette.orange,
                  borderLeftWidth: 3,
                  borderRadius: radii.md,
                  padding: spacing[3],
                }}
              >
                <AppText
                  variant="micro"
                  style={{
                    color: palette.orange,
                    fontWeight: "700",
                    marginBottom: spacing[1],
                  }}
                >
                  WHY THIS DISH?
                </AppText>
                <AppText tone="secondary" style={{ lineHeight: 20 }}>
                  {explanation}
                </AppText>
              </View>

              <View>
                <AppText variant="h3" style={{ marginBottom: spacing[3] }}>
                  Taste dimensions
                </AppText>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[3],
                  }}
                >
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
            </View>
          </Card>
        </Animated.View>

        <Button
          label="View stall"
          onPress={() =>
            navigation.navigate("StallDetail", { venueId: dish.venueId })
          }
        />
        <Button
          label="Order now"
          variant="secondary"
          onPress={async () => {
            const link = venue?.deliveryLinks[0];
            if (link) {
              trackAnalyticsEvent("delivery_link_tapped", {
                dish_id: dish.id,
                venue_id: dish.venueId,
                platform: link.platform,
              });
              try {
                await Linking.openURL(link.nativeUrl);
              } catch {
                await Linking.openURL(link.webUrl);
              }
            }
          }}
        />
        <Button
          label="Try another dish"
          variant="ghost"
          onPress={handleTryAnother}
        />
        <Button
          label="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </View>
    </Screen>
  );
}
