import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";
import type { ReviewTasteTag } from "@/types/domain";
import { REVIEW_TASTE_TAG_META } from "@/types/domain";

interface TasteTagGridProps {
  selectedTags: ReviewTasteTag[];
  onToggle: (tag: ReviewTasteTag) => void;
}

const ALL_TAGS: ReviewTasteTag[] = [
  "spicy",
  "savoury",
  "sweet",
  "sour",
  "generous",
  "fresh",
  "worth_it",
  "cold_refreshing",
  "rich_broth",
  "chewy_noodles",
  "hot_fresh",
  "quick_service",
];

/**
 * 12 tap-only taste tags in a wrapping grid.
 * Per Figma V2: selected = orange bg + white text, unselected = soft bg + grey text.
 * No mandatory text — tags do the work.
 */
export function TasteTagGrid({ selectedTags, onToggle }: TasteTagGridProps) {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing[2],
      }}
    >
      {ALL_TAGS.map((tag) => {
        const meta = REVIEW_TASTE_TAG_META[tag];
        const isSelected = selectedTags.includes(tag);

        return (
          <Pressable
            key={tag}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label} taste tag`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              onToggle(tag);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={{
              backgroundColor: isSelected ? palette.orange : palette.bgSoft,
              borderRadius: radii.md,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              minHeight: 40,
              justifyContent: "center",
            }}
          >
            <AppText
              variant="bodySmall"
              style={{
                color: isSelected ? "#FFFFFF" : palette.textMuted,
                fontWeight: isSelected ? "700" : "500",
              }}
            >
              {meta.emoji} {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
