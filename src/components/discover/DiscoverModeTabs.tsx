import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

export type DiscoverMode = "forYou" | "here";

const OPTIONS: readonly { id: DiscoverMode; label: string }[] = [
  { id: "here", label: "What's here" },
  { id: "forYou", label: "For you" },
];

interface DiscoverModeTabsProps {
  value: DiscoverMode;
  onChange: (mode: DiscoverMode) => void;
}

/** The two views of a mall: everything that is here, or what suits this diner. */
export function DiscoverModeTabs({ value, onChange }: DiscoverModeTabsProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", gap: spacing[2] }}
      testID="discover-mode-tabs"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              selectHaptic();
              onChange(option.id);
            }}
            style={{
              alignItems: "center",
              backgroundColor: selected ? palette.orange : palette.surface,
              borderColor: selected ? palette.orange : palette.border,
              borderRadius: componentRadii.button,
              borderWidth: 1,
              flex: 1,
              justifyContent: "center",
              minHeight: 48,
            }}
          >
            <AppText
              variant="bodyBold"
              style={{ color: selected ? palette.textOnOrange : palette.text }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
