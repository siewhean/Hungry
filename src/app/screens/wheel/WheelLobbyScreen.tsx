import { useState } from "react";
import { FlatList, Pressable, Share, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Copy, Trash2, PlusCircle, Play } from "lucide-react-native";

import { AppText, Badge, Button, Card, Screen, Chip } from "@/components/ui";
import { MemberAvatarRow } from "@/components/wheel/MemberAvatarRow";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { WheelEntry } from "@/types/domain";
import type { WheelStackParamList } from "./WheelStack";
import { WheelEntryAddSheet } from "./WheelEntryAddSheet";

type Props = NativeStackScreenProps<WheelStackParamList, "WheelLobby">;

export function WheelLobbyScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const party = useWheelStore((s) => s.party);
  const members = useWheelStore((s) => s.members);
  const entries = useWheelStore((s) => s.entries);
  const myMemberId = useWheelStore((s) => s.myMemberId);
  const removeEntry = useWheelStore((s) => s.removeEntry);
  const leaveParty = useWheelStore((s) => s.leaveParty);
  const updateEntryLimit = useWheelStore((s) => s.updateEntryLimit);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!party) return null;

  const isHost = members.find((m) => m.id === myMemberId)?.isHost ?? false;
  const activeEntries = entries.filter((e) => !e.isEliminated);
  const canSpin = activeEntries.length >= 2;

  async function copyCode() {
    await Share.share({ message: `Join my Hungry Wheel party! Code: ${party!.code}` });
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
          paddingHorizontal: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          gap: spacing[3],
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: palette.orange,
          }}
        />
        <AppText variant="body" style={{ flex: 1 }}>
          {item.label}
        </AppText>
        {canRemove && (
          <Pressable
            onPress={() => removeEntry(item.id)}
            hitSlop={8}
            style={{ padding: spacing[1] }}
          >
            <Trash2 size={16} color={palette.textMuted} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      <Screen title="Party lobby" subtitle={`Share code ${party.code} to invite friends`} scroll={false}>
        {/* Code row */}
        <Card style={{ marginBottom: spacing[4] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <AppText variant="micro" tone="secondary" style={{ textTransform: "uppercase" }}>
                Party code
              </AppText>
              <AppText variant="h1" style={{ color: palette.orange, letterSpacing: 4 }}>
                {party.code}
              </AppText>
            </View>
            <Pressable
              onPress={copyCode}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                backgroundColor: palette.orangeLight,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: radii.pill,
              }}
            >
              <Copy size={14} color={palette.orange} />
              <AppText variant="bodySmall" style={{ color: palette.orange }}>
                {copied ? "Copied!" : "Copy"}
              </AppText>
            </Pressable>
          </View>
        </Card>

        {/* Members */}
        <View style={{ marginBottom: spacing[4], gap: spacing[2] }}>
          <AppText variant="h3">
            {members.filter((m) => m.isPresent).length} in the room
          </AppText>
          <MemberAvatarRow members={members} />
        </View>

        {/* Host Controls: Entry Limit */}
        {isHost && (
          <Card style={{ marginBottom: spacing[4], padding: spacing[3] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 2, flex: 1 }}>
                <AppText style={{ fontWeight: "700" }}>Entries per Person</AppText>
                <AppText variant="micro" tone="secondary">Prevent any member from dominating the wheel</AppText>
              </View>
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                {[3, 5, 0].map((limit) => (
                  <Chip
                    key={limit}
                    label={limit === 0 ? "Any" : limit.toString()}
                    selected={(party.maxEntriesPerMember ?? 0) === limit}
                    onPress={() => updateEntryLimit(limit)}
                  />
                ))}
              </View>
            </View>
          </Card>
        )}

        {/* Entries list */}
        <Card style={{ flex: 1, padding: 0, overflow: "hidden", marginBottom: spacing[4] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing[4],
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <AppText variant="h3">Options ({activeEntries.length})</AppText>
            <Badge
              label={party.spinMode === "classic" ? "Classic" : "Elimination"}
              tone="orange"
            />
          </View>
          <FlatList
            data={activeEntries}
            keyExtractor={(item) => item.id}
            renderItem={renderEntry}
            ListEmptyComponent={
              <View style={{ padding: spacing[6], alignItems: "center" }}>
                <AppText tone="secondary" style={{ textAlign: "center" }}>
                  No options yet. Add your favourite spots!
                </AppText>
              </View>
            }
          />
        </Card>

        {/* Actions */}
        <View style={{ gap: spacing[3] }}>
          <Button 
            label="Add Option" 
            onPress={() => setAddSheetOpen(true)} 
            variant="secondary" 
            leftIcon={<PlusCircle size={18} color={palette.text} />}
          />
          {isHost && (
            <Button
              label="Spin the Wheel"
              onPress={handleSpin}
              disabled={!canSpin}
              variant="primary"
              leftIcon={<Play size={18} color={canSpin ? palette.orange : palette.textMuted} />}
            />
          )}
          {!isHost && (
            <View style={{ backgroundColor: palette.bgSoft, paddingVertical: spacing[3], borderRadius: radii.md, alignItems: "center" }}>
              <AppText variant="bodySmall" tone="secondary" style={{ fontWeight: "600" }}>
                Waiting for the host to start the spin…
              </AppText>
            </View>
          )}
          <Pressable onPress={handleLeave} style={{ paddingVertical: spacing[2] }}>
            <AppText variant="bodySmall" tone="accent" style={{ textAlign: "center", fontWeight: "700" }}>
              LEAVE PARTY
            </AppText>
          </Pressable>
        </View>
      </Screen>

      <WheelEntryAddSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
      />
    </>
  );
}
