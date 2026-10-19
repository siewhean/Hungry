import { View } from "react-native";

import { AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** Shared lockup size for the Login / Create account pair (56pt mark + wordmark). */
export const AUTH_BRAND_LOGO_SIZE = 96;

type Props = {
  title: string;
  subtitle?: string;
};

/**
 * One brand header for the matched Login / Create account pair: same logo
 * lockup, size, top spacing and logo-to-title gap on both screens.
 */
export function AuthBrandHeader({ title, subtitle }: Props) {
  const { colorScheme, palette, spacing } = useHungryTheme();

  return (
    <View
      testID="auth-brand-header"
      style={{ alignItems: "center", gap: spacing[4], paddingTop: spacing[6] }}
    >
      <HungryLogo
        size={AUTH_BRAND_LOGO_SIZE}
        showWordmark
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
      />
      <View style={{ alignItems: "center", gap: spacing[1] }}>
        <AppText variant="h1" style={{ textAlign: "center", fontSize: 24 }}>
          {title}
        </AppText>
        {subtitle?.trim().length ? (
          <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
