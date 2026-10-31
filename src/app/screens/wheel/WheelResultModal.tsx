/**
 * WheelResultModal
 *
 * Celebratory full-screen modal showing the winning venue.
 * Spring scale-in card entrance (same pattern as DecideForMeResultScreen).
 * Tap the card → navigate to StallDetail.
 * CTA dock: "Spin again" (classic) / "Next round" (elimination).
 */

import { useEffect, useState } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import {
  MapPin,
  Navigation,
  PartyPopper,
  Store,
  Trophy,
  RotateCcw,
  CheckCircle2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AccessibleImage, AppSymbol, AppText, Button } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { buildStallMapsUrl, getStallPin } from "@/features/detail/stallLocation";
import { formatDistanceLabel } from "@/features/discovery/distanceLabel";
import { getDistanceMetersFromCoordinates } from "@/lib/geo/distance";
import { findBuildingById } from "@/features/discovery/discovery";
import { leaveWheelStack } from "@/features/wheel/leaveWheel";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { VenueSummary } from "@/types/domain";
import { reportError } from "@/lib/monitoring/reportError";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelResult">;

const WINNER_CARD_START_SCALE = 0.95;
const WINNER_CARD_ENTER_MS = 250;
const WINNER_CARD_EASING = Easing.bezier(0.23, 1, 0.32, 1);

