import { useEffect, useState } from "react";
import { Modal, ScrollView, View } from "react-native";

import { AppText, Button, Chip } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export const DELETION_REASONS = [
  { value: "too_many_notifications", label: "Too many notifications" },
  { value: "privacy", label: "Privacy concerns" },
  { value: "not_useful", label: "Not finding what I need" },
  { value: "other_app", label: "Using another app" },
  { value: "other", label: "Something else" },
] as const;

export type DeletionReason = (typeof DELETION_REASONS)[number]["value"];

interface AccountDeletionDialogProps {
  visible: boolean;
  message: string;
  /** Runs the data export; the dialog stays open so the person can carry on afterwards. */
  onDownloadData: () => void;
  isDownloading: boolean;
  /** Emails the confirmation code; `reason` is the optional chip, or null when none was picked. */
  onContinue: (reason: DeletionReason | null) => void;
  onCancel: () => void;
}

/**
 * First step of deleting an account: what happens, an optional one-tap reason, a way to take a
 * copy of your data first, then "Email me a code". Delete stays one tap and the main button.
 */
export function AccountDeletionDialog({
  visible,
  message,
  onDownloadData,
  isDownloading,
  onContinue,
  onCancel,
}: AccountDeletionDialogProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [reason, setReason] = useState<DeletionReason | null>(null);

  // A reason picked in an earlier attempt is not carried into the next one.
  useEffect(() => {
    if (!visible) setReason(null);
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          backgroundColor: palette.overlay,
          flex: 1,
          justifyContent: "center",
          padding: spacing[6],
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            alignSelf: "center",
            backgroundColor: palette.surface,
            borderRadius: componentRadii.card,
            maxHeight: "100%",
            maxWidth: 400,
            width: "100%",
          }}
        >
          <ScrollView contentContainerStyle={{ gap: spacing[3], padding: spacing[6] }}>
            <AppText variant="h3" accessibilityRole="header">
              Delete account
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {message}
            </AppText>
            <AppText variant="bodySmall" tone="secondary" style={{ fontWeight: "600" }}>
              Why are you leaving? (optional)
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {DELETION_REASONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={reason === option.value}
                  onPress={() =>
                    setReason((current) => (current === option.value ? null : option.value))
                  }
                />
              ))}
            </View>
            <Button
              label="Download my data first"
              variant="secondary"
              loading={isDownloading}
              onPress={onDownloadData}
            />
            <Button
              label="Email me a code"
              variant="destructive"
              onPress={() => onContinue(reason)}
            />
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
