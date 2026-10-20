import { memo, type ReactNode } from "react";
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
  /** Marks a running action (announced as busy and not pressable). */
  busy?: boolean;
}

export const SettingsRow = memo(function SettingsRow({
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
  busy = false,
}: SettingsRowProps) {
  const { palette, spacing } = useHungryTheme();
  const isToggle = type === "toggle";
  // Rows without an action only show a value, so they are not buttons.
  const isInteractive = isToggle ? Boolean(onToggle) : Boolean(onPress);

  // Handle row press even for toggle types
  const handlePress = () => {
    if (type === "toggle" && onToggle) {
      onToggle(!isEnabled);
    } else if (onPress) {
      onPress();
    }
  };

  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    minHeight: 56,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: isLast ? 0 : 1,
    borderBottomColor: palette.border,
  };

  const content = (
    <>
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
            disabled={busy}
            // The off track uses textMuted so it keeps 3:1 against the row (WCAG 1.4.11).
            trackColor={{ false: palette.textMuted, true: palette.orange }}
            thumbColor={palette.white}
            ios_backgroundColor={palette.textMuted}
            // The row itself is the accessible switch; avoid a second, unlabeled control.
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
      </View>
    </>
  );

  if (!isInteractive) {
    return (
      <View
        accessible
        accessibilityLabel={[label, value, description].filter(Boolean).join(", ")}
        style={rowStyle}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole={isToggle ? "switch" : "button"}
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityValue={!isToggle && value ? { text: value } : undefined}
      accessibilityState={
        isToggle ? { checked: Boolean(isEnabled), busy } : { busy, disabled: busy }
      }
      style={({ pressed }) => [
        rowStyle,
        { backgroundColor: pressed ? palette.bgSoft : "transparent" },
      ]}
    >
      {content}
    </Pressable>
  );
});

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