export function WheelResultModal({ navigation, route }: Props) {
  const { componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const { winnerEntryId } = route.params;
  const repository = getDataRepository();

  const party = useWheelStore((s) => s.party);
  const entries = useWheelStore((s) => s.entries);
  const resetSpin = useWheelStore((s) => s.resetSpin);
  const triggerSpin = useWheelStore((s) => s.triggerSpin);

  const winnerEntry = entries.find((e) => e.id === winnerEntryId);
  const cachedVenue = winnerEntry ? repository.getVenueById(winnerEntry.venueId) : undefined;
  // The catalog cache is row-capped: a stall beyond it is fetched from the server.
  const [fetchedVenue, setFetchedVenue] = useState<VenueSummary | undefined>();
  const winnerVenueId = winnerEntry?.venueId;
  useEffect(() => {
    if (!winnerVenueId || cachedVenue) return;
    let mounted = true;
    getHungryService()
      .discovery.getVenue(winnerVenueId)
      .then((found) => {
        if (mounted) setFetchedVenue(found);
      })
      .catch((error) =>
        reportError(error, { screen: "WheelResultModal", action: "load_winner_venue" }),
      );
    return () => {
      mounted = false;
    };
  }, [winnerVenueId, cachedVenue]);
  const venue = cachedVenue ?? fetchedVenue;
  // Where it is and how far: the building, the unit and the distance from the diner.
  const locationPermission = useLocationStore((s) => s.permission);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const manualCoordinate = useLocationStore((s) => s.manualCoordinate);
  const { coordinate: origin, isApproximate } = getEffectiveLocation({
    permission: locationPermission,
    currentLocation,
    manualCoordinate,
  });
  const building = winnerEntry ? findBuildingById(winnerEntry.buildingId) : undefined;
  const buildingName = venue?.buildingName ?? building?.name;
  const unitLine = [venue?.floor, venue?.unitNumber].filter(Boolean).join(" ");
  const placeLine = [buildingName, unitLine].filter(Boolean).join(" · ");
  const stallPin = venue ? getStallPin(venue, building?.coordinate) : undefined;
  // Distance from the built-in default point is not distance from the user.
  const distancePoint = stallPin ?? building?.coordinate;
  const distanceLabel =
    isApproximate ||
    !distancePoint ||
    (distancePoint.latitude === 0 && distancePoint.longitude === 0)
      ? undefined
      : formatDistanceLabel(getDistanceMetersFromCoordinates(origin, distancePoint), {
          away: true,
        });
  const dishes = winnerEntry ? repository.listDishesByVenue(winnerEntry.venueId) : [];
  const heroDish = dishes[0];
  const heroPlaceholder = (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" },
      ]}
    >
      <AppSymbol name="party.popper.fill" fallback={PartyPopper} size={56} color={palette.orange} />
    </View>
  );

  // The card arrives from 95%, a strong ease-out in 250 ms. With Reduce Motion on it only fades.
  const scale = useSharedValue(reduceMotion ? 1 : WINNER_CARD_START_SCALE);
  const opacity = useSharedValue(0);
  const cardMotion = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    const timing = { duration: WINNER_CARD_ENTER_MS, easing: WINNER_CARD_EASING };
    opacity.value = withTiming(1, timing);
    scale.value = reduceMotion ? 1 : withTiming(1, timing);
  }, [opacity, reduceMotion, scale]);

  useEffect(() => {
    if (!winnerEntryId) return;
    trackAnalyticsEvent("wheel_result_viewed", {
      party_id: party?.id,
      venue_id: winnerEntry?.venueId,
    });
    // Once per result shown.
  }, [winnerEntryId]);

  function handleDirections() {
    if (!winnerEntry) return;
    trackAnalyticsEvent("directions_opened", {
      stall_id: winnerEntry.venueId,
      source: "wheel",
    });
    void openTrustedMapsUrl(
      buildStallMapsUrl(
        {
          name: winnerEntry.label,
          buildingName,
          address: venue?.address,
          postalCode: venue?.postalCode,
        },
        stallPin,
      ),
    );
  }

  function handleStallDetail() {
    if (!winnerEntry) return;
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    rootNav?.navigate("StallDetail", { venueId: winnerEntry.venueId });
  }

  function handleSpinAgain() {
    if (!party) return;
    // Clear the finished seed/winner, keep the options, and start the next spin right away.
    resetSpin();
    triggerSpin();
    navigation.replace("WheelSpin", { partyId: party.id });
  }

  function handleDone() {
    // Leave the whole wheel; WheelStack clears the party when it closes.
    leaveWheelStack(navigation);
  }

  const isClassic = party?.spinMode === "classic";
  const isElimination = party?.spinMode === "elimination";
  const remainingActive = entries.filter((e) => !e.isEliminated).length;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "transparent",
        justifyContent: "center",
        padding: spacing[4],
      }}
    >
      <LinearGradient
        colors={[palette.overlay, palette.mediaBackdrop]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          {
            backgroundColor: palette.surface,
            borderRadius: componentRadii.card,
            overflow: "hidden",
          },
          cardMotion,
          {
            ...shadows.floating,
            borderWidth: 1,
            borderColor: palette.orange,
          },
        ]}
      >
        {/* Winner Header Badge */}
        <View style={{ position: "absolute", top: spacing[4], left: spacing[4], zIndex: 10 }}>
          <LinearGradient
            colors={[palette.amber, palette.amber]}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1.5],
              borderRadius: radii.pill,
              ...shadows.card,
            }}
          >
            {/* Dark text on amber: white on #F5A623 is 2.0:1. */}
            <AppSymbol name="trophy.fill" fallback={Trophy} size={14} color={palette.navy} />
            <AppText variant="micro" style={{ color: palette.navy, fontWeight: "900" }}>
              Winner
            </AppText>
          </LinearGradient>
        </View>

        {/* Hero image */}
        <View style={{ height: 240, width: "100%", position: "relative" }}>
          {heroDish?.imageUrl ? (
            <AccessibleImage
              source={{ uri: heroDish.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`${heroDish.name} photo`}
              fallback={heroPlaceholder}
            />
          ) : (
            heroPlaceholder
          )}
          <LinearGradient
            colors={[palette.mediaScrimSoft, "transparent", palette.mediaScrimStrong]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Content */}
        <View style={{ padding: spacing[5], gap: spacing[5] }}>
          <View style={{ gap: spacing[1], alignItems: "center" }}>
            <AppText variant="micro" tone="accent" style={{ fontWeight: "800", letterSpacing: 1 }}>
              {isClassic ? "Your next stop is..." : "The last one standing"}
            </AppText>
            <AppText variant="h1" style={{ textAlign: "center", fontSize: 28 }}>
              {winnerEntry?.label ?? "—"}
            </AppText>

            {placeLine ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[2],
                  marginTop: spacing[1],
                }}
              >
                <AppSymbol
                  name="mappin.and.ellipse"
                  fallback={MapPin}
                  size={14}
                  color={palette.orange}
                />
                <AppText variant="bodySmall" tone="secondary">
                  {placeLine}
                </AppText>
              </View>
            ) : null}
            {distanceLabel ? (
              <AppText variant="bodySmall" tone="secondary">
                {distanceLabel}
              </AppText>
            ) : null}
          </View>

          {/* CTA dock */}
          <View style={{ gap: spacing[3] }}>
            <Button
              label="Directions"
              onPress={handleDirections}
              leftIcon={
                <AppSymbol
                  name="arrow.triangle.turn.up.right.diamond.fill"
                  fallback={Navigation}
                  size={18}
                  color={palette.white}
                />
              }
            />

            <Button
              label="View stall details"
              onPress={handleStallDetail}
              variant="secondary"
              leftIcon={
                <AppSymbol name="storefront" fallback={Store} size={18} color={palette.text} />
              }
            />

            {isClassic ? (
              <Button
                label="Spin again"
                onPress={handleSpinAgain}
                variant="secondary"
                leftIcon={
                  <AppSymbol
                    name="arrow.counterclockwise"
                    fallback={RotateCcw}
                    size={18}
                    color={palette.text}
                  />
                }
              />
            ) : null}

            {isElimination && remainingActive > 2 ? (
              <Button
                label={`Next round (${remainingActive - 1} left)`}
                onPress={handleSpinAgain}
                variant="secondary"
                leftIcon={
                  <AppSymbol
                    name="arrow.counterclockwise"
                    fallback={RotateCcw}
                    size={18}
                    color={palette.text}
                  />
                }
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isClassic ? "Done" : "Disband party"}
              onPress={handleDone}
              style={({ pressed }) => ({
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                paddingVertical: spacing[2],
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <AppSymbol
                  name="checkmark.circle.fill"
                  fallback={CheckCircle2}
                  size={14}
                  color={palette.textMuted}
                />
                <AppText variant="bodySmallBold" tone="muted" style={{ letterSpacing: 1 }}>
                  {isClassic ? "Done" : "Disband party"}
                </AppText>
              </View>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
