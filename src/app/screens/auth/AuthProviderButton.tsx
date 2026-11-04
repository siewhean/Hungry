import { useState } from "react";
import * as Haptics from "@/lib/haptics";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { AppleLogo, GoogleLogo } from "@/components/icons/brand/AuthProviderLogos";
import { AppText } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { usePressScale } from "@/lib/motion/uiMotion";
import { useHungryTheme } from "@/theme";
import { getAuthProviderButtonLabel, type AuthProvider, type AuthProviderIntent } from "./authCopy";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AuthProviderButtonProps = {
  disabled?: boolean;
  intent: AuthProviderIntent;
  onPress: () => void;
  provider: AuthProvider;
};

/** Above this font scale the label can no longer be trusted to fit beside a pinned logo. */
export const PROVIDER_LOGO_FLOW_FONT_SCALE = 1.3;

/**
 * The logo normally sits pinned at the button's left edge with the label centred. When the label
 * wraps (accessibility text sizes) that pinned logo lands on the text, so the logo joins the
 * label in one row instead. On web the browser zoom never changes the font scale and never
 * reports a wrap, so the logo is always in the row there.
 */
export function shouldFlowProviderLogo(
  fontScale: number,
  labelWraps: boolean,
  isWeb = false,
): boolean {
  return isWeb || fontScale > PROVIDER_LOGO_FLOW_FONT_SCALE || labelWraps;
}

export function AuthProviderButton({
  disabled = false,
  intent,
  onPress,
  provider,
}: AuthProviderButtonProps) {
  const { componentCornerCurve, componentRadii, componentSizes, palette, spacing } =
    useHungryTheme();
  const { fontScale } = useWindowDimensions();
  // Once a label has wrapped the logo stays in the row; flipping back would wrap it again.
  const [labelWraps, setLabelWraps] = useState(false);
  const inFlow = shouldFlowProviderLogo(fontScale, labelWraps, Platform.OS === "web");
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(useReduceMotion());
  const icon = provider === "google" ? <GoogleLogo /> : <AppleLogo />;
  // Disabled only while another auth request runs; unavailable providers are not rendered.
  const label = getAuthProviderButtonLabel(provider, intent);

  return (
    <AnimatedPressable
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (disabled) return;
        setPressed(true);
        press.onPressIn();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        setPressed(false);
        press.onPressOut();
      }}
      style={[
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderCurve: componentCornerCurve.borderCurve,
          borderRadius: componentRadii.button,
          borderWidth: 1,
          flexDirection: inFlow ? "row" : "column",
          gap: inFlow ? spacing[3] : 0,
          justifyContent: "center",
          minHeight: componentSizes.buttonMdMinHeight,
          paddingHorizontal: spacing[4],
          paddingVertical: inFlow ? spacing[2] : 0,
          position: "relative",
          width: "100%",
        },
        pressed && !disabled ? { backgroundColor: palette.surfaceRaised } : null,
        disabled ? { opacity: 0.6 } : null,
        press.animatedStyle,
      ]}
    >
      <View
        testID={inFlow ? "provider-logo-in-flow" : "provider-logo-pinned"}
        style={
          inFlow
            ? { alignItems: "center", justifyContent: "center", width: spacing[6] }
            : {
                alignItems: "center",
                justifyContent: "center",
                left: spacing[4],
                position: "absolute",
                width: spacing[6],
              }
        }
      >
        {icon}
      </View>
      <AppText
        variant="bodyBold"
        onTextLayout={(event) => {
          if (event.nativeEvent.lines.length > 1) setLabelWraps(true);
        }}
        style={{ color: palette.text, flexShrink: 1, textAlign: "center" }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
