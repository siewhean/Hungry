import type { HungryPalette } from "@/theme/tokens";

export type BadgeTone = "orange" | "amber" | "success" | "warning" | "error" | "info" | "neutral";

type BadgeToneStyles = {
  bg: string;
  border: string;
  text: string;
};

export function getBadgeToneStyles(palette: HungryPalette, tone: BadgeTone): BadgeToneStyles {
  switch (tone) {
    case "orange":
      return { bg: palette.orangeLight, border: palette.orange, text: palette.orange };
    case "amber":
      return { bg: palette.warningSoft, border: palette.warningSoft, text: palette.warning };
    case "success":
      return { bg: palette.successSoft, border: palette.successSoft, text: palette.success };
    case "warning":
      return { bg: palette.warningSoft, border: palette.warningSoft, text: palette.warning };
    case "error":
      return { bg: palette.errorSoft, border: palette.errorSoft, text: palette.error };
    case "info":
      return { bg: palette.infoSoft, border: palette.infoSoft, text: palette.info };
    case "neutral":
    default:
      return { bg: palette.surface, border: palette.border, text: palette.textSecondary };
  }
}
