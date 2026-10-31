import { View } from "react-native";

import { AppSymbol, AppText, PressableScale } from "@/components/ui";
import type { ParsedQueryPart } from "@/features/search/queryParser";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

/**
 * The filters read out of a typed search ("halal laksa under $5" -> Halal, Under S$5). Tapping one
 * removes it, and its words go back to being plain search text. One row that sits in the results
 * header's chip rail, beside the Dishes and Stalls segment, so it never takes a line of its own.
 */
export function ParsedQueryChips({
  onRemove,
  parts,
}: {
  onRemove: (part: ParsedQueryPart) => void;
  parts: readonly ParsedQueryPart[];
}) {
  const { palette, spacing } = useHungryTheme();
  if (parts.length === 0) return null;
  return (
    <View
      accessibilityLabel="Filters from your search"
      style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
      testID="search-parsed-chips"
    >
      {parts.map((part) => (
        <PressableScale
          key={part.key}
          accessibilityRole="button"
          accessibilityLabel={`${part.label}, from your search. Remove it to search for "${part.source}" as text`}
          hitSlop={4}
          onPress={() => {
            selectHaptic();
            onRemove(part);
          }}
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.orange,
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing[2],
            minHeight: 36,
            paddingHorizontal: spacing[3],
          }}
        >
          <AppText variant="bodySmall">{part.label}</AppText>
          <AppSymbol name="close" color={palette.textMuted} size={14} />
        </PressableScale>
      ))}
    </View>
  );
}
