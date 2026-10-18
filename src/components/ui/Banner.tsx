import type { ComponentType } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff, X } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { getBannerToneStyles, isAlertBannerVariant, type BannerVariant } from "./bannerTones";

type BannerIcon = ComponentType<{ color?: string; size?: number }>;

export const BANNER_ICONS: Record<BannerVariant, BannerIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  offline: WifiOff,
};

export const BANNER_ICON_SIZE = 18;

export interface BannerAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export interface BannerProps {
  message: string;
  variant?: BannerVariant;
  title?: string;
  /** Optional trailing text action, e.g. Retry. Always a 44pt target. */
  action?: BannerAction;
  /** Renders a 44pt dismiss (X) button when provided. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * `inline` (default) is a rounded card inside screen content. `strip` is the
   * full-bleed global top bar: square corners, sits in layout flow (never
   * absolutely positioned) and pads itself by `topInset` so it owns the
   * status-bar area instead of covering screen headers.
   */
  placement?: "inline" | "strip";
  topInset?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Banner({
  message,
  variant = "info",
  title,
  action,
  onDismiss,
  dismissLabel = "Dismiss",
  placement = "inline",
  topInset = 0,
  testID,
  style,
}: BannerProps) {
  const { componentCornerCurve, componentRadii, componentSizes, palette, spacing } =
    useHungryTheme();
  const tone = getBannerToneStyles(palette, variant);
  const Icon = BANNER_ICONS[variant];
  const isAlert = isAlertBannerVariant(variant);
  const isStrip = placement === "strip";
  const hasControls = Boolean(action || onDismiss);
  const verticalPadding = hasControls ? spacing[1] : spacing[3];

  return (
    <View
      accessibilityLiveRegion={isAlert ? "polite" : undefined}
      accessibilityRole={isAlert ? "alert" : undefined}
      testID={testID}
      style={[
        {
          alignItems: "center",
          backgroundColor: tone.bg,
          flexDirection: "row",
          gap: spacing[2],
          minHeight: componentSizes.touchTarget,
          paddingLeft: isStrip ? spacing[4] : spacing[3],
          paddingRight: hasControls ? spacing[1] : isStrip ? spacing[4] : spacing[3],
        },
        isStrip
          ? {
              paddingBottom: hasControls ? 0 : spacing[2],
              paddingTop: topInset + (hasControls ? 0 : spacing[2]),
            }
          : {
              borderCurve: componentCornerCurve.borderCurve,
              borderRadius: componentRadii.card,
              paddingBottom: verticalPadding,
              paddingTop: verticalPadding,
            },
        style,
      ]}
    >
      <Icon color={tone.accent} size={BANNER_ICON_SIZE} />
      <View style={{ flex: 1, gap: spacing[0.5], paddingVertical: hasControls ? spacing[2] : 0 }}>
        {title ? (
          <AppText variant="bodySmallBold" style={{ color: tone.accent }}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="bodySmall" style={{ color: tone.message }}>
          {message}
        </AppText>
      </View>
      {action ? (
        <Pressable
          accessibilityHint={action.accessibilityHint}
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          accessibilityRole="button"
          hitSlop={4}
          onPress={action.onPress}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            minHeight: componentSizes.touchTarget,
            minWidth: componentSizes.touchTarget,
            opacity: pressed ? 0.7 : 1,
            paddingHorizontal: spacing[3],
          })}
        >
          <AppText variant="bodySmallBold" style={{ color: tone.accent }}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          accessibilityLabel={dismissLabel}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onDismiss}
          style={({ pressed }) => ({
            alignItems: "center",
            height: componentSizes.touchTarget,
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
            width: componentSizes.touchTarget,
          })}
        >
          <X color={tone.accent} size={BANNER_ICON_SIZE} />
        </Pressable>
      ) : null}
    </View>
  );
}
