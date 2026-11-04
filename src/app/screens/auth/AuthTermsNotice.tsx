import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { WEB_LINKS } from "@/constants/links";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { useHungryTheme } from "@/theme";
import { AUTH_COPY } from "./authCopy";

/**
 * "By creating an account, you agree to..." shown on every account-creation form. The email-code
 * form can create an account from either screen, so it passes "By continuing, you agree to".
 */
export function AuthTermsNotice({ prefix = AUTH_COPY.signUp.termsPrefix }: { prefix?: string }) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
        {prefix}
      </AppText>
      {/* Separate links so each has its own 44pt target and link role. */}
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={AUTH_COPY.signUp.termsLabel}
          accessibilityHint={AUTH_COPY.signUp.termsLinkHint}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
          style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[1] }}
        >
          <AppText variant="bodySmall" tone="accent">
            {AUTH_COPY.signUp.termsLabel}
          </AppText>
        </Pressable>
        <AppText variant="bodySmall" tone="secondary">
          {AUTH_COPY.signUp.privacyJoiner}
        </AppText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={AUTH_COPY.signUp.privacyLabel}
          accessibilityHint={AUTH_COPY.signUp.privacyLinkHint}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
          style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[1] }}
        >
          <AppText variant="bodySmall" tone="accent">
            {AUTH_COPY.signUp.privacyLabel}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
