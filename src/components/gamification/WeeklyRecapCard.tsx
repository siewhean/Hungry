import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { AppSymbol } from "@/components/ui/AppSymbol";
import { useTriedTimestamps } from "@/features/passport/useWeeklyGoal";
import { buildWeeklyRecap, type WeeklyRecap } from "@/features/passport/weeklyRecap";
import { useWeeklyRecapStore } from "@/store/useWeeklyRecapStore";
import { useHungryTheme } from "@/theme";

interface WeeklyRecapCardProps {
  onOpenPassport: () => void;
  /** For tests: the moment to recap at. */
  now?: Date;
}

/** Home on Sunday (and Monday morning): what the diner tried this week and their streak. */
export function WeeklyRecapCard({ onOpenPassport, now }: WeeklyRecapCardProps) {
  const triedAt = useTriedTimestamps();
  const dismissedWeek = useWeeklyRecapStore((state) => state.dismissedWeek);
  const dismiss = useWeeklyRecapStore((state) => state.dismiss);
  const recap = useMemo(() => buildWeeklyRecap(triedAt, now ?? new Date()), [now, triedAt]);
  if (!recap || recap.week === dismissedWeek) return null;
  return <RecapBody recap={recap} onOpen={onOpenPassport} onClose={() => dismiss(recap.week)} />;
}

function RecapBody({
  recap,
  onOpen,
  onClose,
}: {
  recap: WeeklyRecap;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      testID="weekly-recap-card"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        padding: spacing[4],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recap.title}. ${recap.body} Open your Passport`}
        onPress={onOpen}
        style={{ flex: 1, flexDirection: "row", gap: spacing[3] }}
      >
        <AppSymbol name="streak" size={22} color={palette.orange} />
        <View style={{ flex: 1, gap: spacing[1] }}>
          <AppText variant="bodyBold">{recap.title}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {recap.body}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the week's recap"
        hitSlop={12}
        onPress={onClose}
      >
        <AppSymbol name="close" size={16} color={palette.textSecondary} />
      </Pressable>
    </View>
  );
}
