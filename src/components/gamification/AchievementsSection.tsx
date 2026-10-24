import { View } from "react-native";
import {
  Bookmark,
  Candy,
  Coins,
  Flame,
  MapPin,
  PenLine,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";

import { AppText } from "@/components/ui";
import type { AchievementIcon, AchievementRow } from "@/features/achievements/achievements";
import { useHungryTheme } from "@/theme";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  utensils: UtensilsCrossed,
  "map-pin": MapPin,
  store: Store,
  flame: Flame,
  candy: Candy,
  coins: Coins,
  pen: PenLine,
  bookmark: Bookmark,
};

interface AchievementsSectionProps {
  rows: AchievementRow[];
}

/** Tiered achievements: a card per goal with its level, a progress bar and the next target. */
export function AchievementsSection({ rows }: AchievementsSectionProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const unlocked = rows.filter((row) => row.level > 0).length;

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
        const Icon = ICONS[row.icon];
        const reached = row.level > 0;
        return (
          <View
            key={row.id}
            accessibilityLabel={`${row.title}, level ${row.level} of ${row.totalLevels}. ${row.progress} of ${row.target} ${row.unit}.`}
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: reached ? palette.orange : palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing[3],
              padding: spacing[4],
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: reached ? palette.orangeLight : palette.bgSoft,
                borderRadius: radii.pill,
                height: 44,
                justifyContent: "center",
                width: 44,
              }}
            >
              <Icon size={22} color={reached ? palette.orange : palette.textMuted} />
            </View>
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
          </View>
        );
      })}
    </View>
  );
}
