import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronRight,
  Compass,
  MapPinned,
  Mic,
  Search,
  Shuffle,
  Star,
  Flame,
  Home,
  Compass as CompassIcon,
  Utensils,
  Zap,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, Input, Screen, Card, Skeleton } from "@/components/ui";
import { DecideForMeCard } from "@/components/discover/DecideForMeCard";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import { toRecommendationGeoCell } from "@/lib/geo/recommendationGeoCell";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, DishDetail, SearchCategory, VenueSummary } from "@/types/domain";

const INTENT_CHIPS = [
  { id: "spicy", label: "Spicy", category: "local favourites" },
  { id: "halal", label: "Halal", category: "rice" },
  { id: "late", label: "Late night", category: "late night" },
  { id: "cheap", label: "Value", category: "noodles" },
] as const;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function DiscoverSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  return (
    <View style={{ gap: spacing[6], padding: spacing[4] }}>
      <Skeleton width="40%" height={24} />
      <Skeleton width="100%" height={56} borderRadius={radii.lg} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width={140} height={120} borderRadius={radii.lg} />
        <Skeleton width={140} height={120} borderRadius={radii.lg} />
      </View>
      <View style={{ gap: spacing[4] }}>
        <Skeleton width="60%" height={28} />
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <Skeleton width={200} height={280} borderRadius={radii.xl} />
          <Skeleton width={200} height={280} borderRadius={radii.xl} />
        </View>
      </View>
    </View>
  );
}

