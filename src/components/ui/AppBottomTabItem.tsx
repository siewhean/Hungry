import { type ComponentType } from "react";
import { Pressable, View } from "react-native";
import type { LucideProps } from "lucide-react-native";

import { selectHaptic } from "@/lib/haptics";
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
  const { componentSizes, fontScaling, palette, spacing } = useHungryTheme();
  // orangeText keeps the small active label above 4.5:1 (brand orange is 3.69:1 on white).
  const resolvedColor = color ?? (focused ? palette.orangeText : palette.textMuted);
  // The icon only needs 3:1, so the selected glyph uses the brand orange as an outline.
  const iconColor = color ?? (focused ? palette.orange : palette.textMuted);

  return (
    <Pressable
      onPress={() => {
        // Going to a tab you are already on stays quiet.
        if (!focused || createAction) selectHaptic();
        onPress();
      }}
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
      {({ pressed }) => (
        <>
          <View
            style={{
              alignItems: "center",
              height: createAction
                ? componentSizes.bottomTabCreateButton
                : componentSizes.bottomTabIconSlotHeight,
              justifyContent: "center",
              width: componentSizes.bottomTabIconSlotWidth,
            }}
          >
            {/* Outline glyph only: the write button turns orange while it is pressed. */}
            <Icon
              color={createAction ? (pressed ? palette.orange : palette.text) : iconColor}
              size={createAction ? componentSizes.bottomTabIcon + 4 : componentSizes.bottomTabIcon}
            />
          </View>
          {showLabel && !createAction ? (
            <AppText
              variant="micro"
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaling.tabLabelMaxMultiplier}
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
        </>
      )}
    </Pressable>
  );
}
