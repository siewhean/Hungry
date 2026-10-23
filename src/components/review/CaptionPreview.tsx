import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

/** Captions longer than this start folded to two lines, like a video description. */
export const CAPTION_PREVIEW_CHARS = 90;
export const CAPTION_PREVIEW_LINES = 2;

export function captionNeedsMore(text: string, limit = CAPTION_PREVIEW_CHARS): boolean {
  return text.trim().length > limit || text.trim().split("\n").length > CAPTION_PREVIEW_LINES;
}

type Props = {
  text: string;
  /** Small grey line on top of the box, e.g. "28 Mar · Would recommend". */
  meta?: string;
};

/**
 * A review caption shown the way video descriptions are: a soft box with a two-line preview
 * and "...more". Tapping anywhere on the box opens the whole caption; "Show less" folds it.
 */
export function CaptionPreview({ text, meta }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  const foldable = captionNeedsMore(trimmed);
  if (!trimmed && !meta) return null;

  const toggle = () => {
    tapHaptic();
    setExpanded((open) => !open);
  };

  return (
    <Pressable
      accessibilityRole={foldable ? "button" : undefined}
      accessibilityLabel={foldable ? trimmed : undefined}
      accessibilityHint={
        foldable ? (expanded ? "Shows less" : "Shows the whole review") : undefined
      }
      accessibilityState={foldable ? { expanded } : undefined}
      disabled={!foldable}
      onPress={toggle}
      style={({ pressed }) => ({
        backgroundColor: pressed && foldable ? palette.border : palette.bgSoft,
        borderRadius: componentRadii.card,
        gap: spacing[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2.5],
      })}
    >
      {meta ? (
        <AppText variant="micro" tone="secondary" style={{ fontWeight: "700" }}>
          {meta}
        </AppText>
      ) : null}
      {trimmed ? (
        <View>
          <AppText
            variant="bodySmall"
            numberOfLines={foldable && !expanded ? CAPTION_PREVIEW_LINES : undefined}
          >
            {trimmed}
          </AppText>
          {foldable ? (
            <AppText variant="bodySmallBold" style={{ marginTop: spacing[0.5] }}>
              {expanded ? "Show less" : "...more"}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