function SituationTile({
  label,
  sublabel,
  icon,
  color,
  onPress,
}: {
  label: string;
  sublabel: string;
  icon: ReactNode;
  color: string;
  onPress: () => void;
}) {
  const { radii, spacing, shadows } = useHungryTheme();
  return (
    <Pressable onPress={onPress} style={{ width: 140 }}>
      <Card
        style={{
          backgroundColor: color,
          height: 120,
          padding: spacing[3],
          justifyContent: "space-between",
          borderWidth: 0,
          ...shadows.floating,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radii.pill,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <View>
          <AppText variant="bodyBold" tone="inverse" numberOfLines={1}>
            {label}
          </AppText>
          <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }} numberOfLines={1}>
            {sublabel}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

export function DiscoverHomeScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows, motion, colorScheme } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for better UX transition
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const popularNearby = useDiscoveryStore((state) => state.popularNearby ?? []);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const refreshPopularNearby = useDiscoveryStore((state) => state.refreshPopularNearby);
  const cacheRecommendationSlate = useDiscoveryStore((state) => state.cacheRecommendationSlate);
  const getCachedRecommendationSlate = useDiscoveryStore(
    (state) => state.getCachedRecommendationSlate,
  );
  const pruneExpiredRecommendations = useDiscoveryStore(
    (state) => state.pruneExpiredRecommendations,
  );

  useEffect(() => {
    void refreshPopularNearby();
  }, [refreshPopularNearby]);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);

  const nearbyBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const discoverLocationLabel = manualLocation ?? nearbyBuildings[0]?.name ?? "Nearby";
  const discoverNearbyCount = nearbyBuildings.length || repository.listBuildings().length;

  const themeTints = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      bg: palette.bg,
      text: palette.text,
      cardBg: palette.surface,
      secondaryText: palette.textSecondary,
      isDark,
    };
  }, [palette, colorScheme]);

  const sortedChips = useMemo(() => {
    const baseChips = [
      { id: "dietary", label: "Dietary Needs", category: "dietary" as any },
      ...INTENT_CHIPS,
    ];
    const hour = new Date().getHours();
    const prioritizeLateNight = hour >= 22 || hour < 4;
    if (prioritizeLateNight) {
      return baseChips.sort((a, b) => (a.id === "late" ? -1 : b.id === "late" ? 1 : 0));
    }
    return baseChips;
  }, []);

  // ─── Idle Pulse Animation (Psychological Nudge) ───────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  const startPulse = useCallback(() => {
    setIsPulsing(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: motion.idlePulse,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: motion.idlePulse,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim, motion.idlePulse]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isPulsing) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      setIsPulsing(false);
    }
    idleTimerRef.current = setTimeout(() => {
      startPulse();
    }, 7000); // 7 seconds of inactivity
  }, [isPulsing, pulseAnim, startPulse]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);
  const recommendedDishes = popularNearby.slice(0, 4);
  const nearbyHawkerCentres = repository
    .listBuildings()
    .filter((b) => (b as any).type === "hawker_centre")
    .slice(0, 4)
    .map((building) => {
      const venues = repository.listVenuesByBuilding(building.id);
      const venue = venues[0];
      const topDish = venue ? repository.getDishById(venue.topDishId) : undefined;
      return venue ? { building, venue, topDish } : null;
    })
    .filter(Boolean) as {
    building: any;
    venue: VenueSummary;
    topDish: DishDetail | undefined;
  }[];

  const handleDecideForMe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const radiusMeters = 500;
    trackAnalyticsEvent("decide_for_me_triggered", {
      location_granted: locationPermission === "granted",
      radius_m: radiusMeters,
    });

    const geoCell = toRecommendationGeoCell(currentLocation.latitude, currentLocation.longitude);
    pruneExpiredRecommendations();

    const cachedDishIds = getCachedRecommendationSlate(geoCell);
    const cachedDishes = (cachedDishIds ?? [])
      .map((dishId) => repository.getDishById(dishId))
      .filter((dish): dish is DishDetail => Boolean(dish));

    let picked = repository.getDecideForMe(profile.tasteVector, {
      dietaryFlags: profile.dietaryPreferences,
      neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
      radiusMeters,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      excludeDishIds: [],
    });

    if (!picked && cachedDishes.length) {
      picked = cachedDishes[0];
    }

    if (!cachedDishes.length) {
      const liveSlate = repository
        .searchDishes(
          {
            query: "",
            categories: [],
            dietaryFlags: profile.dietaryPreferences,
            tasteValues: profile.tasteVector,
            radius: radiusMeters,
          },
          profile.tasteVector,
        )
        .slice(0, 20);

      if (liveSlate.length) {
        cacheRecommendationSlate(
          geoCell,
          liveSlate.map((dish) => dish.id),
        );
        if (!picked) {
          picked = liveSlate[0];
        }
      }
    }

    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  };

  if (isLoading) {
    return (
      <Screen style={{ backgroundColor: themeTints.bg }}>
        <DiscoverSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={{ backgroundColor: themeTints.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[6] }}
        onScroll={resetIdleTimer}
        scrollEventThrottle={16}
      >
        {/* Dynamic Location Header */}
        <View style={{ paddingTop: spacing[2] }}>
          <AppText
            variant="micro"
            style={{
              color: themeTints.isDark ? palette.white : palette.orange,
              letterSpacing: 1,
              marginBottom: 2,
              opacity: 0.8,
            }}
          >
            YOU ARE AT
          </AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText
                variant="h1"
                style={{ fontSize: 28, color: themeTints.text }}
                numberOfLines={1}
              >
                {discoverLocationLabel}
              </AppText>
              <AppText
                variant="micro"
                style={{ color: themeTints.secondaryText }}
              >{`${discoverNearbyCount} nearby`}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open map view"
              onPress={() => navigation.navigate("DiscoverMap")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[1],
                backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.1)" : palette.orangeLight,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1.5],
                borderRadius: radii.pill,
              }}
            >
              <MapPinned color={themeTints.isDark ? palette.white : palette.orange} size={14} />
              <AppText
                variant="micro"
                style={{
                  color: themeTints.isDark ? palette.white : palette.orange,
                  fontWeight: "700",
                }}
              >
                MAP
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* Search Bar Entry */}
        <View style={{}}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search dishes, stalls, or hawker centres"
            onPress={() => navigation.navigate("SearchHome")}
            style={[
              shadows.card,
              {
                backgroundColor: themeTints.cardBg,
                borderRadius: radii.lg,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing[4],
                height: 52,
                gap: spacing[3],
                borderWidth: themeTints.isDark ? 0 : 1,
                borderColor: palette.border,
              },
            ]}
          >
            <Search color={themeTints.isDark ? palette.white : palette.textMuted} size={20} />
            <AppText style={{ flex: 1, color: themeTints.secondaryText }}>
              Dishes, stalls, or hawker centres…
            </AppText>
            <Mic color={themeTints.isDark ? palette.white : palette.textMuted} size={18} />
          </Pressable>
        </View>

        {/* Intent Chips with Icons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {sortedChips.map((chip) => {
            const isActive =
              chip.id === "dietary"
                ? true
                : selectedCategories.includes(chip.category as SearchCategory);
            return (
              <Chip
                key={chip.id}
                label={chip.label}
                selected={isActive}
                onPress={() => {
                  if (chip.id === "dietary") {
                    // Navigate to profile/dietary settings or just keep active
                    navigation.navigate("UserProfile", { authorName: profile.displayName });
                  } else {
                    toggleCategory(chip.category as SearchCategory);
                  }
                }}
                leftIcon={
                  chip.id === "dietary" ? (
                    <Utensils
                      size={14}
                      color={isActive ? palette.orange : themeTints.secondaryText}
                    />
                  ) : chip.id === "spicy" ? (
                    <Flame size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
                  ) : chip.id === "halal" ? (
                    <Home size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
                  ) : chip.id === "late" ? (
                    <Compass
                      size={14}
                      color={isActive ? palette.orange : themeTints.secondaryText}
                    />
                  ) : (
                    <Utensils
                      size={14}
                      color={isActive ? palette.orange : themeTints.secondaryText}
                    />
                  )
                }
              />
            );
          })}
        </ScrollView>

        {/* Situation-based Presets (F-015) */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2">Find something for...</AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3] }}
          >
            <SituationTile
              icon={<Zap size={20} color={palette.white} />}
              label="< 15 min"
              sublabel="Quick bites"
              color={palette.statusFast}
              onPress={() => navigation.navigate("QuickBites")}
            />
            <SituationTile
              icon={<Utensils size={20} color={palette.white} />}
              label="Budget < S$8"
              sublabel="Value meals"
              color={palette.orange}
              onPress={() => navigation.navigate("SearchResults")}
            />
            <SituationTile
              icon={<CompassIcon size={20} color={palette.white} />}
              label="Late Night"
              sublabel="Midnight munchies"
              color={palette.navy}
              onPress={() => navigation.navigate("SearchResults")}
            />
          </ScrollView>
        </View>

        {/* Decide for Me — branded gradient card */}
        <DecideForMeCard />

        {/* Discovery Targets — two large tap targets */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse stalls and restaurants"
              onPress={() => navigation.navigate("SearchResults")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.08)" : palette.bgSoft,
                  borderRadius: radii.lg,
                  flex: 1,
                  padding: spacing[4],
                  minHeight: 110,
                  justifyContent: "space-between",
                  borderWidth: themeTints.isDark ? 0 : 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <AppText style={{ fontSize: 28 }}>🏪</AppText>
              <View>
                <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                  Stalls & Restaurants
                </AppText>
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  Browse nearby venues
                </AppText>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse dishes"
              onPress={() => navigation.navigate("SearchResults")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.08)" : palette.bgSoft,
                  borderRadius: radii.lg,
                  flex: 1,
                  padding: spacing[4],
                  minHeight: 110,
                  justifyContent: "space-between",
                  borderWidth: themeTints.isDark ? 0 : 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <AppText style={{ fontSize: 28 }}>🍜</AppText>
              <View>
                <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                  Dishes
                </AppText>
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  What are you craving?
                </AppText>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Proactive Selection */}
        <View style={{ gap: spacing[3] }}>
          {/* Hungry Wheel — secondary card */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open hungry wheel"
            onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
            style={[
              shadows.card,
              {
                backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.08)" : palette.navy,
                borderRadius: radii.lg,
                padding: spacing[4],
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[4],
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.pill,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Compass color={palette.white} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyBold" tone="inverse">
                Hungry Wheel
              </AppText>
              <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>
                Can&apos;t decide? Spin with friends!
              </AppText>
            </View>
            <ChevronRight color="rgba(255,255,255,0.6)" size={20} />
          </Pressable>

          {/* Daily Crave */}
          {FEATURE_FLAGS.craveEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open daily crave"
              onPress={() => navigation.navigate("Crave")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.05)" : palette.bgSoft,
                  borderRadius: radii.lg,
                  padding: spacing[4],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[4],
                  borderWidth: 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.pill,
                  backgroundColor: palette.orange,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Flame color={palette.white} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                  Daily Crave
                </AppText>
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  Swipe to build your taste profile
                </AppText>
              </View>
              <ChevronRight
                color={themeTints.isDark ? palette.white : palette.textMuted}
                size={20}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Recommended Dishes (Carousel) */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2">Trending Nearby</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all trending nearby dishes"
              onPress={() => navigation.navigate("SearchResults")}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4] }}
          >
            {recommendedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.name} at ${dish.venueName}`}
                onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                style={[
                  shadows.card,
                  {
                    backgroundColor: themeTints.cardBg,
                    borderRadius: radii.lg,
                    overflow: "hidden",
                    width: screenWidth * 0.65,
                    borderWidth: themeTints.isDark ? 0 : 1,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Image
                  source={{ uri: dish.imageUrl }}
                  style={{ height: 160, width: "100%" }}
                  contentFit="cover"
                />
                <View style={{ padding: spacing[3], gap: spacing[1] }}>
                  <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                    {dish.name}
                  </AppText>
                  <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                    {dish.venueName}
                  </AppText>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: spacing[1],
                    }}
                  >
                    <AppText variant="price" style={{ color: palette.orange }}>
                      S${dish.price.toFixed(2)}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing[1],
                      }}
                    >
                      <Star color={palette.amber} size={12} fill={palette.amber} />
                      <AppText
                        variant="micro"
                        style={{ fontWeight: "700", color: themeTints.text }}
                      >
                        {dish.rating.toFixed(1)}
                      </AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Editor's Choice Carousel */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Editor&apos;s Choice
              </AppText>
              <View
                style={{
                  backgroundColor: palette.orange,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radii.sm,
                }}
              >
                <AppText
                  variant="micro"
                  style={{ color: palette.white, fontWeight: "800", fontSize: 10 }}
                >
                  ★ CURATED
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all editor's choice dishes"
              onPress={() => navigation.navigate("SearchResults")}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4] }}
          >
            {repository
              .listBuildings()
              .flatMap((b) => repository.listVenuesByBuilding(b.id))
              .flatMap((v) => repository.listDishesByVenue(v.id))
              .filter((d) => d.mustOrder)
              .slice(0, 5)
              .map((dish) => (
                <Pressable
                  key={`ec-${dish.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Editor's choice: ${dish.name}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      width: screenWidth * 0.65,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: dish.imageUrl }}
                    style={{ height: 160, width: "100%" }}
                    contentFit="cover"
                  />
                  {/* Editor badge overlay */}
                  <View
                    style={{
                      position: "absolute",
                      top: spacing[2],
                      left: spacing[2],
                      backgroundColor: palette.orange,
                      paddingHorizontal: spacing[2],
                      paddingVertical: 3,
                      borderRadius: radii.sm,
                    }}
                  >
                    <AppText
                      variant="micro"
                      style={{ color: palette.white, fontWeight: "800", fontSize: 10 }}
                    >
                      MUST ORDER
                    </AppText>
                  </View>
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                      {dish.name}
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      {dish.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${dish.price.toFixed(2)}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {dish.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
          </ScrollView>
        </View>

        {/* Budget < S$8 Dish Carousel */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Budget &lt; S$8
              </AppText>
              <View
                style={{
                  backgroundColor: palette.success,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radii.sm,
                }}
              >
                <AppText
                  variant="micro"
                  style={{ color: palette.white, fontWeight: "800", fontSize: 10 }}
                >
                  VALUE
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all budget dishes under $8"
              onPress={() => navigation.navigate("SearchResults")}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4] }}
          >
            {repository
              .listBuildings()
              .flatMap((b) => repository.listVenuesByBuilding(b.id))
              .flatMap((v) => repository.listDishesByVenue(v.id))
              .filter((d) => d.price < 8)
              .sort((a, b) => a.price - b.price)
              .slice(0, 6)
              .map((dish) => (
                <Pressable
                  key={`budget-${dish.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Budget meal: ${dish.name} at S$${dish.price.toFixed(2)}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      width: screenWidth * 0.55,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: dish.imageUrl }}
                    style={{ height: 130, width: "100%" }}
                    contentFit="cover"
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText
                      variant="bodyBold"
                      numberOfLines={1}
                      style={{ color: themeTints.text }}
                    >
                      {dish.name}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {dish.venueName}
                    </AppText>
                    <AppText
                      variant="price"
                      style={{ color: palette.success, fontWeight: "700", marginTop: 2 }}
                    >
                      S${dish.price.toFixed(2)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
          </ScrollView>
        </View>

        {/* Late Night Makan — only visible after 10pm */}
        {new Date().getHours() >= 22 || new Date().getHours() < 4 ? (
          <View style={{ gap: spacing[3] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <AppText variant="h2" style={{ color: themeTints.text }}>
                  Late Night Makan
                </AppText>
                <View
                  style={{
                    backgroundColor: palette.navy,
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: radii.sm,
                  }}
                >
                  <AppText
                    variant="micro"
                    style={{ color: palette.white, fontWeight: "800", fontSize: 10 }}
                  >
                    🌙 NOW OPEN
                  </AppText>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all late night stalls"
                onPress={() => navigation.navigate("SearchResults")}
              >
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  SEE ALL
                </AppText>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {repository
                .listBuildings()
                .flatMap((b) => repository.listVenuesByBuilding(b.id))
                .flatMap((v) => repository.listDishesByVenue(v.id))
                .slice(0, 5)
                .map((dish) => (
                  <Pressable
                    key={`night-${dish.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Late night option: ${dish.name}`}
                    onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                    style={[
                      shadows.card,
                      {
                        backgroundColor: themeTints.isDark
                          ? "rgba(255,255,255,0.06)"
                          : palette.navy,
                        borderRadius: radii.lg,
                        overflow: "hidden",
                        width: screenWidth * 0.65,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={{ height: 150, width: "100%", opacity: 0.85 }}
                      contentFit="cover"
                    />
                    <View style={{ padding: spacing[3], gap: spacing[1] }}>
                      <AppText variant="h3" numberOfLines={1} tone="inverse">
                        {dish.name}
                      </AppText>
                      <AppText
                        variant="micro"
                        style={{ color: "rgba(255,255,255,0.7)" }}
                        numberOfLines={1}
                      >
                        {dish.venueName}
                      </AppText>
                      <AppText variant="price" style={{ color: palette.orange, fontWeight: "700" }}>
                        S${dish.price.toFixed(2)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Hawker Centres Near You (Horizontal Selection) */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2" style={{ color: themeTints.text }}>
              Nearby Stalls
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View hawker centres on map"
              onPress={() => navigation.navigate("DiscoverMap")}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                VIEW MAP
              </AppText>
            </Pressable>
          </View>
          <View style={{ gap: spacing[3] }}>
            {nearbyHawkerCentres.map(({ venue, topDish }) => (
              <Pressable
                key={venue.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${venue.name} in map zoomed view`}
                onPress={() =>
                  navigation.navigate("MapZoomedIn", {
                    buildingId: venue.buildingId,
                  })
                }
                style={[
                  shadows.card,
                  {
                    backgroundColor: themeTints.cardBg,
                    borderRadius: radii.lg,
                    padding: spacing[3],
                    flexDirection: "row",
                    gap: spacing[3],
                    alignItems: "center",
                    borderWidth: themeTints.isDark ? 0 : 1,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View
                  style={{
                    padding: 2,
                    borderRadius: radii.pill,
                    borderWidth: 2,
                    borderColor: palette.orange,
                  }}
                >
                  <Image
                    source={{ uri: topDish?.imageUrl }}
                    style={{ borderRadius: radii.pill, height: 48, width: 48 }}
                    contentFit="cover"
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText
                    variant="bodySmall"
                    style={{ fontWeight: "800", color: themeTints.text }}
                    numberOfLines={1}
                  >
                    {venue.name}
                  </AppText>
                  <AppText
                    variant="micro"
                    style={{ color: themeTints.secondaryText }}
                    numberOfLines={1}
                  >
                    {venue.unitNumber} · {venue.operatingHours.split(" – ")[0]}
                  </AppText>
                </View>
                <ChevronRight color={palette.textMuted} size={20} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
