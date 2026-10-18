import type { HungryPalette } from "@/theme/tokens";

export type BannerVariant = "info" | "success" | "warning" | "error" | "offline";

export const BANNER_VARIANTS: readonly BannerVariant[] = [
  "info",
  "success",
  "warning",
  "error",
  "offline",
];

export type BannerToneStyles = {
  /** Banner fill. Soft tones are translucent in dark mode. */
  bg: string;
  /** Icon, title and action label colour. */
  accent: string;
  /** Body copy colour. */
  message: string;
};

/**
 * Single source of truth for banner and toast tone colours. Every pair is
 * checked for WCAG AA in light and dark by src/theme/accessibility-contrast.test.ts.
 */
export function getBannerToneStyles(
  palette: HungryPalette,
  variant: BannerVariant,
): BannerToneStyles {
  switch (variant) {
    case "success":
      return { bg: palette.successSoft, accent: palette.successText, message: palette.text };
    case "warning":
      return { bg: palette.warningSoft, accent: palette.warningText, message: palette.text };
    case "error":
      return { bg: palette.errorSoft, accent: palette.errorText, message: palette.text };
    case "offline":
      return { bg: palette.navy, accent: palette.textOnDark, message: palette.textOnDark };
    case "info":
    default:
      return { bg: palette.infoSoft, accent: palette.infoText, message: palette.text };
  }
}

/** Warning, error and offline banners interrupt; info and success are passive. */
export function isAlertBannerVariant(variant: BannerVariant): boolean {
  return variant === "warning" || variant === "error" || variant === "offline";
}
