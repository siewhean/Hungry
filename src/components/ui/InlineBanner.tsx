import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface InlineBannerProps {
  message: string;
  tone?: "info" | "warning" | "error" | "success";
}

export function InlineBanner({ message, tone = "info" }: InlineBannerProps) {
  const { componentCornerCurve, componentRadii, palette, spacing } = useHungryTheme();

  const tones = {
    info: { bg: palette.infoSoft, fg: palette.info },
    warning: { bg: palette.warningSoft, fg: palette.warning },
    error: { bg: palette.errorSoft, fg: palette.error },
    success: { bg: palette.successSoft, fg: palette.success },
  };

  return (
    <View
      style={{
        backgroundColor: tones[tone].bg,
        borderRadius: componentRadii.card,
        borderCurve: componentCornerCurve.borderCurve,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
      }}
    >
      <AppText tone="secondary" style={{ color: tones[tone].fg }}>
        {message}
      </AppText>
    </View>
  );
}
