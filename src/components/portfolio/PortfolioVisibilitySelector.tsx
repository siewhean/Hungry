import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import {
  PORTFOLIO_VISIBILITY_DESCRIPTIONS,
  PORTFOLIO_VISIBILITY_LABELS,
} from "@/features/checklistPortfolio/listLabels";
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
    <View accessibilityRole="radiogroup" style={styles.group}>
      {VISIBILITIES.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={PORTFOLIO_VISIBILITY_LABELS[option]}
            accessibilityHint={PORTFOLIO_VISIBILITY_DESCRIPTIONS[option]}
            onPress={() => onChange(option)}
            style={[
              styles.option,
              {
                backgroundColor: active ? palette.orangeLight : palette.surfaceRaised,
                borderColor: active ? palette.orange : palette.border,
              },
            ]}
          >
            <AppText variant="bodySmallBold" tone={active ? "accent" : "secondary"}>
              {PORTFOLIO_VISIBILITY_LABELS[option]}
            </AppText>
            <AppText variant="micro" tone="secondary">
              {PORTFOLIO_VISIBILITY_DESCRIPTIONS[option]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  option: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
