import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, Switch } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { AppText } from "../ui";
import { useHungryTheme } from "@/theme";

interface SettingsRowProps {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  value?: string;
  type?: "toggle" | "navigation" | "value";
  isEnabled?: boolean;
  onToggle?: (value: boolean) => void;
  isLast?: boolean;
  destructive?: boolean;
}

export function SettingsRow({
  label,
  icon,
  onPress,
  value,
  type = "navigation",
  isEnabled,
  onToggle,
  isLast = false,
  destructive = false,
}: SettingsRowProps) {
  const { palette, spacing } = useHungryTheme();

  // If it's a toggle, we don't want the whole row to be pressable in the same way
  const Container = type === "toggle" ? View : Pressable;

  return (
    <Container
      onPress={onPress}
      style={({ pressed }: any) => [
        styles.row,
        { 
          backgroundColor: pressed ? palette.bgSoft : "transparent",
          paddingVertical: spacing[4],
          paddingHorizontal: spacing[4],
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: palette.border,
        }
      ]}
    >
      <View style={styles.left}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <AppText 
          variant="body" 
          style={{ 
            color: destructive ? palette.error : palette.text,
            fontWeight: "500"
          }}
        >
          {label}
        </AppText>
      </View>

      <View style={styles.right}>
        {type === "value" && value ? (
          <AppText tone="secondary" style={styles.valueText}>{value}</AppText>
        ) : null}
        
        {type === "navigation" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {value ? <AppText tone="secondary" style={styles.valueText}>{value}</AppText> : null}
            <ChevronRight size={18} color={palette.textMuted} />
          </View>
        ) : null}

        {type === "toggle" ? (
          <Switch
            value={isEnabled}
            onValueChange={onToggle}
            trackColor={{ false: palette.border, true: palette.orange }}
            thumbColor={palette.white}
            ios_backgroundColor={palette.border}
          />
        ) : null}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrap: {
    marginRight: 12,
    width: 24,
    alignItems: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  valueText: {
    fontSize: 14,
  },
});
