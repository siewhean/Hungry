import { useEffect, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHungryTheme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Read out when the pop-up opens. */
  label: string;
  /** The card itself: bring its own surface, border and padding. */
  children: ReactNode;
};

/**
 * A pop-up over the page for details a diner asked for (a stamp, an achievement): a centred card on
 * a dim backdrop. A tap outside it, or the system back gesture, closes it; a tall card scrolls.
 */
export function InfoPopup({ visible, onClose, label, children }: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (visible) AccessibilityInfo.announceForAccessibility(label);
  }, [label, visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.overlay, { backgroundColor: palette.overlay, padding: spacing[4] }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss pop-up"
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { maxHeight: height - insets.top - insets.bottom - spacing[8] }]}
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center" },
  card: { alignSelf: "center", maxWidth: 420, width: "100%" },
});
