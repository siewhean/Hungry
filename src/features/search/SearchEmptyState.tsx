import { View } from "react-native";

import { AppSymbol, AppText, Button, Chip, EmptyState } from "@/components/ui";
import type { BrowseMode } from "@/features/search/browseGrid";
import { useSearchStore } from "@/store/useSearchStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

/** How many popular food types and recent searches the empty state offers. */
export const EMPTY_STATE_MAX_CHIPS = 6;

const MODE_NOUNS: Record<BrowseMode, readonly [string, string]> = {
  dishes: ["dish", "dishes"],
  stalls: ["stall", "stalls"],
};

/** "2 stalls match “zzz”": what the other tab has when this one is empty. */
export function describeOtherModeMatches(mode: BrowseMode, count: number, query: string): string {
  const [one, many] = MODE_NOUNS[mode];
  return `${count} ${count === 1 ? one : many} ${count === 1 ? "matches" : "match"} “${query}”`;
}

/**
 * No results: says what happened, then offers the next move. A closer spelling first, then the other
 * tab when it has matches, then the usual ways out (clear filters, search wider), then popular food
 * types and recent searches (from the search store) to start over from.
 */
export function SearchEmptyState({
  body,
  onClearFilters,
  onSearch,
  onSwitchMode,
  onWiden,
  otherMode,
  popular,
  query,
  suggestedQuery,
}: {
  body: string;
  onClearFilters?: () => void;
  /** A suggested, popular or recent search was tapped. */
  onSearch: (text: string) => void;
  onSwitchMode?: () => void;
  onWiden?: () => void;
  /** The other tab's match count for this query, when it has any. */
  otherMode?: { mode: BrowseMode; count: number };
  popular: readonly string[];
  query: string;
  suggestedQuery?: string;
}) {
  const { palette, spacing } = useHungryTheme();
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  const recentSearches = useSearchStore((state) => state.recentSearches);
  const popularShown = popular.slice(0, EMPTY_STATE_MAX_CHIPS);
  // Recents only when search history is allowed, and never the search that just came up empty.
  const recentsShown = allowSearchHistory
    ? recentSearches
        .filter((text) => text.toLowerCase() !== query.toLowerCase())
        .slice(0, EMPTY_STATE_MAX_CHIPS)
    : [];
  return (
    <View testID="search-empty-state" style={{ gap: spacing[3] }}>
      <EmptyState
        title="No matches found"
        body={body}
        icon={<AppSymbol name="search" color={palette.textSecondary} size={34} weight="regular" />}
      />
      <View style={{ alignItems: "center", gap: spacing[2] }}>
        {suggestedQuery ? (
          <Button
            label={`Did you mean "${suggestedQuery}"?`}
            onPress={() => onSearch(suggestedQuery)}
          />
        ) : null}
        {otherMode && onSwitchMode ? (
          <Button
            label={describeOtherModeMatches(otherMode.mode, otherMode.count, query)}
            variant="secondary"
            onPress={onSwitchMode}
          />
        ) : null}
        {onClearFilters ? (
          <Button label="Clear filters" variant="secondary" onPress={onClearFilters} />
        ) : null}
        {onWiden ? (
          <Button label="Search all Singapore" variant="secondary" onPress={onWiden} />
        ) : null}
      </View>
      {popularShown.length > 0 ? (
        <View accessibilityLabel="Popular searches" style={{ gap: spacing[2] }}>
          <AppText accessibilityRole="header" variant="h3">
            Popular searches
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {popularShown.map((label) => (
              <Chip
                key={`popular:${label}`}
                label={label}
                accessibilityLabel={`Search ${label}`}
                onPress={() => onSearch(label)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {recentsShown.length > 0 ? (
        <View accessibilityLabel="Recent searches" style={{ gap: spacing[2] }}>
          <AppText accessibilityRole="header" variant="h3">
            Recent searches
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {recentsShown.map((text) => (
              <Chip
                key={`recent:${text}`}
                label={text}
                accessibilityLabel={`Search ${text} again`}
                leftIcon={<AppSymbol name="recent" color={palette.textMuted} size={14} />}
                onPress={() => onSearch(text)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
