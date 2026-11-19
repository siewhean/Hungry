import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type ShareActionRenderer = (params: { color: string; size: number }) => ReactNode;

type ShareActionDefinition = {
  key: string;
  label: string;
  accessibilityLabel: string;
  icon: ShareActionRenderer;
  onPress: () => void;
};

type ShareQuickActionGroupProps = {
  actions: ShareActionDefinition[];
};

export function ShareQuickActionGroup({ actions }: ShareQuickActionGroupProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  return (
    <View style={{ flexDirection: "row", gap: spacing[2] }}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          style={{
            alignItems: "center",
            // Five actions (with Picture) fit a small phone: each shares the row, up to 84 wide.
            flex: 1,
            maxWidth: 84,
            alignSelf: "center",
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              borderRadius: componentRadii.iconButton,
              justifyContent: "center",
              padding: spacing[3],
              width: 56,
              height: 56,
            }}
          >
            {action.icon({ color: palette.text, size: 28 })}
          </View>
          <AppText
            variant="micro"
            style={{ color: palette.textMuted, marginTop: spacing[1], textAlign: "center" }}
          >
            {action.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

type ShareLinkCardProps = {
  title: string;
  subtitle?: string;
  quickActions?: ShareActionDefinition[];
};

/** The share sheet body: a title and the row of link actions (copy, WhatsApp, Telegram, system share). */
export function ShareLinkCard({ title, subtitle, quickActions = [] }: ShareLinkCardProps) {
  const { spacing } = useHungryTheme();

  return (
    <View style={{ gap: spacing[2] }}>
      <ShareSettingsHeader title={title} subtitle={subtitle} />
      {quickActions.length > 0 ? <ShareQuickActionGroup actions={quickActions} /> : null}
    </View>
  );
}

export function ShareSettingsHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { palette, spacing } = useHungryTheme();

  return (
    <View
      style={{
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        gap: spacing[1],
        paddingBottom: spacing[3],
        paddingHorizontal: spacing[4],
      }}
    >
      <AppText variant="h3">{title}</AppText>
      {subtitle ? (
        <AppText variant="bodySmall" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
