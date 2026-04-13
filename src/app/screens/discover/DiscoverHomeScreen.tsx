import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { ChevronRight, Compass, MapPinned, Search, Shuffle, Star, Flame, Home, Compass as CompassIcon, Utensils } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, Input, Screen } from "@/components/ui";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, SearchCategory, VenueSummary } from "@/types/domain";

const INTENT_CHIPS = [
  { id: "spicy", label: "Spicy", category: "local favourites" },
  { id: "halal", label: "Halal", category: "rice" },
  { id: "late", label: "Late night", category: "late night" },
  { id: "cheap", label: "Value", category: "noodles" },
] as const;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function DiscoverHomeScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows, motion } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const { popularNearby, setDecideForMe } = useDiscoveryStore();
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);
  
  const nearbyBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const discoverLocationLabel = manualLocation ?? nearbyBuildings[0]?.name ?? "Nearby";
  const discoverNearbyCount = nearbyBuildings.length || repository.listBuildings().length;

  const themeTints = useMemo(() => {
    const hour = new Date().getHours();
    const isLateNight = hour >= 22 || hour < 4;
    return {
      bg: isLateNight ? palette.navy : palette.bg,
      text: isLateNight ? palette.white : palette.text,
      cardBg: isLateNight ? "rgba(255,255,255,0.05)" : palette.surface,
      secondaryText: isLateNight ? "rgba(255,255,255,0.6)" : palette.textSecondary,
      isLateNight,
    };
  }, [palette]);

  const sortedChips = useMemo(() => {
    if (themeTints.isLateNight) {
      return [...INTENT_CHIPS].sort((a, b) => (a.id === "late" ? -1 : b.id === "late" ? 1 : 0));
    }
    return INTENT_CHIPS;
  }, [themeTints.isLateNight]);

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
      ])
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
  const nearbyVenues = repository.listBuildings()
    .slice(0, 4)
    .map((building) => {
      const venues = repository.listVenuesByBuilding(building.id);
      const venue = venues[0];
      const topDish = venue ? repository.getDishById(venue.topDishId) : undefined;
      return venue ? { building, venue, topDish } : null;
    })
    .filter(Boolean) as Array<{
    building: any;
    venue: VenueSummary;
    topDish: DishDetail | undefined;
  }>;

  const handleDecideForMe = () => {
    const picked = repository.getDecideForMe(profile.tasteVector);
    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  };

  return (
    <Screen scroll={false} style={{ backgroundColor: themeTints.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[6], paddingBottom: spacing[24] }}
        onScroll={resetIdleTimer}
        scrollEventThrottle={16}
      >
        {/* Dynamic Location Header */}
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
          <AppText variant="micro" style={{ color: themeTints.isLateNight ? palette.white : palette.orange, letterSpacing: 1, marginBottom: 2, opacity: 0.8 }}>
            YOU ARE AT
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <AppText variant="h1" style={{ fontSize: 28, color: themeTints.text }} numberOfLines={1}>{discoverLocationLabel}</AppText>
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>{`${discoverNearbyCount} nearby`}</AppText>
            </View>
            <Pressable 
              onPress={() => navigation.navigate("MainTabs", { screen: "Maps" })}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing[1], backgroundColor: themeTints.isLateNight ? "rgba(255,255,255,0.1)" : palette.orangeLight, paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radii.pill }}
            >
              <MapPinned color={themeTints.isLateNight ? palette.white : palette.orange} size={14} />
              <AppText variant="micro" style={{ color: themeTints.isLateNight ? palette.white : palette.orange, fontWeight: "700" }}>MAP</AppText>
            </Pressable>
          </View>
        </View>

        {/* Search Bar Entry */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <Pressable 
            onPress={() => navigation.navigate("SearchHome")}
            style={[
              shadows.card,
              {
                backgroundColor: themeTints.cardBg,
                borderRadius: radii.md,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing[4],
                height: 52,
                gap: spacing[2],
                borderWidth: themeTints.isLateNight ? 0 : 1,
                borderColor: palette.border,
              }
            ]}
          >
            <Search color={themeTints.isLateNight ? palette.white : palette.textMuted} size={20} />
            <AppText style={{ flex: 1, color: themeTints.secondaryText }}>Search dishes, stalls or vibes...</AppText>
          </Pressable>
        </View>

        {/* Intent Chips with Icons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}
        >
          {sortedChips.map((chip) => {
            const isActive = selectedCategories.includes(chip.category as SearchCategory);
            return (
              <Chip
                key={chip.id}
                label={chip.label}
                selected={isActive}
                onPress={() => toggleCategory(chip.category as SearchCategory)}
                leftIcon={chip.id === "spicy" ? <Flame size={14} color={isActive ? palette.orange : themeTints.secondaryText} /> : 
                          chip.id === "halal" ? <Home size={14} color={isActive ? palette.orange : themeTints.secondaryText} /> :
                          chip.id === "late" ? <Compass size={14} color={isActive ? palette.orange : themeTints.secondaryText} /> :
                          <Utensils size={14} color={isActive ? palette.orange : themeTints.secondaryText} />}
              />
            );
          })}
        </ScrollView>

        {/* Proactive Selection Grid */}
        <View style={{ gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Animated.View style={{ flex: 1, transform: [{ scale: pulseAnim }] }}>
              <Pressable
                onPress={handleDecideForMe}
                style={[
                  shadows.card,
                  {
                    backgroundColor: palette.orange,
                    borderRadius: radii.lg,
                    padding: spacing[4],
                    minHeight: 120,
                    justifyContent: "space-between",
                  },
                ]}
              >
                <Shuffle color={palette.white} size={24} />
                <View>
                  <AppText variant="h3" tone="inverse">Decide For Me</AppText>
                  <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>Single-player pick</AppText>
                </View>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isLateNight ? "rgba(255,255,255,0.15)" : palette.navy,
                  borderRadius: radii.lg,
                  flex: 1,
                  padding: spacing[4],
                  minHeight: 120,
                  justifyContent: "space-between",
                },
              ]}
            >
              <Compass color={palette.white} size={24} />
              <View>
                <AppText variant="h3" tone="inverse">Hungry Wheel</AppText>
                <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>Party mode</AppText>
              </View>
            </Pressable>
          </View>

          {/* New psychological ownership hook: Daily Crave */}
          <Pressable
            onPress={() => navigation.navigate("Crave")}
            style={[
              shadows.card,
              {
                backgroundColor: themeTints.isLateNight ? "rgba(255,255,255,0.05)" : palette.bgSoft,
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
            <View style={{ width: 48, height: 48, borderRadius: radii.pill, backgroundColor: palette.orange, alignItems: "center", justifyContent: "center" }}>
              <Flame color={palette.white} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3" style={{ color: themeTints.text }}>Daily Crave</AppText>
              <AppText variant="bodySmall" style={{ color: themeTints.secondaryText }}>Swipe to build your profile</AppText>
            </View>
            <ChevronRight color={themeTints.isLateNight ? palette.white : palette.textMuted} size={20} />
          </Pressable>
        </View>

        {/* Recommended Dishes (Carousel) */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[4] }}>
            <AppText variant="h2">Trending Nearby</AppText>
            <Pressable onPress={() => navigation.navigate("SearchResults")}>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>SEE ALL</AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4], paddingHorizontal: spacing[4] }}
          >
            {recommendedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                style={[
                  shadows.card,
                  {
                    backgroundColor: themeTints.cardBg,
                    borderRadius: radii.lg,
                    overflow: "hidden",
                    width: screenWidth * 0.65,
                    borderWidth: themeTints.isLateNight ? 0 : 1,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Image source={{ uri: dish.imageUrl }} style={{ height: 160, width: "100%" }} contentFit="cover" />
                <View style={{ padding: spacing[3], gap: spacing[1] }}>
                  <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>{dish.name}</AppText>
                  <AppText variant="micro" style={{ color: themeTints.secondaryText }}>{dish.venueName}</AppText>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing[1] }}>
                    <AppText variant="price" style={{ color: palette.orange }}>S${dish.price.toFixed(2)}</AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                      <Star color={palette.amber} size={12} fill={palette.amber} />
                      <AppText variant="micro" style={{ fontWeight: "700", color: themeTints.text }}>{dish.rating.toFixed(1)}</AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stalls Near You (Horizontal Selection) */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[4] }}>
            <AppText variant="h2" style={{ color: themeTints.text }}>Stalls Near You</AppText>
            <Pressable onPress={() => navigation.navigate("MainTabs", { screen: "Maps" })}>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>VIEW MAP</AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
          >
            {nearbyVenues.map(({ venue, topDish }) => (
              <Pressable
                key={venue.id}
                onPress={() => navigation.navigate("MapZoomedIn", { buildingId: venue.buildingId })}
                style={[
                  shadows.card,
                  {
                    backgroundColor: themeTints.cardBg,
                    borderRadius: radii.lg,
                    width: 160,
                    padding: spacing[3],
                    gap: spacing[2],
                    borderWidth: themeTints.isLateNight ? 0 : 1,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Image
                  source={{ uri: topDish?.imageUrl }}
                  style={{ borderRadius: radii.md, height: 100, width: "100%" }}
                  contentFit="cover"
                />
                <View style={{ gap: spacing[1] }}>
                  <AppText variant="bodySmall" style={{ fontWeight: "700", color: themeTints.text }} numberOfLines={1}>{venue.name}</AppText>
                  <AppText variant="micro" style={{ color: themeTints.secondaryText }} numberOfLines={1}>{venue.unitNumber} · {venue.operatingHours.split("–")[0]}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}
