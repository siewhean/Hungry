import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp, Info, X } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export type ResultsNote = {
  id: string;
  text: string;
  testID?: string;
  /** A note with an action is one tap target, like a link. */
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
};

/**
 * The notes under the search results (saved copy, halal tags, distances) as one line the user can
 * dismiss. A second and third note sit behind "+N more" instead of each taking a line of the screen.
 * A dismissed set stays dismissed until the set of notes changes.
 */
export function ResultsNotes({ notes }: { notes: readonly ResultsNote[] }) {
  const { palette, spacing } = useHungryTheme();
  const [expanded, setExpanded] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const key = notes.map((note) => note.id).join("|");
  if (notes.length === 0 || dismissedKey === key) return null;

  const shown = expanded ? notes : notes.slice(0, 1);
  const hidden = notes.length - shown.length;
  return (
    <View
      accessibilityLabel="Notes about these results"
      style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[1] }}
    >
      <View style={{ flex: 1, gap: spacing[1] }}>
        {shown.map((note) => {
          const body = (
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}>
              <Info color={palette.textMuted} size={16} />
              <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
                {note.text}
                {note.action ? (
                  <AppText variant="micro" style={{ color: palette.orange }}>
                    {` ${note.action.label}`}
                  </AppText>
                ) : null}
              </AppText>
            </View>
          );
          return note.action ? (
            <Pressable
              key={note.id}
              accessibilityRole="button"
              accessibilityLabel={note.action.accessibilityLabel}
              onPress={note.action.onPress}
              testID={note.testID}
              style={{ justifyContent: "center", minHeight: 44 }}
            >
              {body}
            </Pressable>
          ) : (
            <View key={note.id} accessibilityRole="text" testID={note.testID}>
              {body}
            </View>
          );
        })}
        {notes.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Show fewer notes" : `Show ${hidden} more notes`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((current) => !current)}
            style={{
              alignItems: "center",
              alignSelf: "flex-start",
              flexDirection: "row",
              gap: spacing[1],
              minHeight: 44,
            }}
          >
            <AppText variant="micro" style={{ color: palette.orange }}>
              {expanded ? "Show fewer" : `+${hidden} more`}
            </AppText>
            {expanded ? (
              <ChevronUp color={palette.orange} size={14} />
            ) : (
              <ChevronDown color={palette.orange} size={14} />
            )}
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notes"
        hitSlop={4}
        onPress={() => setDismissedKey(key)}
        style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
      >
        <X color={palette.textMuted} size={16} />
      </Pressable>
    </View>
  );
}
