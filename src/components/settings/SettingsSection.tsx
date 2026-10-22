import type { PropsWithChildren } from "react";
import { View, StyleSheet } from "react-native";
import { AppText } from "../ui";
import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";

interface SettingsSectionProps {
  title?: string;
  description?: string;
}

export function SettingsSection({
  title,
  description,
  children,
}: PropsWithChildren<SettingsSectionProps>) {
  const { componentRadii, spacing, palette } = useHungryTheme();

  return (
    <View style={{ marginBottom: spacing[6] }}>
      {title ? (
        <AppText accessibilityRole="header" variant="micro" tone="secondary" style={styles.title}>
          {title.toUpperCase()}
        </AppText>
      ) : null}

      <View
        style={[styles.content, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        {children}
      </View>

      {description ? (
        <AppText variant="micro" tone="muted" style={styles.description}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingLeft: 16,
    marginBottom: 8,
    letterSpacing: 1,
    fontWeight: "700",
  },
  content: {
    borderRadius: componentRadii.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  description: {
    paddingHorizontal: 16,
    marginTop: 8,
    lineHeight: 16,
  },
});
