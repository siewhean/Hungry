import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHungryTheme } from "@/theme";

interface FABProps {
  position?: "bottomTrailing" | "bottomCenter" | "bottomLeading";
  style?: StyleProp<ViewStyle>;
  offset?: number;
}

export function FAB({
  children,
  position = "bottomTrailing",
  style,
  offset,
}: PropsWithChildren<FABProps>) {
  const { spacing, zIndex } = useHungryTheme();
  const insets = useSafeAreaInsets();
  
  const bottomOffset = (offset ?? spacing[5]) + insets.bottom;

  const positionStyle: ViewStyle = {
    bottom: bottomOffset,
  };

  if (position === "bottomTrailing") {
    positionStyle.right = spacing[5];
  } else if (position === "bottomLeading") {
    positionStyle.left = spacing[5];
  } else if (position === "bottomCenter") {
    positionStyle.left = spacing[5];
    positionStyle.right = spacing[5];
    positionStyle.alignItems = "center";
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { zIndex: zIndex.fab },
        positionStyle,
        style,
      ]}
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
