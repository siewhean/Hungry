import { TextInput } from "react-native";

import { useMovingSearchPlaceholder } from "@/features/search/useMovingSearchPlaceholder";
import { useHungryTheme } from "@/theme";

const SEARCH_PLACEHOLDER_DEFAULT = "Dishes, stalls, or hawker centres…";
const DISCOVER_SEARCH_PLACEHOLDER_PHRASES = [
  SEARCH_PLACEHOLDER_DEFAULT,
  "Try laksa nearby",
  "Search for mee pok",
  "What's near you?",
] as const;

/** Phone widths under this get phrases short enough to fit beside the search icon. */
export const NARROW_SEARCH_WIDTH = 360;
const NARROW_SEARCH_PLACEHOLDER_PHRASES = [
  "Dishes or stalls…",
  "Try laksa nearby",
  "Search mee pok",
  "What's near you?",
] as const;

/** The animation runs only while Home is on screen: off-screen it would re-render for nothing. */
export function DiscoverSearchPlaceholder({
  isActive,
  isNarrow,
}: {
  isActive: boolean;
  isNarrow: boolean;
}) {
  const { palette, typography } = useHungryTheme();
  const movingSearchPlaceholder = useMovingSearchPlaceholder({
    phrases: isNarrow ? NARROW_SEARCH_PLACEHOLDER_PHRASES : DISCOVER_SEARCH_PLACEHOLDER_PHRASES,
    enabled: isActive,
    tickMs: 88,
    revealStepMs: 88,
    deleteStepMs: 55,
    pauseMs: 1_600,
    totalCycleMs: 7_200,
  });

  return (
    <TextInput
      editable={false}
      value=""
      placeholder={movingSearchPlaceholder}
      placeholderTextColor={palette.textSecondary}
      pointerEvents="none"
      style={{
        color: palette.text,
        flex: 1,
        height: 48,
        padding: 0,
        paddingTop: 0,
        paddingBottom: 0,
        includeFontPadding: false,
        ...typography.body,
        textAlignVertical: "center",
      }}
    />
  );
}
