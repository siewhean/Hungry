import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Users, ArrowRight, Compass } from "lucide-react-native";

import { AppText, Button, Card, Input, Screen } from "@/components/ui";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelHome">;

export function WheelHomeScreen({ navigation, route }: Props) {
  const { componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  const createParty = useWheelStore((s) => s.createParty);
  const joinParty = useWheelStore((s) => s.joinParty);

  const [joinCode, setJoinCode] = useState(route.params?.code ?? "");
  const [joinName, setJoinName] = useState("");

  useEffect(() => {
    if (route.params?.code) {
      setJoinCode(route.params.code);
    }
  }, [route.params?.code]);
  const [joinError, setJoinError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const party = await createParty("classic", "manual");
      navigation.replace("WheelLobby", { partyId: party.id });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) {
      setJoinError("Enter the party code and your name.");
      return;
    }
    setJoinError("");
    setJoining(true);
    try {
      await joinParty(joinCode.trim(), joinName.trim());
      const party = useWheelStore.getState().party;
      if (!party) {
        setJoinError("Party not found. Double-check the code.");
        return;
      }
      navigation.replace("WheelLobby", { partyId: party.id });
    } finally {
      setJoining(false);
    }
  }

  return (
    <Screen title="Hungry Wheel" subtitle="">
      <View style={{ gap: spacing[6] }}>
        {/* Intro Illustration/Icon Section */}
        <View style={{ alignItems: "center", paddingVertical: spacing[4], gap: spacing[2] }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: palette.orangeLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Compass size={44} color={palette.orange} strokeWidth={1.5} />
          </View>
          <AppText
            variant="bodySmall"
            tone="secondary"
            style={{ textAlign: "center", maxWidth: "80%" }}
          >
            The ultimate tie-breaker for groups who can&apos;t decide where to eat.
          </AppText>
        </View>

        {/* Create Party - High Impact */}
        <Pressable onPress={handleCreate} disabled={creating}>
          <LinearGradient
            colors={[palette.orange, palette.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: componentRadii.button,
              padding: spacing[5],
              ...shadows.floating,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <AppText variant="h2" style={{ color: palette.white }}>
                  Host a Party
                </AppText>
                <AppText variant="bodySmall" style={{ color: palette.inverseTextSecondary }}>
                  Start a new room and invite your friends to join the spin.
                </AppText>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: palette.inverseSurfaceSubtle,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowRight size={24} color={palette.white} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[3],
            paddingHorizontal: spacing[4],
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: palette.border, opacity: 0.5 }} />
          <AppText variant="micro" tone="secondary" style={{ fontWeight: "800" }}>
            HAVE A CODE?
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: palette.border, opacity: 0.5 }} />
        </View>

        {/* Join Party */}
        <Card style={{ borderStyle: "dashed", borderWidth: 1.5, borderColor: palette.border }}>
          <View style={{ gap: spacing[4] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Users size={18} color={palette.orange} />
              <AppText variant="h3">Join your friends</AppText>
            </View>

            <View style={{ gap: spacing[3] }}>
              <Input
                label="Party Code"
                placeholder="e.g. MAKAN7"
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
              />
              <Input
                label="Your Name"
                placeholder="How should the group see you?"
                value={joinName}
                onChangeText={setJoinName}
                maxLength={30}
              />
            </View>

            {joinError ? (
              <View
                style={{
                  backgroundColor: `${palette.error}10`,
                  padding: spacing[2],
                  borderRadius: radii.sm,
                }}
              >
                <AppText
                  variant="micro"
                  style={{ color: palette.error, fontWeight: "600", textAlign: "center" }}
                >
                  {joinError}
                </AppText>
              </View>
            ) : null}

            <Button
              label={joining ? "Joining..." : "Join the Room"}
              onPress={handleJoin}
              disabled={joining}
              variant="secondary"
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
