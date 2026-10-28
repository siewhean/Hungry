import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View, type TextInput } from "react-native";
import { Mail } from "lucide-react-native";

import { AppText, Button, Input } from "@/components/ui";
import {
  trackAuthFailed,
  trackEmailCodeRequested,
  trackSignInSubmitted,
  trackSignUpSubmitted,
  type AuthFunnelScreen,
} from "@/features/auth/authAnalytics";
import {
  getAuthErrorCode,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "@/features/auth/authErrors";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import { useSignedInProfileSync } from "@/features/auth/useSignedInProfileSync";
import { validateDisplayName, validateEmail } from "@/features/auth/validation";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AUTH_COPY } from "./authCopy";
import { AuthTextLink } from "./AuthTextLink";
import { DisplayNameField } from "./DisplayNameField";
import { EmailSuggestionHint, useEmailSuggestion } from "./EmailSuggestion";
import { ProfileSyncFailureBanner } from "./ProfileSyncFailureBanner";

type FormValues = { displayName: string; email: string };

interface EmailCodeEntryProps {
  /** The surface this form sits on, for analytics and error reports. */
  screen: AuthFunnelScreen;
  /** Sign-up asks for the name shown on reviews; sign-in does not. */
  askName: boolean;
  initialEmail?: string;
  /** Finishes the sign-in for this surface (completeAuth and onward). Runs once the profile is in. */
  onSignedIn: () => void | Promise<void>;
  /** When given, a "Use a password instead" link sits under the email step. */
  onUsePassword?: () => void;
  /** Tighter spacing for short screens. */
  compact?: boolean;
}

/**
 * The one email-code form behind Login, Create account and the onboarding account step: an
 * email (and, for a new account, the name) then the 8-digit code, no password. An address with
 * no account becomes one, and the screen never says which it was, so the form cannot be used to
 * find out who has an account. Sync failures after the code is accepted stay on screen with
 * a retry (useSignedInProfileSync).
 */
export function EmailCodeEntry({
  screen,
  askName,
  initialEmail = "",
  onSignedIn,
  onUsePassword,
  compact = false,
}: EmailCodeEntryProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Inline copy of the last server error, so it is not only a passing toast.
  const [formError, setFormError] = useState<string | null>(null);
  const sentNameRef = useRef<string | undefined>(undefined);
  const emailRef = useRef<TextInput>(null);
  const profileSync = useSignedInProfileSync(screen);
  const emailSuggestion = useEmailSuggestion();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { displayName: "", email: initialEmail } });

  const sendCode = async (email: string, displayName: string | undefined, resend: boolean) => {
    await getHungryService().auth.signInWithEmailCode(email, { displayName });
    trackEmailCodeRequested(screen, resend);
  };

  const failureMessage = (error: unknown) =>
    getAuthErrorCode(error) === "email_address_invalid"
      ? AUTH_COPY.signUp.invalidEmailToast
      : getAuthFailureMessage(error, AUTH_COPY.emailCode.sendFailed);

  const handleSend = handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    const displayName = askName ? values.displayName.trim() : undefined;
    try {
      await sendCode(email, displayName, false);
    } catch (error) {
      trackAuthFailed("email_code", "email", error, screen);
      if (isUnexpectedAuthError(error)) reportError(error, { screen, action: "send_code" });
      setFormError(failureMessage(error));
      return;
    }
    // Sign-up tests count creating an account; a sign-in is its own denominator.
    if (askName) trackSignUpSubmitted(screen, "email_code");
    else trackSignInSubmitted(screen, "email_code");
    sentNameRef.current = displayName;
    setSentTo(email);
  });

  const handleResend = async () => {
    if (!sentTo) return;
    try {
      await sendCode(sentTo, sentNameRef.current, true);
    } catch (error) {
      trackAuthFailed("email_code", "email", error, screen);
      if (isUnexpectedAuthError(error)) reportError(error, { screen, action: "resend_code" });
      throw error;
    }
  };

  const handleVerify = async (code: string) => {
    if (!sentTo) return;
    let session;
    try {
      session = await getHungryService().auth.verifyEmailCode(sentTo, code, "email");
      if (!session) throw new Error("Code accepted but no active session.");
    } catch (error) {
      trackAuthFailed("email_code", "email", error, screen);
      if (isUnexpectedAuthError(error)) reportError(error, { screen, action: "verify_code" });
      throw error;
    }
    await profileSync.apply(session, {
      onSyncWarning: () => showToast({ message: AUTH_COPY.emailCode.syncWarning, tone: "warning" }),
      onSynced: onSignedIn,
    });
  };

  if (sentTo) {
    return (
      <View style={{ gap: spacing[4] }}>
        <View accessible accessibilityLiveRegion="polite" style={{ gap: spacing[1] }}>
          <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
            {AUTH_COPY.emailCode.sentTitle}
          </AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }}>
            {AUTH_COPY.emailCode.sentBody.replace("{email}", sentTo)}
          </AppText>
        </View>
        {profileSync.failed ? (
          <ProfileSyncFailureBanner
            onRetry={() => void profileSync.retry()}
            retrying={profileSync.isRetrying}
          />
        ) : null}
        <EmailCodeField
          screen={screen}
          autoFocus
          label={AUTH_COPY.emailCode.codeLabel}
          submitLabel={AUTH_COPY.emailCode.verifyButton}
          onSubmit={handleVerify}
          onResend={handleResend}
        />
        <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
          {AUTH_COPY.emailCode.sentSpamHint}
        </AppText>
        <View style={{ alignItems: "center" }}>
          <AuthTextLink
            label={AUTH_COPY.emailCode.wrongEmail}
            onPress={() => {
              setSentTo(null);
              setFormError(null);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: compact ? spacing[3] : spacing[4] }}>
      <View style={{ gap: spacing[2] }}>
        {askName ? (
          <Controller
            control={control}
            name="displayName"
            rules={{ validate: (value) => validateDisplayName(value) }}
            render={({ field: { onChange, value } }) => (
              <DisplayNameField
                value={value}
                onChangeText={onChange}
                errorText={errors.displayName?.message}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name="email"
          rules={{ validate: validateEmail }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              ref={emailRef}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={() => void handleSend()}
              label={AUTH_COPY.emailCode.emailLabel}
              value={value}
              onChangeText={(next) => {
                emailSuggestion.clear();
                // A send error belongs to the address it was for.
                setFormError(null);
                onChange(next);
              }}
              onBlur={() => {
                onBlur();
                emailSuggestion.check(value);
              }}
              leftIcon={<Mail color={palette.textMuted} size={18} />}
              error={!!errors.email}
              errorText={errors.email?.message}
            />
          )}
        />
        <EmailSuggestionHint
          suggestion={emailSuggestion.suggestion}
          onAccept={(address) => {
            setValue("email", address, { shouldValidate: true });
            emailSuggestion.clear();
          }}
        />
      </View>

      {formError ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: palette.errorSoft,
            borderRadius: componentRadii.card,
            padding: spacing[3],
          }}
        >
          <AppText variant="bodySmall" style={{ color: palette.error }}>
            {formError}
          </AppText>
        </View>
      ) : null}

      <Button
        label={AUTH_COPY.emailCode.continueButton}
        onPress={handleSend}
        loading={isSubmitting}
      />
      {onUsePassword ? (
        <View style={{ alignItems: "center" }}>
          <AuthTextLink label={AUTH_COPY.emailCode.usePassword} onPress={onUsePassword} />
        </View>
      ) : null}
    </View>
  );
}
