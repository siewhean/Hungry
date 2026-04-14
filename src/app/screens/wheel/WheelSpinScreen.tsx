/**
 * WheelSpinScreen
 *
 * Full-screen wheel with:
 *  - Member avatar row (present members only)
 *  - Static pointer triangle at 12 o'clock
 *  - Animated.View wrapping WheelSvg — rotated via deterministic seed
 *  - Host: "Spin" button; Members: "Waiting for host…" label
 *
 * Spin math (matches plan §3):
 *   winnerIndex   = seed % activeEntries.length
 *   segmentAngle  = 360 / activeEntries.length
 *   winnerAngle   = winnerIndex * segmentAngle + segmentAngle / 2
 *   totalRotation = 5 * 360 + (360 - winnerAngle)  // 5 full spins + correction
 */

import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Play } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { AppText, Badge, Card } from "@/components/ui";
import { MemberAvatarRow } from "@/components/wheel/MemberAvatarRow";
import { WheelSvg } from "@/components/wheel/WheelSvg";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelSpin">;

const WHEEL_SIZE = 300;

export function WheelSpinScreen({ navigation }: Props) {
  const { motion, palette, radii, spacing, zIndex, shadows } = useHungryTheme();

  const party = useWheelStore((s) => s.party);
  const members = useWheelStore((s) => s.members);
  const entries = useWheelStore((s) => s.entries);
  const myMemberId = useWheelStore((s) => s.myMemberId);
  const triggerSpin = useWheelStore((s) => s.triggerSpin);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const isSpinning = useRef(false);
  const lastHapticAngle = useRef(0);

  const activeEntries = entries.filter((e) => !e.isEliminated);
  const isHost = members.find((m) => m.id === myMemberId)?.isHost ?? false;

  // Track animation for haptics
  useEffect(() => {
    const segmentAngle = 360 / Math.max(1, activeEntries.length);
    
    // We expect totalRotation to be around 5 * 360 = 1800+ degrees.
    // The animation is Easing.out(Easing.cubic), so speed is high at first.
    
    const listenerId = spinAnim.addListener(({ value }) => {
      const currentSegment = Math.floor(value / segmentAngle);
      const lastSegment = Math.floor(lastHapticAngle.current / segmentAngle);

      if (currentSegment !== lastSegment) {
        lastHapticAngle.current = value;
        
        // Intensity logic: 
        // 1. Initial burst (first 2 full rotations): Heavy
        // 2. Middle phase (rotations 3-4): Medium
        // 3. Final slowdown (rotation 5+): Light
        
        if (value < 720) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (value < 1440) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    });

    return () => {
      spinAnim.removeListener(listenerId);
    };
  }, [activeEntries.length]);

  // Watch for spin_triggered event — party.spinSeed is set when it fires.
  useEffect(() => {
    if (!party?.spinSeed || !party.spinStartedAt) return;
    if (isSpinning.current) return;
    if (activeEntries.length < 2) return;

    const seed = party.spinSeed;
    const startedAt = party.spinStartedAt;

    const segmentAngle = 360 / activeEntries.length;
    const winnerIndex =
      ((seed % activeEntries.length) + activeEntries.length) % activeEntries.length;
    const winnerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const totalRotation = 5 * 360 + (360 - winnerAngle);

    // Sync delay: all clients start at the same moment
    const delay = Math.max(0, startedAt - Date.now());

    const timer = setTimeout(() => {
      isSpinning.current = true;
      spinAnim.setValue(0);
      lastHapticAngle.current = 0;

      Animated.timing(spinAnim, {
        toValue: totalRotation,
        duration: motion.wheelSpin,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        isSpinning.current = false;

        const winnerEntry = activeEntries[winnerIndex];
        if (!winnerEntry) return;

        // Navigate to result when spin animation completes.
        // party_resolved / round_resolved event will have already updated store.
        const currentParty = useWheelStore.getState().party;
        if (currentParty?.winnerEntryId) {
          navigation.replace("WheelResult", {
            partyId: currentParty.id,
            winnerEntryId: currentParty.winnerEntryId,
          });
        } else {
          // Elimination mode: go back to lobby for next round.
          navigation.replace("WheelLobby", { partyId: currentParty?.id ?? party.id });
        }
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [motion.wheelSpin, party?.spinSeed, party?.spinStartedAt]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  if (!party) return null;

  const spinning = party.status === "spinning";
  const canSpin = isHost && !spinning && activeEntries.length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <LinearGradient
        colors={[palette.bg, palette.bgSoft]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative background pattern (subtle circles) */}
      <View style={{ ...StyleSheet.absoluteFillObject, opacity: 0.03, overflow: "hidden" }} pointerEvents="none">
        <View style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: 200, borderWidth: 40, borderColor: palette.orange }} />
        <View style={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, borderRadius: 100, borderWidth: 20, borderColor: palette.orange }} />
      </View>

      {/* Member row */}
      <View style={{ paddingTop: spacing[12], paddingHorizontal: spacing[3], paddingBottom: spacing[4] }}>
        <MemberAvatarRow members={members} />
      </View>

      {/* Wheel area */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* Pointer - Improved with Gradient/Shadow */}
        <View style={{ 
          alignItems: "center", 
          zIndex: zIndex.overlay, 
          marginBottom: -spacing[4] 
        }}>
          <LinearGradient
            colors={[palette.orange, palette.orangeDark]}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              ...shadows.floating,
              borderWidth: 3,
              borderColor: palette.white,
            }}
          >
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 10,
                borderRightWidth: 10,
                borderTopWidth: 12,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: palette.white,
                marginTop: 2,
              }}
            />
          </LinearGradient>
        </View>

        {/* Spinning wheel with outer ring */}
        <View style={{
          padding: 8,
          borderRadius: (WHEEL_SIZE + 16) / 2,
          backgroundColor: palette.bgSoft,
          borderWidth: 2,
          borderColor: palette.border,
          ...shadows.card,
        }}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <WheelSvg entries={entries} size={WHEEL_SIZE} />
          </Animated.View>
        </View>
      </View>

      {/* Mode badge + entry count */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: spacing[2],
          paddingHorizontal: spacing[3],
          paddingBottom: spacing[6],
        }}
      >
        <Badge
          label={party.spinMode === "classic" ? "Classic" : `Elimination — Round ${party.currentRound}`}
          tone="orange"
        />
        <AppText variant="micro" tone="secondary">
          {activeEntries.length} options active
        </AppText>
      </View>

      {/* Controls */}
      <View
        style={{
          paddingHorizontal: spacing[3],
          paddingBottom: spacing[12],
          alignItems: "center",
        }}
      >
        {isHost ? (
          <Pressable
            onPress={triggerSpin}
            disabled={!canSpin}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[3],
                backgroundColor: canSpin ? palette.orange : palette.bgSoft,
                paddingHorizontal: spacing[8],
                paddingVertical: spacing[4],
                borderRadius: radii.pill,
                opacity: canSpin ? (pressed ? 0.9 : 1) : 0.5,
                ...shadows.floating,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              }
            ]}
          >
            <Play size={24} color={canSpin ? palette.white : palette.textMuted} fill={canSpin ? palette.white : "transparent"} />
            <AppText
              variant="h2"
              style={{ color: canSpin ? palette.white : palette.textMuted, fontWeight: "800" }}
            >
              {spinning ? "SPINNING…" : "SPIN NOW"}
            </AppText>
          </Pressable>
        ) : (
          <Card style={{ backgroundColor: palette.bgSoft, borderColor: "transparent", paddingVertical: spacing[4] }}>
            <AppText tone="secondary" style={{ textAlign: "center", fontWeight: "600" }}>
              {spinning ? "🎡 The wheel is turning..." : "⏳ Waiting for host to spin"}
            </AppText>
          </Card>
        )}
      </View>
    </View>
  );
}
