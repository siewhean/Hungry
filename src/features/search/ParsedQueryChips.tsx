import { Pressable, View } from "react-native";
import { X } from "lucide-react-native";

import { AppText } from "@/components/ui";
import type { ParsedQueryPart } from "@/features/search/queryParser";
import { useHungryTheme } from "@/theme";

/**
 * The filters read out of a typed search ("halal laksa under $5" -> Halal, Under S$5). Tapping one
 * removes it, and its words go back to being plain search text.
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
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
      testID="search-parsed-chips"
    >
      {parts.map((part) => (
        <Pressable
          key={part.key}
          accessibilityRole="button"
          accessibilityLabel={`${part.label}, from your search. Remove it to search for "${part.source}" as text`}
          hitSlop={4}
          onPress={() => onRemove(part)}
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
          <X color={palette.textMuted} size={16} />
        </Pressable>
      ))}
    </View>
  );
}
