import { useState } from "react";
import { View } from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { getAuthFailureMessage } from "./authErrors";

/** Supabase auth.email.otp_length (supabase/config.toml). */
export const EMAIL_CODE_LENGTH = 8;

export function normalizeEmailCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}

interface EmailCodeFieldProps {
  /** Verifies the code; throw to show `errorText`. */
  onSubmit: (code: string) => Promise<void>;
  submitLabel?: string;
  errorText?: string;
  label?: string;
}

/** "Enter the code from your email": works when the email's link was opened on another device. */
export function EmailCodeField({
  onSubmit,
  submitLabel = "Continue",
  errorText = "That code is wrong or has expired. Check the latest email, or send a new one.",
  label = "Enter the code from your email",
}: EmailCodeFieldProps) {
  const { spacing } = useHungryTheme();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The message to show; a dropped connection or rate limit is not "wrong code".
  const [failure, setFailure] = useState<string | null>(null);
  const isComplete = code.length === EMAIL_CODE_LENGTH;

  const submit = async () => {
    if (!isComplete || isSubmitting) return;
    setIsSubmitting(true);
    setFailure(null);
    try {
      await onSubmit(code);
    } catch (error) {
      setFailure(getAuthFailureMessage(error, errorText));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodyBold">{label}</AppText>
      <Input
        accessibilityLabel={label}
        placeholder={"0".repeat(EMAIL_CODE_LENGTH)}
        value={code}
        onChangeText={(value) => setCode(normalizeEmailCode(value))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={EMAIL_CODE_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={failure !== null}
        errorText={failure ?? undefined}
      />
      <Button
        label={submitLabel}
        onPress={() => void submit()}
        loading={isSubmitting}
        disabled={!isComplete}
      />
    </View>
  );
}
