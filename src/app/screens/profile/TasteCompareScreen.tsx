import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, AppText, EmptyState } from "@/components/ui";
import { comparePalates } from "@/features/profile/tastePalette";
import { tasteMatchLabel } from "@/features/social/relationship";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { TasteVector } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<RootStackParamList, "TasteCompare">;

type Comparison = { score: number; mine: TasteVector; theirs: TasteVector };

/** Two bars out of 10, yours over theirs. */
function PairBars({ mine, theirs }: { mine: number; theirs: number }) {
  const { palette, radii } = useHungryTheme();
  const bar = (level: number, color: string) => (
    <View style={{ backgroundColor: palette.bgSoft, borderRadius: radii.pill, height: 6 }}>
      <View
        style={{
          backgroundColor: color,
          borderRadius: radii.pill,
          height: 6,
          width: `${Math.max(4, Math.min(100, level * 10))}%`,
        }}
      />
    </View>
  );
  return (
    <View style={{ gap: 4 }}>
      {bar(mine, palette.accentText)}
      {bar(theirs, palette.textSecondary)}
    </View>
  );
}

/**
 * Compare palates: the viewer's six tastes against another diner's, biggest gap first, with a
 * sentence for each ("Mei likes far more spice"). One read (get_taste_comparison); private or
 * blocked people and neutral palates return nothing and the page says so.
 */
export function TasteCompareScreen({ route }: Props) {
  const { userId, userDisplayName } = route.params;
  const theirName = userDisplayName?.trim() || "They";
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [state, setState] = useState<"loading" | "ready" | "none" | "failed">("loading");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    setState("loading");
    void getHungryService()
      .social.getTasteComparison(userId)
      .then((result) => {
        if (!isActive) return;
        setComparison(result);
        setState(result ? "ready" : "none");
        if (result) trackAnalyticsEvent("taste_compare_viewed", { score: result.score });
      })
      .catch((error) => {
        if (!isActive) return;
        setState("failed");
        reportError(error, { screen: "TasteCompare", action: "load_taste_comparison" });
      });
    return () => {
      isActive = false;
    };
  }, [reloadKey, userId]);

  const rows = useMemo(
    () => (comparison ? comparePalates(comparison.mine, comparison.theirs, theirName) : null),
    [comparison, theirName],
  );

  const cardStyle = {
    backgroundColor: palette.surface,
    borderRadius: componentRadii.card,
    gap: spacing[3],
    padding: spacing[4],
  } as const;

  return (
    <ProfileScreenShell title="Compare palates" testID="taste-compare-screen">
      {state === "loading" ? (
        <View testID="taste-compare-loading" style={{ minHeight: 200 }} />
      ) : state === "failed" ? (
        <EmptyState
          title="Couldn't compare palates"
          body="Check your connection and try again."
          icon={<AppSymbol name="retry" size={36} weight="regular" color={palette.textSecondary} />}
          ctaLabel="Retry"
          onPress={() => setReloadKey((key) => key + 1)}
        />
      ) : state === "none" || !comparison || !rows ? (
        <View style={cardStyle} testID="taste-compare-none">
          <AppText variant="bodyBold">Nothing to compare yet</AppText>
          <AppText variant="bodySmall" tone="secondary">
            One of you has not built a palate yet, or this profile is private.
          </AppText>
        </View>
      ) : (
        <>
          <View style={cardStyle} testID="taste-compare-score">
            <AppText variant="h2">{tasteMatchLabel(comparison.score)}</AppText>
            {rows.shared.length > 0 ? (
              <AppText variant="bodySmall" tone="secondary">
                {rows.shared.map((row) => row.sentence).join(". ")}.
              </AppText>
            ) : null}
          </View>
          <View style={cardStyle} testID="taste-compare-rows">
            <View style={{ flexDirection: "row", gap: spacing[3] }}>
              <AppText variant="micro" tone="accent">
                You
              </AppText>
              <AppText variant="micro" tone="secondary">
                {theirName === "They" ? "Them" : theirName}
              </AppText>
            </View>
            {rows.rows.map((row) => (
              <View
                key={row.key}
                testID={`taste-compare-row-${row.key}`}
                accessible
                accessibilityLabel={`${row.label}: you ${row.mine}, ${theirName} ${row.theirs} out of 10. ${row.sentence}`}
                style={{ gap: spacing[1] }}
              >
                <AppText variant="bodyBold">{row.label}</AppText>
                <PairBars mine={row.mine} theirs={row.theirs} />
                <AppText variant="bodySmall" tone="secondary">
                  {row.sentence}
                </AppText>
              </View>
            ))}
          </View>
        </>
      )}
    </ProfileScreenShell>
  );
}
