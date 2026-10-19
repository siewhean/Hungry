import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

interface FABProps {
  position?: "bottomTrailing" | "bottomLeading" | "bottomCenter";
  style?: StyleProp<ViewStyle>;
  offset?: number;
}

export function FAB({ children, position, style, offset }: PropsWithChildren<FABProps>) {
  const { spacing, zIndex } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const leftHandedMode = useUIStore((state) => state.leftHandedMode);

  // Default to Trailing if right-handed, Leading if left-handed
  const effectivePosition = position ?? (leftHandedMode ? "bottomLeading" : "bottomTrailing");

  const bottomOffset = (offset ?? spacing[5]) + insets.bottom;

  const positionStyle: ViewStyle = {
    bottom: bottomOffset,
  };

  if (effectivePosition === "bottomTrailing") {
    positionStyle.right = spacing[5];
  } else if (effectivePosition === "bottomLeading") {
    positionStyle.left = spacing[5];
  } else if (effectivePosition === "bottomCenter") {
    positionStyle.left = spacing[5];
    positionStyle.right = spacing[5];
    positionStyle.alignItems = "center";
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { zIndex: zIndex.fab }, positionStyle, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignItems: "flex-end",
    gap: 12,
  },
});
