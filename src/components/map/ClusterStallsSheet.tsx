import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppSymbol, AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export type ClusterStallRow = {
  id: string;
  name: string;
  /** "Open · Closes 9pm · 120 m" */
  detail?: string;
  /** "JW50 Hawker Centre · #01-23" */
  location?: string;
  accessibilityLabel: string;
};

type Props = {
  visible: boolean;
  /** How many stalls the pin stands for. */
  totalCount: number;
  stalls: readonly ClusterStallRow[];
  loading: boolean;
  onSelect: (stallId: string) => void;
  onClose: () => void;
};

/**
 * The stalls behind one map cluster, as a list to pick from. Stalls on the same spot cannot be
 * told apart by zooming, so tapping the cluster opens this instead.
 */
export function ClusterStallsSheet({
  visible,
  totalCount,
  stalls,
  loading,
  onSelect,
  onClose,
}: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const hidden = totalCount - stalls.length;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close stall list"
          onPress={onClose}
          style={{
            backgroundColor: palette.overlay,
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            maxHeight: "70%",
          }}
        >
          <View style={{ gap: spacing[1], padding: spacing[4], paddingBottom: spacing[2] }}>
            <AppText variant="h3" accessibilityRole="header">
              {`${totalCount} ${totalCount === 1 ? "stall" : "stalls"} here`}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Pick one to open it.
            </AppText>
          </View>
          {loading ? (
            <View style={{ alignItems: "center", padding: spacing[6] }}>
              <ActivityIndicator color={palette.orange} />
            </View>
          ) : (
            <ScrollView
              testID="cluster-stalls-list"
              contentContainerStyle={{
                gap: spacing[2],
                paddingBottom: spacing[4],
                paddingHorizontal: spacing[4],
              }}
            >
              {stalls.map((stall) => (
                <Pressable
                  key={stall.id}
                  accessibilityRole="button"
                  accessibilityLabel={stall.accessibilityLabel}
                  onPress={() => onSelect(stall.id)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: pressed ? palette.surfaceRaised : palette.bgSoft,
                    borderRadius: radii.md,
                    flexDirection: "row",
                    gap: spacing[3],
                    minHeight: 56,
                    padding: spacing[3],
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontWeight: "800" }} numberOfLines={1}>
                      {stall.name}
                    </AppText>
                    {stall.detail ? (
                      <AppText variant="micro" tone="secondary" numberOfLines={1}>
                        {stall.detail}
                      </AppText>
                    ) : null}
                    {stall.location ? (
                      <AppText variant="micro" tone="muted" numberOfLines={1}>
                        {stall.location}
                      </AppText>
                    ) : null}
                  </View>
                  <AppSymbol name="forward" color={palette.orange} size={16} />
                </Pressable>
              ))}
              {hidden > 0 ? (
                <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
                  {`Showing the nearest ${stalls.length}. Zoom in to see the other ${hidden}.`}
                </AppText>
              ) : null}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
