import * as Haptics from "@/lib/haptics";
import { Pressable, View } from "react-native";

import { AppleLogo, GoogleLogo } from "@/components/icons/brand/AuthProviderLogos";
import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import {
  getAuthProviderButtonLabel,
  getAuthProviderUnavailableButtonLabel,
  type AuthProvider,
  type AuthProviderIntent,
} from "./authCopy";

type AuthProviderButtonProps = {
  disabled?: boolean;
  intent: AuthProviderIntent;
  onPress: () => void;
  provider: AuthProvider;
};

export function AuthProviderButton({
  disabled = false,
  intent,
  onPress,
  provider,
}: AuthProviderButtonProps) {
  const { componentCornerCurve, componentRadii, componentSizes, palette, spacing } =
    useHungryTheme();
  const icon = provider === "google" ? <GoogleLogo /> : <AppleLogo />;
  const label = disabled
    ? getAuthProviderUnavailableButtonLabel(provider)
    : getAuthProviderButtonLabel(provider, intent);

  return (
    <Pressable
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (disabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderCurve: componentCornerCurve.borderCurve,
          borderRadius: componentRadii.button,
          borderWidth: 1,
          justifyContent: "center",
          minHeight: componentSizes.buttonMdMinHeight,
          paddingHorizontal: spacing[4],
          position: "relative",
          transform: [{ translateY: pressed && !disabled ? 1 : 0 }],
          width: "100%",
        },
        pressed && !disabled ? { backgroundColor: palette.surfaceRaised } : null,
        disabled ? { opacity: 0.6 } : null,
      ]}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          left: spacing[4],
          position: "absolute",
          width: spacing[6],
        }}
      >
        {icon}
      </View>
      <AppText variant="h3" style={{ color: palette.text, textAlign: "center" }}>
        {label}
      </AppText>
    </Pressable>
  );
}
