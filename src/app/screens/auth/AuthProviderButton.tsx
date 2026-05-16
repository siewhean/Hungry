import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";

import { AppleLogo, GoogleLogo } from "@/components/icons/brand/AuthProviderLogos";
import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { getAuthProviderButtonLabel, type AuthProvider, type AuthProviderIntent } from "./authCopy";

type AuthProviderButtonProps = {
  intent: AuthProviderIntent;
  onPress: () => void;
  provider: AuthProvider;
};

export function AuthProviderButton({ intent, onPress, provider }: AuthProviderButtonProps) {
  const { componentCornerCurve, componentRadii, componentSizes, palette, spacing } =
    useHungryTheme();
  const icon = provider === "google" ? <GoogleLogo /> : <AppleLogo />;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
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
          transform: [{ translateY: pressed ? 1 : 0 }],
          width: "100%",
        },
        pressed ? { backgroundColor: palette.surfaceRaised } : null,
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
        {getAuthProviderButtonLabel(provider, intent)}
      </AppText>
    </Pressable>
  );
}
