import { Pressable, View } from "react-native";
import { ChevronRight, X } from "lucide-react-native";

import {
  PassportStampArt,
  getStampLook,
  StampStar,
} from "@/components/gamification/PassportStampArt";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { formatStampDate, type StampHistory } from "@/features/passport/stampHistory";
import { useHungryTheme } from "@/theme";
import type { PassportCategory } from "@/types/domain";
import { AppSymbol } from "@/components/ui/AppSymbol";

/** Stalls listed before "and N more". */
const STALL_LIMIT = 8;

interface StampDetailPanelProps {
  category: PassportCategory;
  history: StampHistory;
  onOpenStall: (stallId: string) => void;
  onClose: () => void;
  /** Find more stalls of this kind (Search, filtered to the trail's food). */
  onFindMore?: () => void;
  /** Post a dish from this trail to the Food Portfolio. */
  onPostDish?: () => void;
}

/** The short name of a level: "Hawker Food Explorer: Return visit" reads as "Return visit". */
function levelName(title: string): string {
  return title.split(": ").at(-1) ?? title;
}

/**
 * The open state of a Heritage stamp: each level earned, when, and the visit that earned it,
 * then every visited stall that counts towards the trail. Tapping a stall opens it.
 */
export function StampDetailPanel({
  category,
  history,
  onOpenStall,
  onClose,
  onFindMore,
  onPostDish,
}: StampDetailPanelProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const ink = getStampLook(category.id).ink(palette);
  const top = history.earned.at(-1);
  const level = top?.stamp.index ?? 0;
  const shown = history.stalls.slice(0, STALL_LIMIT);
  const hidden = history.stalls.length - shown.length;

  return (
    <View
      testID={`stamp-detail-${category.id}`}
      style={{
        backgroundColor: palette.surface,
        borderColor: ink,
        borderRadius: componentRadii.card,
        borderWidth: 1.5,
        gap: spacing[4],
        padding: spacing[4],
        width: "100%",
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
        <PassportStampArt categoryId={category.id} level={level} earned={Boolean(top)} size={64} />
        <View style={{ flex: 1, gap: spacing[0.5] }}>
          <AppText variant="h3">{category.name}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {top
              ? `Level ${level + 1} of 4 · ${history.stalls.length} ${history.stalls.length === 1 ? "stall" : "stalls"}`
              : "Not stamped yet"}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${category.name}`}
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
          <AppSymbol name="xmark" fallback={X} size={16} color={palette.textSecondary} />
        </Pressable>
      </View>

      {history.earned.length > 0 ? (
        <View style={{ gap: spacing[2.5] }}>
          <AppText variant="bodySmallBold">Stamps earned</AppText>
          {history.earned.map(({ stamp, earnedAt, unlockedBy }) => {
            const date = formatStampDate(earnedAt);
            const via = unlockedBy?.name;
            return (
              <View
                key={stamp.id}
                accessible
                accessibilityLabel={`${levelName(stamp.title)}${date ? `, earned ${date}` : ""}${via ? `, at ${via}` : ""}`}
                style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2.5] }}
              >
                <View style={{ paddingTop: 2 }}>
                  <StampStar size={16} color={ink} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodySmallBold">{levelName(stamp.title)}</AppText>
                  <AppText variant="micro" tone="muted">
                    {[date ? `Earned ${date}` : "Earned", via ? `at ${via}` : null]
                      .filter(Boolean)
                      .join(" ")}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {history.next ? (
        <View
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.md,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2.5],
          }}
        >
          <AppText variant="bodySmall">
            {`Next: ${levelName(history.next.stamp.title)}. Visit ${history.next.remaining} more ${history.next.remaining === 1 ? "stall" : "stalls"} that ${history.next.remaining === 1 ? "counts" : "count"}.`}
          </AppText>
        </View>
      ) : (
        <AppText variant="bodySmall" tone="secondary">
          Trail complete. Every stamp earned.
        </AppText>
      )}

      {shown.length > 0 ? (
        <View style={{ gap: spacing[1] }}>
          <AppText variant="bodySmallBold">Stalls that count</AppText>
          {shown.map((stall) => {
            const date = formatStampDate(stall.triedAt);
            const name = stall.name ?? "A stall you visited";
            return (
              <Pressable
                key={stall.stallId}
                accessibilityRole="button"
                accessibilityLabel={`${name}${date ? `, visited ${date}` : ""}`}
                onPress={() => onOpenStall(stall.stallId)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? palette.bgSoft : "transparent",
                  borderRadius: radii.md,
                  flexDirection: "row",
                  gap: spacing[2],
                  minHeight: 44,
                  paddingHorizontal: spacing[1],
                })}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodySmall" numberOfLines={1}>
                    {name}
                  </AppText>
                </View>
                {date ? (
                  <AppText variant="micro" tone="muted">
                    {date}
                  </AppText>
                ) : null}
                <AppSymbol
                  name="chevron.right"
                  fallback={ChevronRight}
                  size={16}
                  color={palette.textMuted}
                />
              </Pressable>
            );
          })}
          {hidden > 0 ? (
            <AppText variant="micro" tone="muted" style={{ paddingHorizontal: spacing[1] }}>
              {`and ${hidden} more`}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="bodySmall" tone="secondary">
          {category.description}
        </AppText>
      )}

      {onFindMore || onPostDish ? (
        <View
          testID="stamp-detail-actions"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
        >
          {onFindMore ? (
            <Button
              label="Find more stalls"
              size="sm"
              variant="secondary"
              fullWidth={false}
              accessibilityLabel={`Find more ${category.name} stalls`}
              onPress={onFindMore}
            />
          ) : null}
          {onPostDish ? (
            <Button
              label="Add a dish"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={onPostDish}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
