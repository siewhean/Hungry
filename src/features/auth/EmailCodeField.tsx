import { useRef, useState } from "react";
import { View, type TextInput } from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { trackEmailCodeSubmitted, type AuthFunnelScreen } from "./authAnalytics";
import { getAuthFailureMessage } from "./authErrors";
import { RESEND_COOLDOWN_SECONDS, formatCooldown, useResendCooldown } from "./useResendCooldown";

/** Supabase auth.email.otp_length (supabase/config.toml). */
export const EMAIL_CODE_LENGTH = 8;

/**
 * Supabase auth.email.max_frequency (supabase/config.toml) is one code email per minute; the
 * shared cooldown adds a few seconds of margin, so every auth screen waits the same time.
 */
export const EMAIL_CODE_RESEND_SECONDS = RESEND_COOLDOWN_SECONDS;

export function normalizeEmailCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}

/**
 * Room for the separators a pasted code can carry ("1234 5678"), so a native maxLength does
 * not cut the paste before normalizeEmailCode strips it.
 */
const EMAIL_CODE_MAX_INPUT_LENGTH = EMAIL_CODE_LENGTH + 4;

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
  /** The screen to report `email_code_submitted` for; no event without it. */
  screen?: AuthFunnelScreen;
  /** Focus the field when it appears (the code step after a send). */
  autoFocus?: boolean;
}

/** "Enter the code from your email": works when the email's link was opened on another device. */
export function EmailCodeField({
  onSubmit,
  submitLabel = "Continue",
  errorText = "That code is wrong or has expired. Check the latest email, or send a new one.",
  label = "Enter the code from your email",
  submitVariant = "primary",
  onResend,
  screen,
  autoFocus = false,
}: EmailCodeFieldProps) {
  const { palette, spacing } = useHungryTheme();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  // The code was just sent when the field opens, so the first resend waits too.
  // It runs from an end time, so a backgrounded app cannot end the wait early or late.
  const { seconds: cooldown, restart: restartCooldown } = useResendCooldown(true);
  const [isResending, setIsResending] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sent" | "failed">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The message to show; a dropped connection or rate limit is not "wrong code".
  const [failure, setFailure] = useState<string | null>(null);
  const isComplete = code.length === EMAIL_CODE_LENGTH;
  // The code the field last submitted by itself. A wrong code is not sent again until the
  // value is edited; the button stays for a deliberate retry.
  const autoSubmittedRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  const resend = async () => {
    if (!onResend || cooldown > 0 || isResending) return;
    setIsResending(true);
    setResendState("idle");
    try {
      await onResend();
      setCode("");
      autoSubmittedRef.current = null;
      setFailure(null);
      setResendState("sent");
      restartCooldown();
    } catch {
      setResendState("failed");
    } finally {
      setIsResending(false);
    }
  };

  const submit = async (value: string, how: { auto: boolean; paste: boolean }) => {
    if (value.length !== EMAIL_CODE_LENGTH || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setFailure(null);
    if (screen) trackEmailCodeSubmitted(screen, how);
    try {
      await onSubmit(value);
    } catch (error) {
      setFailure(getAuthFailureMessage(error, errorText));
      // The wrong digits go, so a retry starts from an empty field.
      setCode("");
      autoSubmittedRef.current = null;
      inputRef.current?.focus();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleChange = (raw: string) => {
    const next = normalizeEmailCode(raw);
    // More than one character at once is a paste or one-time-code autofill.
    const paste = Math.abs(raw.length - code.length) > 1;
    setCode(next);
    if (next.length < EMAIL_CODE_LENGTH) {
      autoSubmittedRef.current = null;
      return;
    }
    if (autoSubmittedRef.current === next) return;
    autoSubmittedRef.current = next;
    void submit(next, { auto: true, paste });
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodyBold">{label}</AppText>
      <Input
        ref={inputRef}
        accessibilityLabel={label}
        placeholder={`${EMAIL_CODE_LENGTH}-digit code`}
        value={code}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={EMAIL_CODE_MAX_INPUT_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => void submit(code, { auto: false, paste: false })}
        error={failure !== null}
      />
      {failure ? (
        <AppText
          variant="bodySmall"
          style={{ color: palette.error }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {failure}
        </AppText>
      ) : null}
      <Button
        label={submitLabel}
        variant={submitVariant}
        onPress={() => void submit(code, { auto: false, paste: false })}
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
            label={cooldown > 0 ? `Resend code in ${formatCooldown(cooldown)}` : "Resend code"}
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
