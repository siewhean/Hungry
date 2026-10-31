import { useEffect, useState } from "react";
import { ActivityIndicator, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Users, ArrowRight, Compass } from "lucide-react-native";

import { AppText, Button, Card, Input, Screen } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { reportError } from "@/lib/monitoring/reportError";
import { useProfileStore } from "@/store/useProfileStore";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelStackParamList } from "./WheelStack";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelHome">;

// Parties are an in-memory mock, so production only offers a solo spin.
const PARTY_ENABLED = FEATURE_FLAGS.wheelPartyEnabled;

export function WheelHomeScreen({ navigation, route }: Props) {
  const { colorScheme, componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
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
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  // Without parties there is nothing to choose here, so the wheel opens straight on its lobby.
  // An invite link is the exception: it says why group spins are not there yet.
  const startsStraightAway = !PARTY_ENABLED && !route.params?.code;

  async function handleCreate() {
    setCreating(true);
    setCreateError("");
    try {
      // Seed the host's dietary needs so the add sheet can warn about stalls that don't fit.
      const party = await createParty(
        "classic",
        "manual",
        undefined,
        useProfileStore.getState().profile.dietaryPreferences,
      );
      navigation.replace("WheelLobby", { partyId: party.id });
    } catch (error) {
      reportError(error, { screen: "WheelHome", action: "create_party" });
      setCreateError(
        PARTY_ENABLED
          ? "Couldn't start the party. Check your connection and try again."
          : "Couldn't set up your wheel. Check your connection and try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!startsStraightAway) return;
    void handleCreate();
    // Once, when the screen opens; "Try again" below starts it again after a failure.
  }, [startsStraightAway]);

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
    } catch (error) {
      reportError(error, { screen: "WheelHome", action: "join_party" });
      setJoinError("Couldn't join the party. Check your connection and try again.");
    } finally {
      setJoining(false);
    }
  }

  if (startsStraightAway) {
    return (
      <Screen title="Your wheel" scroll={false}>
        <View style={{ alignItems: "center", gap: spacing[4], paddingTop: spacing[8] }}>
          {createError ? (
            <>
              <AppText accessibilityRole="alert" tone="accent" style={{ textAlign: "center" }}>
                {createError}
              </AppText>
              <Button label="Try again" onPress={() => void handleCreate()} loading={creating} />
            </>
          ) : (
            <>
              <ActivityIndicator color={palette.orange} />
              <AppText tone="secondary">Setting up your wheel…</AppText>
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Hungry Wheel">
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

        {!PARTY_ENABLED && route.params?.code ? (
          <Card style={{ backgroundColor: palette.bgSoft, borderColor: "transparent" }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="h3">Group spins are coming soon</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Invites from friends can&apos;t be opened yet. You can still spin the wheel on your
                own below.
              </AppText>
            </View>
          </Card>
        ) : null}

        {createError ? (
          <AppText accessibilityRole="alert" tone="accent" variant="bodySmall">
            {createError}
          </AppText>
        ) : null}

        {/* Create Party (solo spin when parties are off) - High Impact */}
        <Pressable
          onPress={handleCreate}
          disabled={creating}
          accessibilityRole="button"
          accessibilityLabel={PARTY_ENABLED ? "Host a party" : "Spin the wheel"}
        >
          <LinearGradient
            // The text runs across the whole card, so both stops must take 14 px white at 4.5:1:
            // plain orange is under it in both modes (accessibility-contrast.test.ts, MAP-12).
            colors={[palette.orangeControl, palette.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: componentRadii.button,
              padding: spacing[5],
              ...shadows.floating,
            }}
          >
            {colorScheme === "dark" ? (
              // Dark mode's orangeDark (#EA580C) is about 3.6:1 with white; the scrim fixes it.
              <View
                pointerEvents="none"
                testID="wheel-home-cta-scrim"
                style={{
                  backgroundColor: palette.mediaScrimSubtle,
                  borderRadius: componentRadii.button,
                  bottom: 0,
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <AppText variant="h2" style={{ color: palette.white }}>
                  {PARTY_ENABLED ? "Host a party" : "Spin the wheel"}
                </AppText>
                <AppText variant="bodySmall" style={{ color: palette.white }}>
                  {PARTY_ENABLED
                    ? "Start a new room and invite your friends to join the spin."
                    : "Add a few places and let the wheel decide."}
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

        {PARTY_ENABLED ? (
          <>
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
                Have a code?
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
                  label={joining ? "Joining..." : "Join the room"}
                  onPress={handleJoin}
                  disabled={joining}
                  variant="secondary"
                />
              </View>
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
