import { View } from "react-native";

import type { HygieneGrade } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface HygieneGradeBadgeProps {
  grade: HygieneGrade;
}

export function HygieneGradeBadge({ grade }: HygieneGradeBadgeProps) {
  const { palette, radii, spacing } = useHungryTheme();

  const config = {
    A: { bg: palette.successSoft, fg: palette.success },
    B: { bg: palette.amberLight, fg: palette.amber },
    C: { bg: palette.orangeLight, fg: palette.orange },
    D: { bg: palette.errorSoft, fg: palette.error },
  }[grade];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: config.bg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1],
      }}
    >
      <AppText variant="micro" style={{ color: config.fg, textTransform: "uppercase", fontWeight: "700" }}>
        NEA Grade {grade}
      </AppText>
    </View>
  );
}

