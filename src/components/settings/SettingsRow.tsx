import type { ReactNode } from "react";
import { Pressable, View, Switch } from "react-native";
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
  disabled?: boolean;
  busy?: boolean;
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
  disabled = false,
  busy = false,
}: SettingsRowProps) {
  const { palette, spacing } = useHungryTheme();
  const actionable = type !== "value" && (type === "toggle" ? Boolean(onToggle) : Boolean(onPress));
  const inactive = disabled || busy || !actionable;
  return (
    <Pressable
      accessible={actionable}
      accessibilityRole={type === "toggle" ? "switch" : actionable ? "button" : undefined}
      accessibilityLabel={[label, value, description].filter(Boolean).join(". ")}
      accessibilityState={{
        disabled: inactive,
        busy,
        ...(type === "toggle" ? { checked: Boolean(isEnabled) } : {}),
      }}
      disabled={inactive}
      onPress={() => (type === "toggle" ? onToggle?.(!isEnabled) : onPress?.())}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: spacing[12],
        backgroundColor: pressed ? palette.bgSoft : "transparent",
        padding: spacing[4],
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border,
        opacity: disabled || busy ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          {icon ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {icon}
            </View>
          ) : null}
          <AppText
            style={{
              color: destructive ? palette.error : palette.text,
              fontWeight: "500",
              flexShrink: 1,
            }}
          >
            {label}
          </AppText>
        </View>
        {description ? (
          <AppText variant="bodySmall" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <View
        style={{ marginLeft: spacing[4], flexShrink: 1, maxWidth: "55%" }}
        pointerEvents="none"
        accessibilityElementsHidden={actionable}
        importantForAccessibility={actionable ? "no-hide-descendants" : "auto"}
      >
        {type === "toggle" ? (
          <Switch
            accessible={false}
            value={Boolean(isEnabled)}
            disabled={inactive}
            trackColor={{ false: palette.border, true: palette.orange }}
            thumbColor={palette.white}
            ios_backgroundColor={palette.border}
          />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            {value ? (
              <AppText
                tone="secondary"
                style={{ textAlign: "right", flexShrink: 1 }}
                numberOfLines={2}
              >
                {value}
              </AppText>
            ) : null}
            {type === "navigation" && actionable ? (
              <ChevronRight size={18} color={palette.textMuted} />
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
