import type { PropsWithChildren } from "react";
import { View, StyleSheet } from "react-native";
import { AppText } from "../ui";
import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";

interface SettingsSectionProps {
  title?: string;
  description?: string;
  editorial?: boolean;
}

export function SettingsSection({
  title,
  description,
  editorial = false,
  children,
}: PropsWithChildren<SettingsSectionProps>) {
  const { componentRadii, spacing, palette } = useHungryTheme();

  return (
    <View style={{ marginBottom: spacing[6] }}>
      {title ? (
        <AppText
          variant={editorial ? "h2" : "micro"}
          accessibilityRole="header"
          style={editorial ? { marginBottom: spacing[2], color: palette.text } : styles.title}
        >
          {title}
        </AppText>
      ) : null}

      <View
        style={[
          styles.content,
          {
            backgroundColor: palette.surface,
            borderColor: editorial ? palette.surface : palette.border,
            borderRadius: componentRadii.card,
          },
        ]}
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
    // Visual only: screen readers read the title as written, not letter by letter.
    textTransform: "uppercase",
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
