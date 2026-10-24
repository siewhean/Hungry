import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import {
  listItemScoreError,
  parseListItemScore,
} from "@/features/checklistPortfolio/listItemScore";
import { PORTFOLIO_TEXT_MAX_LENGTH } from "@/features/checklistPortfolio/listLabels";
import { useHungryTheme } from "@/theme";

export interface PortfolioItemDetailsInput {
  score?: number;
  publicNotes: string;
  privateNotes: string;
}

interface PortfolioItemEditSheetProps {
  visible: boolean;
  /** The dish or stall being added or edited. */
  title: string;
  /** Which item is open; the fields re-seed when it changes (not when the title loads). */
  itemKey?: string;
  /**
   * False when the server cannot clear a score yet (update_portfolio_item_with_version keeps
   * the old value for a null score): emptying a saved score then asks for 1-10 instead.
   */
  scoreCanBeCleared?: boolean;
  confirmLabel: string;
  initialScore?: number;
  initialPublicNotes?: string;
  initialPrivateNotes?: string;
  isSaving?: boolean;
  onSubmit: (details: PortfolioItemDetailsInput) => void;
  onClose: () => void;
}

/** Score and notes for one list item: shown after choosing an item to add, and to edit one later. */
export function PortfolioItemEditSheet({
  visible,
  title,
  itemKey,
  scoreCanBeCleared = true,
  confirmLabel,
  initialScore,
  initialPublicNotes,
  initialPrivateNotes,
  isSaving = false,
  onSubmit,
  onClose,
}: PortfolioItemEditSheetProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [score, setScore] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");

  // Re-seed each time the sheet opens for an item, not on every parent render.
  useEffect(() => {
    if (!visible) return;
    setScore(initialScore === undefined ? "" : String(initialScore));
    setPublicNotes(initialPublicNotes ?? "");
    setPrivateNotes(initialPrivateNotes ?? "");
  }, [visible, itemKey]);

  const parsedScore = parseListItemScore(score);
  const scoreError =
    listItemScoreError(parsedScore) ??
    (!scoreCanBeCleared && initialScore !== undefined && parsedScore === undefined
      ? "A saved score can't be removed yet. Pick a score from 1 to 10."
      : undefined);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.flex, { backgroundColor: palette.overlay }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            maxHeight: "85%",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing[3], padding: spacing[5] }}
          >
            <AppText variant="h2" numberOfLines={2}>
              {title}
            </AppText>
            <Input
              label="Score"
              value={score}
              onChangeText={setScore}
              keyboardType="number-pad"
              placeholder="Optional"
              maxLength={2}
              error={Boolean(scoreError)}
              errorText={scoreError}
              helperText="Optional. A whole number from 1 to 10, handy for rankings."
            />
            <Input
              label="Public note"
              value={publicNotes}
              onChangeText={setPublicNotes}
              placeholder="Visible when this list is shared"
              maxLength={PORTFOLIO_TEXT_MAX_LENGTH}
              multiline
            />
            <Input
              label="Private note"
              value={privateNotes}
              onChangeText={setPrivateNotes}
              placeholder="Only for you and collaborators"
              maxLength={PORTFOLIO_TEXT_MAX_LENGTH}
              multiline
            />
            <Button
              label={confirmLabel}
              loading={isSaving}
              disabled={Boolean(scoreError) || isSaving}
              onPress={() => onSubmit({ score: parsedScore, publicNotes, privateNotes })}
            />
            <Button label="Cancel" variant="secondary" onPress={onClose} disabled={isSaving} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
