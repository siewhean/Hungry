import { Pressable, ScrollView, View } from "react-native";
import { History } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

interface RecentSearchChipsProps {
  searches: string[];
  onSelect: (query: string) => void;
}

const MAX_CHIPS = 8;

/** The diner's last searches as one tappable row. Renders nothing when there are none. */
export function RecentSearchChips({ searches, onSelect }: RecentSearchChipsProps) {
  const { palette, radii, spacing } = useHungryTheme();
  if (!searches.length) return null;
  return (
    <View style={{ gap: spacing[2] }} testID="recent-search-chips">
      <AppText variant="bodySmallBold" tone="secondary" accessibilityRole="header">
        Recent searches
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          {searches.slice(0, MAX_CHIPS).map((query) => (
            <Pressable
              key={query}
              accessibilityRole="button"
              accessibilityLabel={`Search ${query} again`}
              onPress={() => {
                tapHaptic();
                onSelect(query);
              }}
              style={{
                alignItems: "center",
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[1],
                minHeight: 36,
                paddingHorizontal: spacing[3],
              }}
            >
              <History size={14} color={palette.textMuted} />
              <AppText variant="bodySmall" numberOfLines={1}>
                {query}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
