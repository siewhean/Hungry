import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, Switch } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { AppText } from "../ui";
import { useHungryTheme } from "@/theme";

interface SettingsRowProps {
  label: string;
  description?: string;
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
  description,
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

  // Handle row press even for toggle types
  const handlePress = () => {
    if (type === "toggle" && onToggle) {
      onToggle(!isEnabled);
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 56,
          backgroundColor: pressed ? palette.bgSoft : "transparent",
          paddingVertical: spacing[4],
          paddingHorizontal: spacing[4],
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: palette.border,
        },
      ]}
    >
      <View style={styles.left}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <AppText
          variant="body"
          style={{
            color: destructive ? palette.error : palette.text,
            fontWeight: "500",
            flexShrink: 1,
            flex: 1,
            flexWrap: "wrap",
          }}
        >
          {label}
        </AppText>
        {description ? (
          <AppText
            variant="bodySmall"
            tone="muted"
            style={[styles.description, { marginLeft: icon ? 36 : 0 }]}
          >
            {description}
          </AppText>
        ) : null}
      </View>

      <View style={styles.right}>
        {type === "value" && value ? (
          <AppText
            tone="secondary"
            style={[styles.valueText, styles.rightText]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {value}
          </AppText>
        ) : null}

        {type === "navigation" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {value ? (
              <AppText
                tone="secondary"
                style={[styles.valueText, styles.rightText]}
                numberOfLines={1}
              >
                {value}
              </AppText>
            ) : null}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    flexWrap: "wrap",
  },
  description: {
    flexBasis: "100%",
    marginTop: 2,
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
    flexShrink: 1,
    flexWrap: "wrap",
    minWidth: 0,
  },
  valueText: {
    fontSize: 14,
  },
  rightText: {
    textAlign: "right",
  },
});
