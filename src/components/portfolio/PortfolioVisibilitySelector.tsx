import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { PortfolioVisibility } from "@/types/domain";

const VISIBILITIES: PortfolioVisibility[] = ["private", "followers_only", "public"];

interface PortfolioVisibilitySelectorProps {
  value: PortfolioVisibility;
  onChange: (value: PortfolioVisibility) => void;
}

export function PortfolioVisibilitySelector({ value, onChange }: PortfolioVisibilitySelectorProps) {
  const { palette } = useHungryTheme();
  return (
    <View style={styles.optionRow}>
      {VISIBILITIES.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === option }}
          accessibilityLabel={option.replaceAll("_", " ")}
          onPress={() => onChange(option)}
          style={[
            styles.option,
            {
              backgroundColor: value === option ? palette.orangeLight : palette.surfaceRaised,
              borderColor: value === option ? palette.orange : palette.border,
            },
          ]}
        >
          <AppText variant="bodySmallBold" tone={value === option ? "accent" : "secondary"}>
            {option.replaceAll("_", " ")}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
