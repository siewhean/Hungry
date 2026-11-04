import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";

import {
  activeChoiceSheetHostId,
  notifyChoiceSheetClosed,
  registerChoiceSheetHost,
  subscribeChoiceSheetHosts,
  useChoiceSheetStore,
  type ChoiceRequest,
} from "@/store/useChoiceSheetStore";
import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { DismissibleSheet } from "./DismissibleSheet";

/**
 * Shows whatever `askChoice` asked, in the app's own bottom sheet. Mounted near the root, and
 * again inside any card (the Post card): iOS cannot present a sheet from the root while a card
 * covers it, so the newest host is the one that shows it.
 * It keeps the last question while the sheet slides away so the options do not vanish mid-way.
 */
export function ChoiceSheetHost() {
  const [hostId, setHostId] = useState<number | null>(null);
  useEffect(() => {
    const host = registerChoiceSheetHost();
    setHostId(host.id);
    return host.unregister;
  }, []);
  const activeId = useSyncExternalStore(
    subscribeChoiceSheetHosts,
    activeChoiceSheetHostId,
    activeChoiceSheetHostId,
  );
  if (hostId === null || hostId !== activeId) return null;
  return <ActiveChoiceSheet />;
}

function ActiveChoiceSheet() {
  const { palette, radii, spacing } = useHungryTheme();
  const request = useChoiceSheetStore((state) => state.request);
  const settle = useChoiceSheetStore((state) => state.settle);
  const [shown, setShown] = useState<ChoiceRequest | null>(null);

  useEffect(() => {
    if (request) setShown(request);
  }, [request]);

  if (!shown) return null;
  return (
    <DismissibleSheet
      visible={request !== null}
      onClose={() => settle(null)}
      onClosed={notifyChoiceSheetClosed}
      closeLabel="Close"
      maxHeightRatio={0.6}
      header={
        <View style={{ gap: spacing[1], padding: spacing[4], paddingBottom: spacing[2] }}>
          <AppText variant="h3" accessibilityRole="header">
            {shown.title}
          </AppText>
          {shown.message ? (
            <AppText variant="bodySmall" tone="secondary">
              {shown.message}
            </AppText>
          ) : null}
        </View>
      }
    >
      <View style={{ gap: spacing[2], paddingBottom: spacing[2], paddingHorizontal: spacing[4] }}>
        {shown.options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => settle(option.id)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: pressed ? palette.surfaceRaised : palette.bgSoft,
              borderRadius: radii.md,
              justifyContent: "center",
              minHeight: 52,
              paddingHorizontal: spacing[4],
            })}
          >
            <AppText
              style={{
                color: option.destructive ? palette.error : palette.text,
                fontWeight: "700",
              }}
            >
              {option.label}
            </AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => settle(null)}
          style={{ alignItems: "center", justifyContent: "center", minHeight: 48 }}
        >
          <AppText tone="secondary" style={{ fontWeight: "700" }}>
            Cancel
          </AppText>
        </Pressable>
      </View>
    </DismissibleSheet>
  );
}
