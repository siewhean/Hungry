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
  const { colorScheme, componentSizes, palette, radii, spacing } = useHungryTheme();
  // orangeText keeps the small active label above 4.5:1 (brand orange is 3.69:1 on white).
  const resolvedColor = color ?? (focused ? palette.orangeText : palette.textMuted);
  // White on the brighter dark-mode orange is only 2.8:1, so use the dark on-orange ink there.
  const createIconColor = colorScheme === "dark" ? palette.textOnOrange : palette.white;

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
      accessibilityRole={createAction ? "button" : "tab"}
      accessibilityState={createAction ? {} : { selected: focused }}
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
          color={createAction ? createIconColor : resolvedColor}
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
