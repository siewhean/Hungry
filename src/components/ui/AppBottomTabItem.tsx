import { type ComponentType } from "react";
import { Pressable, View } from "react-native";
import type { LucideProps } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface AppBottomTabItemProps {
  label: string;
  icon: ComponentType<LucideProps>;
  focused?: boolean;
  createAction?: boolean;
  showLabel?: boolean;
  color?: string;
  onPress: () => void;
  onPressIn?: () => void;
  accessibilityLabel?: string;
}

export function AppBottomTabItem({
  label,
  icon: Icon,
  focused = false,
  createAction = false,
  showLabel = true,
  color,
  onPress,
  onPressIn,
  accessibilityLabel,
}: AppBottomTabItemProps) {
  const { componentSizes, palette, radii, spacing } = useHungryTheme();
  const resolvedColor = color ?? (focused ? palette.orange : palette.textMuted);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      style={{
        alignItems: "center",
        flex: 1,
        gap: spacing[0.5],
        justifyContent: "center",
      }}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View
        style={
          createAction
            ? {
                alignItems: "center",
                backgroundColor: palette.orange,
                borderRadius: radii.pill,
                height: componentSizes.bottomTabCreateButton,
                justifyContent: "center",
                width: componentSizes.bottomTabCreateButton,
              }
            : {
                alignItems: "center",
                height: componentSizes.bottomTabIconSlotHeight,
                justifyContent: "center",
                width: componentSizes.bottomTabIconSlotWidth,
              }
        }
      >
        <Icon
          color={createAction ? palette.white : resolvedColor}
          size={componentSizes.bottomTabIcon}
        />
      </View>
      {showLabel && !createAction ? (
        <AppText
          variant="micro"
          numberOfLines={1}
          style={{
            color: resolvedColor,
            fontSize: componentSizes.bottomTabLabelFontSize,
            fontWeight: focused ? "800" : "700",
            lineHeight: componentSizes.bottomTabLabelLineHeight,
          }}
        >
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}
