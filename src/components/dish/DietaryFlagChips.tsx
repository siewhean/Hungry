import { View } from "react-native";

import { formatDietaryFlag, orderDietaryFlags } from "@/features/detail/dietaryLabels";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface DietaryFlagChipsProps {
  flags: readonly string[];
  /** Optional per-flag suffix, e.g. a stall summary's "3 dishes". */
  detailByFlag?: Record<string, string>;
}

/** Labelled dietary chips; halal is styled apart because it decides who can eat here. */
export function DietaryFlagChips({ flags, detailByFlag }: DietaryFlagChipsProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const ordered = orderDietaryFlags(flags);
  if (ordered.length === 0) return null;
  return (
    <View
      accessibilityRole="list"
      accessibilityLabel="Dietary labels"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
    >
      {ordered.map((flag) => {
        const isHalal = flag === "halal";
        const detail = detailByFlag?.[flag];
        const label = detail ? `${formatDietaryFlag(flag)} · ${detail}` : formatDietaryFlag(flag);
        return (
          <View
            key={flag}
            accessible
            accessibilityRole="text"
            accessibilityLabel={label}
            style={{
              backgroundColor: isHalal ? palette.successSoft : palette.surface,
              borderColor: isHalal ? palette.success : palette.border,
              borderRadius: radii.pill,
              borderWidth: 1,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
            }}
          >
            <AppText
              variant="micro"
              style={{
                color: isHalal ? palette.successText : palette.text,
                fontWeight: isHalal ? "800" : "600",
              }}
            >
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
