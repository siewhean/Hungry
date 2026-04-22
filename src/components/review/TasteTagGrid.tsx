import { Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";
import type { ReviewTasteTag } from "@/types/domain";
import { REVIEW_TASTE_TAG_META } from "@/types/domain";

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

interface TasteTagGridProps {
  selectedTags: ReviewTasteTag[];
  onToggle: (tag: ReviewTasteTag) => void;
}

/**
 * 12-tag tap-only taste tag selector grid.
 * Per Figma V2 Quick Review spec: 3-column wrapping grid,
 * selected = orange fill + white text, unselected = soft bg + grey text.
 */
export function TasteTagGrid({ selectedTags, onToggle }: TasteTagGridProps) {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <View style={[styles.grid, { gap: spacing[2.5] }]}>
      {ALL_TAGS.map((tag) => {
        const meta = REVIEW_TASTE_TAG_META[tag];
        const isSelected = selectedTags.includes(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => onToggle(tag)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`${meta.label} taste tag`}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? palette.orange : palette.bgSoft,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderWidth: 1.5,
                borderColor: isSelected ? palette.orange : palette.border,
              },
            ]}
          >
            <AppText style={{ fontSize: 16 }}>{meta.emoji}</AppText>
            <AppText
              variant="bodySmall"
              style={{
                color: isSelected ? "#FFFFFF" : palette.text,
                fontWeight: isSelected ? "700" : "500",
              }}
            >
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
