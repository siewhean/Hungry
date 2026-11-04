import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight, Stamp } from "lucide-react-native";

import { ProgressRing } from "@/components/ui/ProgressRing";
import { AppText } from "@/components/ui/AppText";
import { useNextStamp, useAchievementsLoopEnabled } from "@/features/passport/useNextStamp";
import {
  trackNextStampCardTapped,
  trackNextStampCardViewed,
} from "@/lib/analytics/gamificationEvents";
import { useHungryTheme } from "@/theme";

interface NextStampCardProps {
  onOpenPassport: () => void;
  /** False while the host screen is off screen (tab warm-up), so no view is logged. */
  visible?: boolean;
}

/**
 * Home card: the stamp (or, when none is close, the weekly goal) that is nearest to done, with a
 * ring. Something is always within reach; tapping opens the Passport.
 */
export function NextStampCard({ onOpenPassport, visible = true }: NextStampCardProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const enabled = useAchievementsLoopEnabled();
  const summary = useNextStamp();
  const kind = summary?.kind;

  useEffect(() => {
    if (enabled && visible && kind) trackNextStampCardViewed({ kind });
  }, [enabled, kind, visible]);

  if (!enabled || !summary) return null;

  return (
    <Pressable
      testID="next-stamp-card"
      accessibilityRole="button"
      accessibilityLabel={`${summary.headline}. ${summary.detail}`}
      accessibilityHint="Opens your Passport"
      onPress={() => {
        trackNextStampCardTapped({ kind: summary.kind });
        onOpenPassport();
      }}
      style={{
        alignItems: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        padding: spacing[3],
      }}
    >
      <ProgressRing fraction={summary.fraction} size={48} strokeWidth={5}>
        <Stamp size={20} color={palette.orange} />
      </ProgressRing>
      <View style={{ flex: 1, gap: spacing[0.5] }}>
        <AppText variant="bodySmallBold" numberOfLines={2}>
          {summary.headline}
        </AppText>
        <AppText tone="muted" variant="micro" numberOfLines={1}>
          {summary.detail}
        </AppText>
      </View>
      <ChevronRight size={18} color={palette.textMuted} />
    </Pressable>
  );
}
