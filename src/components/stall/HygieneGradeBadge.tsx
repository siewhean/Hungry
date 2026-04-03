import { View } from "react-native";

import type { HygieneGrade } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface HygieneGradeBadgeProps {
  grade: HygieneGrade;
}

const tone = {
  A: { bg: "#DCFCE7", fg: "#16A34A" },
  B: { bg: "#FEF3C7", fg: "#D97706" },
  C: { bg: "#FDF0EB", fg: "#E8531E" },
  D: { bg: "#FEE2E2", fg: "#DC2626" },
} as const;

export function HygieneGradeBadge({ grade }: HygieneGradeBadgeProps) {
  const { radii, spacing } = useHungryTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: tone[grade].bg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
      }}
    >
      <AppText variant="micro" style={{ color: tone[grade].fg, textTransform: "uppercase" }}>
        NEA Grade {grade}
      </AppText>
    </View>
  );
}

