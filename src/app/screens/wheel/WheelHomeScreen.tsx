import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PlusCircle, Dices, ArrowRight, ShieldCheck } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { AppText, Button, Card, Input, Screen } from "@/components/ui";
import { useWheelStore } from "@/store/useWheelStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelHome">;

type Mode = "create" | "join";

export function WheelHomeScreen({ navigation, route }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const createParty = useWheelStore((s) => s.createParty);
  const joinParty = useWheelStore((s) => s.joinParty);
  const profile = useProfileStore((state) => state.profile);

  const [mode, setMode] = useState<Mode>(route.params?.code ? "join" : "create");
  const [joinCode, setJoinCode] = useState(route.params?.code ?? "");
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (route.params?.code) {
      setJoinCode(route.params.code);
      setMode("join");
    }
  }, [route.params?.code]);

  async function handleCreate() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);
    try {
      const party = await createParty("classic", "manual", undefined, profile.dietaryPreferences);
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoinError("");
    setJoining(true);
    try {
      await joinParty(joinCode.trim(), joinName.trim(), undefined, profile.dietaryPreferences);
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
    <Screen 
      title="Hungry Wheel" 
      subtitle="Let the wheel resolve your group's food indecision."
    >
      <View style={{ gap: spacing[6], paddingBottom: spacing[12], width: "100%", alignItems: "center" }}>
        
        {/* Brand Icon - Large and Centered */}
        <View style={[shadows.floating, { 
          width: 100, height: 100, borderRadius: 50, 
          backgroundColor: palette.orangeLight, alignItems: "center", 
          justifyContent: "center", borderWidth: 4, borderColor: "#FFFFFF",
          marginTop: spacing[4],
          marginBottom: spacing[2]
        }]}>
          <Dices color={palette.orange} size={54} strokeWidth={1.5} />
        </View>

        {/* Mode Selector */}
        <View style={{ width: "100%" }}>
          <View style={{ flexDirection: "row", backgroundColor: palette.bgSoft, borderRadius: 16, padding: 4 }}>
            <Pressable 
              onPress={() => { setMode("create"); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: mode === "create" ? "#FFFFFF" : "transparent", alignItems: "center", justifyContent: "center", ... (mode === "create" ? shadows.card : {}) }}
            >
              <AppText style={{ fontWeight: mode === "create" ? "700" : "500", color: mode === "create" ? palette.text : palette.textSecondary }}>Start Party</AppText>
            </Pressable>
            <Pressable 
              onPress={() => { setMode("join"); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: mode === "join" ? "#FFFFFF" : "transparent", alignItems: "center", justifyContent: "center", ... (mode === "join" ? shadows.card : {}) }}
            >
              <AppText style={{ fontWeight: mode === "join" ? "700" : "500", color: mode === "join" ? palette.text : palette.textSecondary }}>Join Party</AppText>
            </Pressable>
          </View>
        </View>

        {/* Action Cards */}
        <View style={{ width: "100%" }}>
          {mode === "create" ? (
            <Card style={{ gap: spacing[6], padding: spacing[6] }}>
              <View style={{ gap: spacing[2] }}>
                <AppText variant="h3">Host a Session</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Create a virtual lobby and invite your friends. Everyone adds their cravings, and the wheel picks the winner.
                </AppText>
              </View>
              
              <View style={{ gap: spacing[3] }}>
                <HowItWorksRow step="1" text="Create your virtual lobby" />
                <HowItWorksRow step="2" text="Share the 6-letter code" />
                <HowItWorksRow step="3" text="Spin the wheel together" />
              </View>

              <Button
                label={creating ? "Setting up party..." : "Launch New Party"}
                onPress={handleCreate}
                disabled={creating}
                variant="primary"
                leftIcon={<PlusCircle size={20} color={palette.orange} />}
              />
            </Card>
          ) : (
            <Card style={{ gap: spacing[6], padding: spacing[6] }}>
              <View style={{ gap: spacing[2] }}>
                <AppText variant="h3">Enter Party Code</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Paste the 6-letter code shared by your friend to enter the lobby.
                </AppText>
              </View>

              <View style={{ gap: spacing[4] }}>
                <Input
                  placeholder="CODE7"
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={8}
                  style={{ fontSize: 24, fontFamily: "DM Mono_500Medium", letterSpacing: 4, textAlign: "center" }}
                />
                <Input
                  label="Display Name"
                  placeholder="e.g. Foodie Bob"
                  value={joinName}
                  onChangeText={setJoinName}
                  maxLength={30}
                />
                {joinError ? (
                  <AppText variant="bodySmall" style={{ color: palette.error }}>{joinError}</AppText>
                ) : null}
              </View>

              <Button
                label={joining ? "Joining..." : "Enter Lobby"}
                onPress={handleJoin}
                disabled={joining}
                variant="primary"
                leftIcon={<ArrowRight size={20} color={palette.orange} />}
              />
            </Card>
          )}
        </View>

        {/* Security / Trust Footer */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, opacity: 0.6 }}>
          <ShieldCheck size={14} color={palette.textMuted} />
          <AppText variant="micro" tone="muted">Real-time synchronized multiplayer session</AppText>
        </View>

      </View>
    </Screen>
  );
}

function HowItWorksRow({ step, text }: { step: string; text: string }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}>
        <AppText style={{ fontSize: 12, fontWeight: "900", color: palette.orange }}>{step}</AppText>
      </View>
      <AppText variant="bodySmall" tone="secondary">{text}</AppText>
    </View>
  );
}
