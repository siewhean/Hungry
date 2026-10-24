/**
 * WheelResultModal
 *
 * Celebratory full-screen modal showing the winning venue.
 * Spring scale-in card entrance (same pattern as DecideForMeResultScreen).
 * Tap the card → navigate to StallDetail.
 * CTA dock: "Spin again" (classic) / "Next round" (elimination).
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View, StyleSheet } from "react-native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { MapPin, Navigation, Trophy, RotateCcw, CheckCircle2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AccessibleImage, AppText, Button } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { leaveWheelStack } from "@/features/wheel/leaveWheel";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelResult">;

export function WheelResultModal({ navigation, route }: Props) {
  const { componentRadii, palette, spacing, radii, shadows, motion } = useHungryTheme();
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
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [winnerVenueId, cachedVenue]);
  const venue = cachedVenue ?? fetchedVenue;
  const dishes = winnerEntry ? repository.listDishesByVenue(winnerEntry.venueId) : [];
  const heroDish = dishes[0];

  // Spring scale-in card entrance
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: motion.modalEnter,
        useNativeDriver: true,
      }),
    ]).start();
  }, [motion.modalEnter, opacityAnim, scaleAnim]);

  useEffect(() => {
    if (!winnerEntryId) return;
    trackAnalyticsEvent("wheel_result_viewed", {
      party_id: party?.id,
      venue_id: winnerEntry?.venueId,
    });
    // Once per result shown.
  }, [winnerEntryId]);

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
        style={{
          backgroundColor: palette.surface,
          borderRadius: componentRadii.card,
          overflow: "hidden",
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          ...shadows.floating,
          borderWidth: 1,
          borderColor: palette.orange,
        }}
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
            <Trophy size={14} color={palette.navy} />
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
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" },
              ]}
            >
              <AppText variant="display" style={{ color: palette.orange }}>
                🎉
              </AppText>
            </View>
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
              {isClassic ? "Your next stop is..." : `The Last One Standing`}
            </AppText>
            <AppText variant="h1" style={{ textAlign: "center", fontSize: 28 }}>
              {winnerEntry?.label ?? "—"}
            </AppText>

            {venue ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[2],
                  marginTop: spacing[1],
                }}
              >
                <MapPin size={14} color={palette.orange} />
                <AppText variant="bodySmall" tone="secondary">
                  {venue.floor} {venue.unitNumber}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* CTA dock */}
          <View style={{ gap: spacing[3] }}>
            <Button
              label="View stall details"
              onPress={handleStallDetail}
              leftIcon={<Navigation size={18} color={palette.white} />}
            />

            {isClassic ? (
              <Button
                label="Spin again"
                onPress={handleSpinAgain}
                variant="secondary"
                leftIcon={<RotateCcw size={18} color={palette.text} />}
              />
            ) : null}

            {isElimination && remainingActive > 2 ? (
              <Button
                label={`Next Round (${remainingActive - 1} left)`}
                onPress={handleSpinAgain}
                variant="secondary"
                leftIcon={<RotateCcw size={18} color={palette.text} />}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isClassic ? "Done" : "Disband party"}
              onPress={handleDone}
              style={({ pressed }) => ({
                alignItems: "center",
                paddingVertical: spacing[2],
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <CheckCircle2 size={14} color={palette.textMuted} />
                <AppText variant="bodySmallBold" tone="muted" style={{ letterSpacing: 1 }}>
                  {isClassic ? "Done" : "Disband Party"}
                </AppText>
              </View>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
