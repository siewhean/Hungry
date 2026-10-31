import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Copy, List, Trash2, Users, Plus } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";

import { AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { MemberAvatarRow } from "@/components/wheel/MemberAvatarRow";
import { getWheelSliceColors } from "@/components/wheel/WheelSvg";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { isExperimentAssignmentReady, useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { leaveWheelStack } from "@/features/wheel/leaveWheel";
import { loadWheelPrefill } from "@/features/wheel/loadPrefill";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
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
  const triggerSpin = useWheelStore((s) => s.triggerSpin);

  const addEntry = useWheelStore((s) => s.addEntry);
  const profile = useProfileStore((s) => s.profile);
  const locationPermission = useLocationStore((s) => s.permission);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const manualCoordinate = useLocationStore((s) => s.manualCoordinate);
  const { coordinate: origin, isApproximate } = getEffectiveLocation({
    permission: locationPermission,
    currentLocation,
    manualCoordinate,
  });

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // MD-W2: a new wheel starts with the nearest open stalls instead of an empty list.
  const [prefilling, setPrefilling] = useState(false);
  const [prefilledCount, setPrefilledCount] = useState(0);
  // Stalls added while closed (late at night), by venue id, with when they open.
  const [opensAtByVenue, setOpensAtByVenue] = useState<Record<string, string>>({});
  // The prefill ran and nothing near the diner is open: say so, rather than a bare empty wheel.
  const [prefillFoundNone, setPrefillFoundNone] = useState(false);
  const prefillStarted = useRef(false);
  const isHostMember = members.find((m) => m.id === myMemberId)?.isHost ?? false;
  const partyId = party?.id;
  const prefillEligible = Boolean(partyId) && isHostMember && !isApproximate;
  const prefillVariant = useExperimentVariant("wheel_prefill_v1", { enabled: prefillEligible });
  const prefillReady = isExperimentAssignmentReady("wheel_prefill_v1");
  useEffect(() => {
    // Once per wheel, for its host, and only where "nearby" means something: a guessed location
    // would fill the wheel with stalls that are not near the diner.
    if (!partyId || !isHostMember || isApproximate || prefillStarted.current) return;
    // Wait for the arm (wheel_prefill_v1) so a late flag load cannot fill a control wheel.
    if (!prefillReady) return;
    prefillStarted.current = true;
    if (prefillVariant === "control") return;
    if (useWheelStore.getState().entries.length > 0) return;
    let active = true;
    setPrefilling(true);
    loadWheelPrefill({
      origin,
      dietaryFlags: profile.dietaryPreferences,
      tasteVector: profile.tasteVector,
    })
      .then((stalls) => {
        // The diner got ahead of it by adding a stall themselves: leave their wheel alone.
        if (!active || useWheelStore.getState().entries.length > 0) return;
        for (const stall of stalls) {
          addEntry(stall.venueId, stall.buildingId, stall.label, stall.imageUrl, "prefill");
        }
        setPrefilledCount(stalls.length);
        setOpensAtByVenue(
          Object.fromEntries(
            stalls.flatMap((stall) => (stall.opensAt ? [[stall.venueId, stall.opensAt]] : [])),
          ),
        );
        setPrefillFoundNone(stalls.length === 0);
        trackAnalyticsEvent("wheel_prefilled", { party_id: partyId, count: stalls.length });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "WheelLobby", action: "prefill" });
      })
      .finally(() => {
        if (active) setPrefilling(false);
      });
    return () => {
      active = false;
    };
    // The origin and profile are read once, when the wheel opens.
  }, [partyId, isHostMember, isApproximate, prefillReady, prefillVariant]);

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
  // MD-W4: a disabled Spin says what it is waiting for.
  const spinLabel = canSpin
    ? "Spin wheel"
    : activeEntries.length === 1
      ? "Add one more to spin"
      : "Add two to spin";

  // "We added 3 open stalls", or, late at night, "We added 1 open stall and 3 that open soon".
  const soonCount = Object.keys(opensAtByVenue).length;
  const openCount = prefilledCount - soonCount;
  const prefillNote = `We added ${
    openCount === 0
      ? `${soonCount} ${soonCount === 1 ? "stall that opens" : "stalls that open"} soon`
      : soonCount === 0
        ? `${openCount} open ${openCount === 1 ? "stall" : "stalls"}`
        : `${openCount} open ${openCount === 1 ? "stall" : "stalls"} and ${soonCount} that open soon`
  } near you. Remove any you don't fancy, or add your own.`;

  async function copyCode() {
    await Clipboard.setStringAsync(party!.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSpin() {
    // Start the spin now: the spin screen animates it on arrival, so it is one tap, not two.
    triggerSpin();
    navigation.navigate("WheelSpin", { partyId: party!.id });
  }

  function handleLeave() {
    // WheelStack clears the party when it closes; popToTop would only land back here.
    leaveWheelStack(navigation);
  }

  function renderEntry({ item, index }: { item: WheelEntry; index: number }) {
    const canRemove = isHost || item.addedByMemberId === myMemberId;
    // The dot is the colour of this option's slice on the wheel.
    const slice = getWheelSliceColors(palette, index, activeEntries.length);
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
            backgroundColor: slice.fill,
            borderColor: palette.orange,
            borderWidth: 1,
          }}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyBold">{item.label}</AppText>
          {opensAtByVenue[item.venueId] ? (
            <AppText variant="micro" tone="secondary">
              {`Closed now · ${opensAtByVenue[item.venueId]}`}
            </AppText>
          ) : null}
        </View>
        {canRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.label} from the wheel`}
            onPress={() => removeEntry(item.id)}
            // 32 pt of icon button plus 6 pt each side reaches the 44 pt minimum target.
            hitSlop={6}
            style={{
              padding: spacing[2],
              minHeight: 32,
              minWidth: 32,
              alignItems: "center",
              justifyContent: "center",
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
        title={PARTY_ENABLED ? "Party lobby" : "Your wheel"}
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
                    }}
                  >
                    Active party code
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
                    {copied ? "Copied" : "Copy"}
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
              ListHeaderComponent={
                prefilledCount > 0 ? (
                  <AppText
                    variant="bodySmall"
                    tone="secondary"
                    style={{ padding: spacing[3], paddingBottom: 0 }}
                  >
                    {prefillNote}
                  </AppText>
                ) : null
              }
              ListEmptyComponent={
                prefilling ? (
                  <View
                    accessible
                    accessibilityLabel="Finding open stalls near you"
                    accessibilityLiveRegion="polite"
                    style={{ alignItems: "center", gap: spacing[3], padding: spacing[8] }}
                  >
                    <ActivityIndicator color={palette.orange} />
                    <AppText tone="secondary">Finding open stalls near you…</AppText>
                  </View>
                ) : (
                  <EmptyState
                    title="The wheel is empty"
                    body={
                      prefillFoundNone
                        ? "No stalls near you are open right now. Add a few spots yourself."
                        : PARTY_ENABLED
                          ? "Add some spots to start the party."
                          : "Add some spots, then spin to decide."
                    }
                    icon={<Plus size={36} color={palette.textMuted} />}
                  />
                )
              }
            />
          </Card>
        </View>

        {/* Actions - Unified bottom bar */}
        <View style={{ gap: spacing[3], paddingBottom: spacing[2] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              label="Add option"
              onPress={() => setAddSheetOpen(true)}
              variant="secondary"
              style={{ flex: 1 }}
              leftIcon={<Plus size={20} color={palette.text} />}
            />
            {isHost && (
              <Button
                label={spinLabel}
                onPress={handleSpin}
                disabled={!canSpin}
                style={{ flex: 1 }}
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
                letterSpacing: 1,
              }}
            >
              {PARTY_ENABLED ? "Leave party" : "Close wheel"}
            </AppText>
          </Pressable>
        </View>
      </Screen>

      <WheelEntryAddSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} />
    </>
  );
}
