import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppText, Button, Card, Input, Screen } from "@/components/ui";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelHome">;

export function WheelHomeScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const createParty = useWheelStore((s) => s.createParty);
  const joinParty = useWheelStore((s) => s.joinParty);

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
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
    <Screen title="Hungry Wheel" subtitle="Let the wheel decide where your group eats.">
      <View style={{ gap: spacing[4] }}>
        {/* Create */}
        <Card>
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="h3">Start a new party</AppText>
              <AppText variant="bodySmall" tone="secondary">
                You'll get a shareable code your friends can use to join.
              </AppText>
            </View>
            <Button
              label={creating ? "Creating…" : "Create party"}
              onPress={handleCreate}
              disabled={creating}
            />
          </View>
        </Card>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
          <AppText variant="micro" tone="secondary">
            OR
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
        </View>

        {/* Join */}
        <Card>
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="h3">Join a party</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Enter the 6-letter code from the party host.
              </AppText>
            </View>
            <Input
              label="Party code"
              placeholder="e.g. MAKAN7"
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
            />
            <Input
              label="Your name"
              placeholder="How should the group see you?"
              value={joinName}
              onChangeText={setJoinName}
              maxLength={30}
            />
            {joinError ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {joinError}
              </AppText>
            ) : null}
            <Button
              label={joining ? "Joining…" : "Join party"}
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
