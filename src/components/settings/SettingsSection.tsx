import { useState, type PropsWithChildren } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { AppText } from "../ui";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";

interface SettingsSectionProps {
  title?: string;
  description?: string;
  editorial?: boolean;
  /** The title becomes a button that folds and unfolds the rows (needs a title). */
  collapsible?: boolean;
  /** Collapsible sections start folded unless this is false. */
  defaultCollapsed?: boolean;
  /** Shown next to the title while folded, for example "3 selected". */
  collapsedSummary?: string;
}

export function SettingsSection({
  title,
  description,
  editorial = false,
  collapsible = false,
  defaultCollapsed = true,
  collapsedSummary,
  children,
}: PropsWithChildren<SettingsSectionProps>) {
  const { componentRadii, spacing, palette } = useHungryTheme();
  const canFold = collapsible && Boolean(title);
  const [collapsed, setCollapsed] = useState(canFold && defaultCollapsed);

  return (
    <View style={{ marginBottom: spacing[6] }}>
      {title && canFold ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: !collapsed }}
          accessibilityHint={collapsed ? "Shows these settings" : "Hides these settings"}
          onPress={() => {
            selectHaptic();
            setCollapsed((value) => !value);
          }}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: spacing[2],
            minHeight: 44,
          }}
        >
          <AppText variant={editorial ? "h2" : "micro"} accessibilityRole="header">
            {title}
          </AppText>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            {collapsed && collapsedSummary ? (
              <AppText tone="muted" variant="bodySmall">
                {collapsedSummary}
              </AppText>
            ) : null}
            <ChevronDown
              size={20}
              color={palette.textMuted}
              style={{ transform: [{ rotate: collapsed ? "0deg" : "180deg" }] }}
            />
          </View>
        </Pressable>
      ) : title ? (
        <AppText
          variant={editorial ? "h2" : "micro"}
          accessibilityRole="header"
          style={editorial ? { marginBottom: spacing[2], color: palette.text } : styles.title}
        >
          {title}
        </AppText>
      ) : null}

      {collapsed ? null : (
        <View
          style={[
            styles.content,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          {children}
        </View>
      )}

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
