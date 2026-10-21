import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import {
  PORTFOLIO_TYPE_DESCRIPTIONS,
  PORTFOLIO_TYPE_LABELS,
} from "@/features/checklistPortfolio/listLabels";
import { useHungryTheme } from "@/theme";
import type { PortfolioType } from "@/types/domain";

const PORTFOLIO_TYPES: PortfolioType[] = ["recommendation", "ranking", "trail", "collection"];

interface PortfolioTypeSelectorProps {
  value: PortfolioType;
  onChange: (value: PortfolioType) => void;
}

export function PortfolioTypeSelector({ value, onChange }: PortfolioTypeSelectorProps) {
  const { palette } = useHungryTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {PORTFOLIO_TYPES.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={PORTFOLIO_TYPE_LABELS[option]}
            accessibilityHint={PORTFOLIO_TYPE_DESCRIPTIONS[option]}
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
              {PORTFOLIO_TYPE_LABELS[option]}
            </AppText>
            <AppText variant="micro" tone="secondary">
              {PORTFOLIO_TYPE_DESCRIPTIONS[option]}
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
