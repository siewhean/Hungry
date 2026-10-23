import { Switch, View, type StyleProp, type ViewStyle } from "react-native";

import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface FormSwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

export function FormSwitchRow({
  label,
  description,
  value,
  onValueChange,
  style,
}: FormSwitchRowProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  return (
    <View
      style={[
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[3],
          justifyContent: "space-between",
          padding: spacing[4],
        },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: spacing[0.5] }}>
        <AppText variant="bodyBold">{label}</AppText>
        {description ? (
          <AppText variant="bodySmall" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={(next) => {
          selectHaptic();
          onValueChange(next);
        }}
        trackColor={{ false: palette.border, true: palette.orange }}
        thumbColor={palette.white}
        ios_backgroundColor={palette.border}
      />
    </View>
  );
}
