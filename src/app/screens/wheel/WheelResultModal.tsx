/**
 * WheelResultModal
 *
 * Celebratory full-screen modal showing the winning venue.
 * Spring scale-in card entrance (same pattern as DecideForMeResultScreen).
 * Tap the card → navigate to StallDetail.
 * CTA dock: "Spin again" (classic) / "Next round" (elimination).
 */

import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { MapPin, Navigation } from "lucide-react-native";

import { AppText, Badge } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelResult">;

export function WheelResultModal({ navigation, route }: Props) {
  const { palette, spacing, radii, shadows, motion } = useHungryTheme();
  const { winnerEntryId, partyId } = route.params;

  const party = useWheelStore((s) => s.party);
  const entries = useWheelStore((s) => s.entries);
  const resetParty = useWheelStore((s) => s.reset);

  const winnerEntry = entries.find((e) => e.id === winnerEntryId);
  const venue = winnerEntry ? mockRepository.getVenueById(winnerEntry.venueId) : undefined;
  const dishes = winnerEntry ? mockRepository.listDishesByVenue(winnerEntry.venueId) : [];
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

  function handleStallDetail() {
    if (!winnerEntry) return;
    // Navigate to root StallDetail — get the root navigator from the stack parent
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    rootNav?.navigate("StallDetail", { venueId: winnerEntry.venueId });
  }

  function handleSpinAgain() {
    if (!party) return;
    navigation.replace("WheelSpin", { partyId: party.id });
  }

  function handleDone() {
    resetParty();
    navigation.popToTop();
  }

  const isClassic = party?.spinMode === "classic";
  const isElimination = party?.spinMode === "elimination";
  const remainingActive = entries.filter((e) => !e.isEliminated).length;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.overlay,
        justifyContent: "flex-end",
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={() => {}} />

      <Animated.View
        style={{
          backgroundColor: palette.bg,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          ...shadows.floating,
        }}
      >
        {/* Hero image */}
        {heroDish?.imageUrl ? (
          <Image
            source={{ uri: heroDish.imageUrl }}
            style={{
              width: "100%",
              height: 220,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
            }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 220,
              backgroundColor: palette.bgSoft,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText variant="display" style={{ color: palette.orange }}>
              🎉
            </AppText>
          </View>
        )}

        {/* Content */}
        <View style={{ padding: spacing[4], gap: spacing[4] }}>
          {/* Winner label */}
          <View style={{ gap: spacing[1] }}>
            <AppText variant="micro" tone="secondary" style={{ textTransform: "uppercase" }}>
              {isClassic ? "Your group is going to" : `Round ${party?.currentRound} winner`}
            </AppText>
            <AppText variant="h1">{winnerEntry?.label ?? "—"}</AppText>

            {venue ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <MapPin size={14} color={palette.textMuted} />
                <AppText variant="bodySmall" tone="secondary">
                  {venue.floor} {venue.unitNumber}
                </AppText>
                <Badge
                  label={venue.hygieneGrade}
                  tone={venue.hygieneGrade === "A" ? "success" : "neutral"}
                />
              </View>
            ) : null}
          </View>

          {/* CTA dock */}
          <View style={{ gap: spacing[3] }}>
            {/* Primary: go to stall */}
            <Pressable
              onPress={handleStallDetail}
              style={{
                backgroundColor: palette.orange,
                paddingVertical: spacing[4],
                borderRadius: radii.pill,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing[2],
              }}
            >
              <Navigation size={16} color={palette.surface} />
              <AppText
                variant="h3"
                tone="inverse"
              >
                View stall
              </AppText>
            </Pressable>

            {/* Elimination mode: continue or finish */}
            {isElimination && remainingActive > 2 ? (
              <Pressable
                onPress={handleSpinAgain}
                style={{
                  backgroundColor: palette.bgSoft,
                  paddingVertical: spacing[4],
                  borderRadius: radii.pill,
                  alignItems: "center",
                }}
              >
                <AppText variant="h3" tone="secondary">
                  Next round ({remainingActive - 1} left)
                </AppText>
              </Pressable>
            ) : null}

            {/* Done / disband */}
            <Pressable onPress={handleDone} style={{ alignItems: "center", paddingVertical: spacing[2] }}>
              <AppText variant="bodySmall" tone="secondary">
                {isClassic ? "Spin again" : "Done — disband party"}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
