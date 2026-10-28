import { View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { AuthProviderButton } from "./AuthProviderButton";
import type { AuthProvider, AuthProviderIntent } from "./authCopy";
import { getEnabledAuthProviders } from "./authProviders";

/**
 * Apple and Google buttons plus the "or use email" divider, for the providers this device
 * offers (authProviders.ts). Renders nothing when there are none, so the email form leads.
 */
export function AuthProviderButtons({
  disabled,
  divider,
  intent = "continue",
  onPress,
  spacingBelow,
}: {
  disabled: boolean;
  divider: string;
  intent?: AuthProviderIntent;
  onPress: (provider: AuthProvider) => void;
  spacingBelow?: number;
}) {
  const { palette, spacing } = useHungryTheme();
  const providers = getEnabledAuthProviders();
  if (providers.length === 0) return null;
  return (
    <View style={{ gap: spacing[4], marginBottom: spacingBelow }}>
      <View style={{ gap: spacing[3] }}>
        {providers.map((provider) => (
          <AuthProviderButton
            key={provider}
            disabled={disabled}
            intent={intent}
            provider={provider}
            onPress={() => onPress(provider)}
          />
        ))}
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
        <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
        <AppText variant="micro" tone="muted">
          {divider}
        </AppText>
        <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
      </View>
    </View>
  );
}
