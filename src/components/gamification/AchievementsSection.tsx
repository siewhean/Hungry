import { useState } from "react";
import { Pressable, View } from "react-native";

import { AchievementBadgeArt } from "@/components/gamification/AchievementBadgeArt";
import { AchievementDetailPanel } from "@/components/gamification/AchievementDetailPanel";
import { AppText, InfoPopup } from "@/components/ui";
import type { AchievementRow } from "@/features/achievements/achievements";
import { useHungryTheme } from "@/theme";

interface AchievementsSectionProps {
  rows: AchievementRow[];
}

/** Tiered achievements: a card per goal with its level, a progress bar and the next target. */
export function AchievementsSection({ rows }: AchievementsSectionProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const unlocked = rows.filter((row) => row.level > 0).length;
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = rows.find((row) => row.id === openId);

  return (
    <View style={{ gap: spacing[3] }} testID="achievements-section">
      <View
        style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }}
      >
        <AppText variant="h2">Achievements</AppText>
        <AppText tone="muted" variant="bodySmall">
          {unlocked} of {rows.length} started
        </AppText>
      </View>
      {rows.map((row) => {
        const reached = row.level > 0;
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityHint="Shows every level and what earns it"
            accessibilityLabel={`${row.title}, level ${row.level} of ${row.totalLevels}. ${row.progress} of ${row.target} ${row.unit}.`}
            onPress={() => setOpenId(row.id)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: reached ? palette.orange : palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing[3],
              opacity: pressed ? 0.85 : 1,
              padding: spacing[4],
            })}
          >
            <AchievementBadgeArt
              icon={row.icon}
              level={row.level}
              totalLevels={row.totalLevels}
              size={60}
            />
            <View style={{ flex: 1, gap: spacing[1] }}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <AppText variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {row.title}
                </AppText>
                <AppText
                  variant="micro"
                  style={{ color: reached ? palette.orange : palette.textMuted }}
                >
                  {row.completed ? "Complete" : `Level ${row.level}/${row.totalLevels}`}
                </AppText>
              </View>
              <View
                style={{
                  backgroundColor: palette.border,
                  borderRadius: radii.pill,
                  height: 6,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    backgroundColor: palette.orange,
                    height: "100%",
                    width: `${Math.round(row.fraction * 100)}%`,
                  }}
                />
              </View>
              <AppText tone="muted" variant="micro" numberOfLines={2}>
                {row.completed
                  ? `${row.progress} ${row.unit}. Every level done.`
                  : `${row.progress} / ${row.target} · ${row.description}`}
              </AppText>
            </View>
          </Pressable>
        );
      })}
      <InfoPopup
        visible={Boolean(openRow)}
        label={openRow ? `${openRow.title} achievement details` : "Achievement details"}
        onClose={() => setOpenId(null)}
      >
        {openRow ? <AchievementDetailPanel row={openRow} onClose={() => setOpenId(null)} /> : null}
      </InfoPopup>
    </View>
  );
}
