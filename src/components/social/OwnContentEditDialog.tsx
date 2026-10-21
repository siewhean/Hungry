import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { StarRating } from "@/components/review/StarRating";
import { AppText, Button, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export type OwnContentEditValues = { text: string; rating?: number };

type OwnContentEditDialogProps = {
  visible: boolean;
  title: string;
  textLabel: string;
  maxLength: number;
  initialText: string;
  /** Shown as editable stars when set (reviews); omitted for post captions. */
  initialRating?: number;
  onCancel: () => void;
  /** Rejects to keep the dialog open (the caller shows the error). */
  onSave: (values: OwnContentEditValues) => Promise<void>;
};

/** Edit the text (and rating) of the viewer's own post or review. */
export function OwnContentEditDialog({ visible, ...props }: OwnContentEditDialogProps) {
  // Mounted only while open, so each opening starts from the saved text.
  return visible ? <OwnContentEditDialogBody {...props} /> : null;
}

function OwnContentEditDialogBody({
  title,
  textLabel,
  maxLength,
  initialText,
  initialRating,
  onCancel,
  onSave,
}: Omit<OwnContentEditDialogProps, "visible">) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const [text, setText] = useState(initialText);
  const [rating, setRating] = useState(initialRating ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  const hasRating = initialRating !== undefined;
  // A review needs a rating (its text is optional); a caption needs text.
  const canSave = !isSaving && (hasRating ? rating > 0 : text.trim().length > 0);

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({ text, ...(hasRating ? { rating } : {}) });
    } catch {
      // The caller reports the failure; the draft stays so nothing is lost.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.overlay, { backgroundColor: palette.overlay, padding: spacing[6] }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close editor"
          accessibilityHint="Discards your changes"
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.container,
            {
              backgroundColor: palette.surface,
              borderRadius: componentRadii.card,
              gap: spacing[4],
              padding: spacing[6],
              ...shadows.floating,
            },
          ]}
        >
          <AppText accessibilityRole="header" variant="h3">
            {title}
          </AppText>
          {hasRating ? <StarRating value={rating} editable onChange={setRating} /> : null}
          <Input
            label={textLabel}
            value={text}
            onChangeText={setText}
            maxLength={maxLength}
            multiline
            autoFocus
            helperText={`${text.length}/${maxLength}`}
          />
          <View style={{ gap: spacing[3] }}>
            <Button
              label="Save"
              loading={isSaving}
              disabled={!canSave}
              onPress={() => void save()}
              fullWidth
            />
            <Button label="Cancel" variant="ghost" onPress={onCancel} fullWidth />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
  },
  container: {
    alignSelf: "center",
    maxWidth: 400,
    width: "100%",
  },
});
