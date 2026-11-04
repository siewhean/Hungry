import { Pressable, View } from "react-native";
import { Check, X } from "lucide-react-native";

import { AchievementBadgeArt } from "@/components/gamification/AchievementBadgeArt";
import { AppText } from "@/components/ui/AppText";
import { ACHIEVEMENT_DEFINITIONS, type AchievementRow } from "@/features/achievements/achievements";
import { useHungryTheme } from "@/theme";

interface AchievementDetailPanelProps {
  row: AchievementRow;
  onClose: () => void;
}

/**
 * An achievement opened up: its medal, how far along it is, and every level with what earns it,
 * the ones reached ticked off.
 */
export function AchievementDetailPanel({ row, onClose }: AchievementDetailPanelProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === row.id);
  const remaining = Math.max(0, row.target - row.progress);

  return (
    <View
      testID={`achievement-detail-${row.id}`}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[4],
        padding: spacing[4],
        width: "100%",
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
        <AchievementBadgeArt
          icon={row.icon}
          level={row.level}
          totalLevels={row.totalLevels}
          size={72}
        />
        <View style={{ flex: 1, gap: spacing[0.5] }}>
          <AppText variant="h3">{row.title}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {row.completed
              ? `Every level done · ${row.progress} ${row.unit}`
              : row.level > 0
                ? `Level ${row.level} of ${row.totalLevels} · ${row.progress} ${row.unit}`
                : `Not started · ${row.progress} ${row.unit}`}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${row.title}`}
          hitSlop={10}
          onPress={onClose}
          style={{
            alignItems: "center",
            backgroundColor: palette.bgSoft,
            borderRadius: radii.pill,
            height: 32,
            justifyContent: "center",
            width: 32,
          }}
        >
          <X size={16} color={palette.textSecondary} />
        </Pressable>
      </View>

      {definition ? (
        <View style={{ gap: spacing[2.5] }}>
          <AppText variant="bodySmallBold">Levels</AppText>
          {definition.tiers.map((tier, index) => {
            const reached = index < row.level;
            return (
              <View
                key={tier}
                accessible
                accessibilityLabel={`Level ${index + 1}, ${definition.describe(tier)}, ${reached ? "reached" : "not yet"}`}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[2.5] }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: reached ? palette.orange : palette.bgSoft,
                    borderRadius: radii.pill,
                    height: 22,
                    justifyContent: "center",
                    width: 22,
                  }}
                >
                  {reached ? (
                    <Check size={14} color={palette.textOnOrange} />
                  ) : (
                    <AppText variant="micro" tone="muted">
                      {index + 1}
                    </AppText>
                  )}
                </View>
                <AppText
                  variant="bodySmall"
                  tone={reached ? undefined : "muted"}
                  style={{ flex: 1 }}
                >
                  {definition.describe(tier)}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}

      {row.completed ? null : (
        <View
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.md,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2.5],
          }}
        >
          <AppText variant="bodySmall">
            {`${remaining} more ${row.unit} to reach level ${row.level + 1}.`}
          </AppText>
        </View>
      )}
    </View>
  );
}
