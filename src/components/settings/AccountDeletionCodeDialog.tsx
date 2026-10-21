import { KeyboardAvoidingView, Modal, Platform, View } from "react-native";

import { AppText, Button } from "@/components/ui";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import { useHungryTheme } from "@/theme";

interface AccountDeletionCodeDialogProps {
  visible: boolean;
  email?: string;
  onSubmit: (code: string) => Promise<void>;
  /** Emails a new code (the dialog waits 60 seconds between sends). */
  onResend: () => Promise<void>;
  onCancel: () => void;
}

/** Asks for the emailed code before an account deletion is queued (any sign-in method). */
export function AccountDeletionCodeDialog({
  visible,
  email,
  onSubmit,
  onResend,
  onCancel,
}: AccountDeletionCodeDialogProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            gap: spacing[3],
            maxWidth: 400,
            padding: spacing[6],
            width: "100%",
          }}
        >
          <AppText variant="h3" accessibilityRole="header">
            Confirm it&apos;s you
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            {email
              ? `We emailed a code to ${email}. Enter it to delete your account.`
              : "We emailed you a code. Enter it to delete your account."}
          </AppText>
          <EmailCodeField
            onSubmit={onSubmit}
            onResend={onResend}
            submitLabel="Delete account"
            submitVariant="destructive"
          />
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
