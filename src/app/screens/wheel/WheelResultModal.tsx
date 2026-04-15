/**
 * WheelResultModal
 *
 * Celebratory full-screen modal showing the winning venue.
 * Spring scale-in card entrance (same pattern as DecideForMeResultScreen).
 * Tap the card → navigate to StallDetail.
 * CTA dock: "Spin again" (classic) / "Next round" (elimination).
 */

import { useEffect, useRef } from "react";
import { Animated, Pressable, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { MapPin, Navigation, Trophy, RotateCcw, CheckCircle2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AppText, Button } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelResult">;

export function WheelResultModal({ navigation, route }: Props) {
  const { palette, spacing, radii, shadows, motion } = useHungryTheme();
  const { winnerEntryId } = route.params;
  const repository = getDataRepository();

  const party = useWheelStore((s) => s.party);
  const entries = useWheelStore((s) => s.entries);
  const resetParty = useWheelStore((s) => s.reset);

  const winnerEntry = entries.find((e) => e.id === winnerEntryId);
  const venue = winnerEntry ? repository.getVenueById(winnerEntry.venueId) : undefined;
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

  function handleStallDetail() {
    if (!winnerEntry) return;
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
        backgroundColor: "transparent",
        justifyContent: "center",
        padding: spacing[4],
      }}
    >
      <LinearGradient
        colors={[palette.overlay, "rgba(0,0,0,0.9)"]}
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View
        style={{
          backgroundColor: palette.surface,
          borderRadius: radii.xl,
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
              ...shadows.card
            }}
          >
            <Trophy size={14} color={palette.white} />
            <AppText variant="micro" style={{ color: palette.white, fontWeight: "900" }}>WINNER</AppText>
          </LinearGradient>
        </View>

        {/* Hero image */}
        <View style={{ height: 240, width: "100%", position: "relative" }}>
          {heroDish?.imageUrl ? (
            <Image
              source={{ uri: heroDish.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }]}>
              <AppText variant="display" style={{ color: palette.orange }}>🎉</AppText>
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.6)"]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Content */}
        <View style={{ padding: spacing[5], gap: spacing[5] }}>
          <View style={{ gap: spacing[1], alignItems: "center" }}>
            <AppText variant="micro" tone="accent" style={{ fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
              {isClassic ? "Your next stop is..." : `The Last One Standing`}
            </AppText>
            <AppText variant="h1" style={{ textAlign: "center", fontSize: 28 }}>{winnerEntry?.label ?? "—"}</AppText>

            {venue ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[1] }}>
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
              label="View Stall Details"
              onPress={handleStallDetail}
              leftIcon={<Navigation size={18} color={palette.white} />}
            />

            {isElimination && remainingActive > 2 ? (
              <Button
                label={`Next Round (${remainingActive - 1} left)`}
                onPress={handleSpinAgain}
                variant="secondary"
                leftIcon={<RotateCcw size={18} color={palette.text} />}
              />
            ) : null}

            <Pressable 
              onPress={handleDone} 
              style={({ pressed }) => ({ 
                alignItems: "center", 
                paddingVertical: spacing[2],
                opacity: pressed ? 0.7 : 1
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <CheckCircle2 size={14} color={palette.textMuted} />
                <AppText variant="bodySmallBold" tone="muted" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
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
