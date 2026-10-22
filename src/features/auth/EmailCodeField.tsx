import { useEffect, useState } from "react";
import { View } from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { getAuthFailureMessage } from "./authErrors";

/** Supabase auth.email.otp_length (supabase/config.toml). */
export const EMAIL_CODE_LENGTH = 8;

/** Supabase auth.email.max_frequency (supabase/config.toml): one code email per minute. */
export const EMAIL_CODE_RESEND_SECONDS = 60;

export function normalizeEmailCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}

interface EmailCodeFieldProps {
  /** Verifies the code; throw to show `errorText`. */
  onSubmit: (code: string) => Promise<void>;
  submitLabel?: string;
  errorText?: string;
  label?: string;
  /** Style of the submit button; "destructive" for actions that cannot be undone. */
  submitVariant?: "primary" | "destructive";
  /**
   * Sends a new code. When given, a "Resend code" button appears; it waits
   * EMAIL_CODE_RESEND_SECONDS after the field opens and after each send, because the
   * server allows one code email per minute. Throw to report a failed send.
   */
  onResend?: () => Promise<void>;
}

/** "Enter the code from your email": works when the email's link was opened on another device. */
export function EmailCodeField({
  onSubmit,
  submitLabel = "Continue",
  errorText = "That code is wrong or has expired. Check the latest email, or send a new one.",
  label = "Enter the code from your email",
  submitVariant = "primary",
  onResend,
}: EmailCodeFieldProps) {
  const { spacing } = useHungryTheme();
  const [code, setCode] = useState("");
  // The code was just sent when the field opens, so the first resend waits too.
  const [cooldown, setCooldown] = useState(EMAIL_CODE_RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sent" | "failed">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The message to show; a dropped connection or rate limit is not "wrong code".
  const [failure, setFailure] = useState<string | null>(null);
  const isComplete = code.length === EMAIL_CODE_LENGTH;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (!onResend || cooldown > 0 || isResending) return;
    setIsResending(true);
    setResendState("idle");
    try {
      await onResend();
      setCode("");
      setFailure(null);
      setResendState("sent");
      setCooldown(EMAIL_CODE_RESEND_SECONDS);
    } catch {
      setResendState("failed");
    } finally {
      setIsResending(false);
    }
  };

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
        variant={submitVariant}
        onPress={() => void submit()}
        loading={isSubmitting}
        disabled={!isComplete}
      />
      {onResend ? (
        <>
          {resendState === "sent" ? (
            <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
              A new code is on its way.
            </AppText>
          ) : null}
          {resendState === "failed" ? (
            <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
              We couldn&apos;t send a new code. Please try again in a moment.
            </AppText>
          ) : null}
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            variant="ghost"
            onPress={() => void resend()}
            loading={isResending}
            disabled={cooldown > 0}
          />
        </>
      ) : null}
    </View>
  );
}
