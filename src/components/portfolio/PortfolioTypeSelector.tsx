import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { PortfolioType } from "@/types/domain";

const PORTFOLIO_TYPES: PortfolioType[] = ["recommendation", "ranking", "trail", "collection"];

interface PortfolioTypeSelectorProps {
  value: PortfolioType;
  onChange: (value: PortfolioType) => void;
}

export function PortfolioTypeSelector({ value, onChange }: PortfolioTypeSelectorProps) {
  return <OptionRow values={PORTFOLIO_TYPES} activeValue={value} onSelect={onChange} />;
}

function OptionRow<T extends string>({
  values,
  activeValue,
  onSelect,
}: {
  values: T[];
  activeValue: T;
  onSelect: (value: T) => void;
}) {
  const { palette } = useHungryTheme();
  return (
    <View style={styles.optionRow}>
      {values.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ checked: activeValue === option }}
          accessibilityLabel={option.replaceAll("_", " ")}
          onPress={() => onSelect(option)}
          style={[
            styles.option,
            {
              backgroundColor: activeValue === option ? palette.orangeLight : palette.surfaceRaised,
              borderColor: activeValue === option ? palette.orange : palette.border,
            },
          ]}
        >
          <AppText variant="bodySmallBold" tone={activeValue === option ? "accent" : "secondary"}>
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
