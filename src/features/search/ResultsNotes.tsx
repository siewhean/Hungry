import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export type ResultsNote = {
  id: string;
  text: string;
  testID?: string;
  /** A note with an action is one tap target, like a link. */
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
};

/**
 * The notes under the search results (saved copy, relaxed filters, halal tags) one at a time, most
 * important first. Dismissing the note on screen brings up the next one, so the list never stacks
 * rows above the first result. A note stays dismissed until its text changes.
 */
export function ResultsNotes({ notes }: { notes: readonly ResultsNote[] }) {
  const { palette, spacing } = useHungryTheme();
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const noteKey = (note: ResultsNote) => `${note.id}:${note.text}`;
  const note = notes.find((candidate) => !dismissed.includes(noteKey(candidate)));
  if (!note) return null;

  const body = (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}>
      <AppSymbol name="info" color={palette.textMuted} size={16} />
      <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
        {note.text}
        {note.action ? (
          <AppText variant="micro" style={{ color: palette.orangeText, fontWeight: "600" }}>
            {` ${note.action.label}`}
          </AppText>
        ) : null}
      </AppText>
    </View>
  );
  return (
    <View
      accessibilityLabel="Notes about these results"
      accessibilityLiveRegion="polite"
      style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[1] }}
    >
      <View style={{ flex: 1 }}>
        {note.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={note.action.accessibilityLabel}
            onPress={note.action.onPress}
            testID={note.testID}
            style={{ justifyContent: "center", minHeight: 44 }}
          >
            {body}
          </Pressable>
        ) : (
          <View
            accessibilityRole="text"
            testID={note.testID}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            {body}
          </View>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notes"
        hitSlop={4}
        onPress={() => setDismissed((current) => [...current, noteKey(note)])}
        style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
      >
        <AppSymbol name="close" color={palette.textMuted} size={16} />
      </Pressable>
    </View>
  );
}
