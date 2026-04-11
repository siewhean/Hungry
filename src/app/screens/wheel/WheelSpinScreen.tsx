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
import { Animated, Easing, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Play } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { MemberAvatarRow } from "@/components/wheel/MemberAvatarRow";
import { WheelSvg } from "@/components/wheel/WheelSvg";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelSpin">;

const WHEEL_SIZE = 300;
const SPIN_DURATION = 4000;

export function WheelSpinScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();

  const party = useWheelStore((s) => s.party);
  const members = useWheelStore((s) => s.members);
  const entries = useWheelStore((s) => s.entries);
  const myMemberId = useWheelStore((s) => s.myMemberId);
  const triggerSpin = useWheelStore((s) => s.triggerSpin);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const isSpinning = useRef(false);

  const activeEntries = entries.filter((e) => !e.isEliminated);
  const isHost = members.find((m) => m.id === myMemberId)?.isHost ?? false;

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

      Animated.timing(spinAnim, {
        toValue: totalRotation,
        duration: SPIN_DURATION,
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
  }, [party?.spinSeed, party?.spinStartedAt]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  if (!party) return null;

  const spinning = party.status === "spinning";
  const canSpin = isHost && !spinning && activeEntries.length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Member row */}
      <View style={{ paddingTop: 60, paddingHorizontal: spacing[4], paddingBottom: spacing[4] }}>
        <MemberAvatarRow members={members} />
      </View>

      {/* Wheel area */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* Pointer */}
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderBottomWidth: 20,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: palette.orange,
            marginBottom: -2,
            zIndex: 1,
          }}
        />

        {/* Spinning wheel */}
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <WheelSvg entries={entries} size={WHEEL_SIZE} />
        </Animated.View>
      </View>

      {/* Mode badge + entry count */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: spacing[3],
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[4],
        }}
      >
        <AppText variant="micro" tone="secondary" style={{ textTransform: "uppercase" }}>
          {party.spinMode === "classic" ? "Classic" : `Elimination — Round ${party.currentRound}`}
        </AppText>
        <AppText variant="micro" tone="secondary">·</AppText>
        <AppText variant="micro" tone="secondary">
          {activeEntries.length} option{activeEntries.length !== 1 ? "s" : ""}
        </AppText>
      </View>

      {/* Controls */}
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingBottom: 48,
          alignItems: "center",
          gap: spacing[3],
        }}
      >
        {isHost ? (
          <Pressable
            onPress={triggerSpin}
            disabled={!canSpin}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[2],
              backgroundColor: "#FFFFFF",
              borderColor: canSpin ? palette.orange : palette.border,
              borderWidth: 2,
              paddingHorizontal: spacing[8],
              paddingVertical: spacing[4],
              borderRadius: 999,
              opacity: canSpin ? 1 : 0.5,
              transform: [{ translateY: pressed && canSpin ? 1 : 0 }],
            })}
          >
            <Play size={20} color={canSpin ? palette.orange : palette.textMuted} fill={canSpin ? palette.orange : "transparent"} />
            <AppText
              style={{ color: canSpin ? palette.orange : palette.textMuted, fontWeight: "800", fontSize: 18 }}
            >
              {spinning ? "Spinning…" : "Spin the wheel"}
            </AppText>
          </Pressable>
        ) : (
          <View style={{ backgroundColor: palette.bgSoft, paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radii.pill }}>
            <AppText tone="secondary" style={{ textAlign: "center", fontWeight: "600" }}>
              {spinning ? "Spinning…" : "Waiting for the host to spin…"}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
