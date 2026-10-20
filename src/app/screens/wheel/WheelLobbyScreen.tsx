import { useMemo, useState } from "react";
import { FlatList, Pressable, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Copy, List, Trash2, Users, Plus } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";

import { AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { MemberAvatarRow } from "@/components/wheel/MemberAvatarRow";
import { selectActiveWheelEntries, useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelEntry } from "@/types/domain";
import type { WheelStackParamList } from "./WheelStack";
import { WheelEntryAddSheet } from "./WheelEntryAddSheet";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelLobby">;

// Without parties (production) the lobby is a solo wheel: no invite code or member list.
const PARTY_ENABLED = FEATURE_FLAGS.wheelPartyEnabled;

export function WheelLobbyScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  const party = useWheelStore((s) => s.party);
  const members = useWheelStore((s) => s.members);
  const entries = useWheelStore((s) => s.entries);
  const myMemberId = useWheelStore((s) => s.myMemberId);
  const removeEntry = useWheelStore((s) => s.removeEntry);
  const leaveParty = useWheelStore((s) => s.leaveParty);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeEntries = useMemo(() => selectActiveWheelEntries(entries), [entries]);

  if (!party) {
    // Restored or deep-linked without a live party: offer a way back instead of a blank screen.
    return (
      <Screen title="Your wheel" subtitle="This wheel has ended" scroll={false}>
        <Button label="Start a new wheel" onPress={() => navigation.popTo("WheelHome")} />
      </Screen>
    );
  }

  const isHost = members.find((m) => m.id === myMemberId)?.isHost ?? false;
  const canSpin = activeEntries.length >= 2;

  async function copyCode() {
    await Clipboard.setStringAsync(party!.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSpin() {
    navigation.navigate("WheelSpin", { partyId: party!.id });
  }

  function handleLeave() {
    leaveParty();
    navigation.popToTop();
  }

  function renderEntry({ item }: { item: WheelEntry }) {
    const canRemove = isHost || item.addedByMemberId === myMemberId;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          gap: spacing[3],
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radii.pill,
            backgroundColor: palette.orange,
            ...shadows.card,
          }}
        />
        <AppText variant="bodyBold" style={{ flex: 1 }}>
          {item.label}
        </AppText>
        {canRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.label} from the wheel`}
            onPress={() => removeEntry(item.id)}
            hitSlop={8}
            style={{
              padding: spacing[2],
              backgroundColor: palette.bgSoft,
              borderRadius: radii.sm,
            }}
          >
            <Trash2 size={16} color={palette.error} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      <Screen
        title={PARTY_ENABLED ? "Party Lobby" : "Your wheel"}
        subtitle={
          PARTY_ENABLED ? "Invite friends and decide together" : "Add places, then spin to decide"
        }
        scroll={false}
      >
        {PARTY_ENABLED ? (
          <>
            {/* Animated Ticket-style Code Card */}
            <View style={{ marginBottom: spacing[6] }}>
              <LinearGradient
                colors={[palette.orange, palette.orangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: componentRadii.card,
                  padding: spacing[4],
                  flexDirection: "row",
                  alignItems: "center",
                  ...shadows.floating,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText
                    variant="micro"
                    style={{
                      color: palette.inverseTextSecondary,
                      fontWeight: "800",
                      textTransform: "uppercase",
                    }}
                  >
                    Active Party Code
                  </AppText>
                  <AppText
                    variant="display"
                    style={{
                      color: palette.white,
                      letterSpacing: 6,
                      marginTop: -4,
                    }}
                  >
                    {party.code}
                  </AppText>
                </View>
                <Pressable
                  onPress={copyCode}
                  accessibilityRole="button"
                  accessibilityLabel={copied ? "Party code copied" : "Copy party code"}
                  style={({ pressed }) => ({
                    backgroundColor: palette.inverseSurfaceSubtle,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderRadius: componentRadii.button,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Copy size={20} color={palette.white} />
                  <AppText
                    variant="micro"
                    style={{
                      color: palette.white,
                      fontWeight: "700",
                      marginTop: 4,
                    }}
                  >
                    {copied ? "COPIED" : "COPY"}
                  </AppText>
                </Pressable>
              </LinearGradient>
            </View>

            {/* Member section with better icons */}
            <View style={{ marginBottom: spacing[6] }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[2],
                  marginBottom: spacing[3],
                }}
              >
                <Users size={18} color={palette.orange} />
                <AppText variant="h3">
                  People in Room ({members.filter((m) => m.isPresent).length})
                </AppText>
              </View>
              <Card
                style={{
                  backgroundColor: palette.bgSoft,
                  borderColor: "transparent",
                }}
              >
                <MemberAvatarRow members={members} />
              </Card>
            </View>
          </>
        ) : null}

        {/* Entries list with custom header */}
        <View style={{ flex: 1, marginBottom: spacing[6] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: spacing[2],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
              }}
            >
              <List size={18} color={palette.orange} />
              <AppText variant="h3">Options</AppText>
            </View>
            {/* Solo wheels are always classic, so the mode badge only shows when it says something. */}
            {PARTY_ENABLED || party.spinMode !== "classic" ? (
              <Badge
                label={party.spinMode === "classic" ? "Classic mode" : "Elimination mode"}
                tone="orange"
              />
            ) : null}
          </View>

          <Card
            style={{
              flex: 1,
              padding: 0,
              overflow: "hidden",
              borderStyle: "dashed",
              borderWidth: 1.5,
              borderColor: palette.border,
            }}
          >
            <FlatList
              data={activeEntries}
              keyExtractor={(item) => item.id}
              renderItem={renderEntry}
              contentContainerStyle={{ flexGrow: 1 }}
              ListEmptyComponent={
                <EmptyState
                  title="The wheel is empty"
                  body="Add some spots to start the party."
                  icon={<Plus size={36} color={palette.textMuted} />}
                />
              }
            />
          </Card>
        </View>

        {/* Actions - Unified bottom bar */}
        <View style={{ gap: spacing[3], paddingBottom: spacing[2] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              label="Add Option"
              onPress={() => setAddSheetOpen(true)}
              variant="secondary"
              style={{ flex: 1 }}
              leftIcon={<Plus size={20} color={palette.text} />}
            />
            {isHost && (
              <Button
                label="Spin Wheel"
                onPress={handleSpin}
                disabled={!canSpin}
                style={{ flex: 1.5 }}
              />
            )}
          </View>

          {!isHost && (
            <View
              style={{
                backgroundColor: palette.bgSoft,
                padding: spacing[3],
                borderRadius: radii.md,
                alignItems: "center",
              }}
            >
              <AppText variant="bodySmall" tone="secondary">
                Waiting for the host to start the spin…
              </AppText>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleLeave}
            style={{ padding: spacing[2] }}
          >
            <AppText
              variant="bodySmallBold"
              tone="muted"
              style={{
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {PARTY_ENABLED ? "Leave Party" : "Close wheel"}
            </AppText>
          </Pressable>
        </View>
      </Screen>

      <WheelEntryAddSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} />
    </>
  );
}
