import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";

import { AppText, Button, FeedErrorBoundary, Input, AppSymbol } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackPasswordResetRequested,
} from "@/features/auth/authAnalytics";
import {
  getAuthErrorKind,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "@/features/auth/authErrors";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import { formatCooldown, useResendCooldown } from "@/features/auth/useResendCooldown";
import { validateEmail } from "@/features/auth/validation";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { EmailSuggestionHint, useEmailSuggestion } from "./EmailSuggestion";
import { AUTH_COPY } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;
type FormValues = { email: string };

export function ForgotPasswordScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  // After a send the screen becomes "Check your inbox" instead of bouncing to Login.
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Another reset email within the server's 60s limit only fails, so "Send again" waits.
  const { seconds: resendSeconds, restart: restartResendCooldown } = useResendCooldown(false);
  const emailSuggestion = useEmailSuggestion();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: route.params?.email ?? "" } });
  // A signed-in user ("Forgot current password?") stays signed in and returns to Settings.
  // The hold keeps RootNavigator from sending them Home while this screen is open (a wrong
  // code would otherwise release it and trigger that redirect).
  const fromSignedIn = route.params?.fromSignedIn === true;
  const backLabel = fromSignedIn ? "Back" : AUTH_COPY.forgotPassword.backToLogin;

  useEffect(() => {
    trackAuthScreenViewed("forgot_password");
  }, []);

  useEffect(() => {
    if (!fromSignedIn) return;
    setPasswordRecoveryInProgress(true);
    return () => setPasswordRecoveryInProgress(false);
  }, [fromSignedIn, setPasswordRecoveryInProgress]);

  // The emailed code works when the link was opened on another device. Verifying
  // signs the user in, so hold RootNavigator's redirect until the password is saved.
  const handleResetCode = async (code: string) => {
    if (!sentTo) return;
    setPasswordRecoveryInProgress(true);
    try {
      await getHungryService().auth.verifyEmailCode(sentTo, code, "recovery");
    } catch (error) {
      if (!fromSignedIn) setPasswordRecoveryInProgress(false);
      trackAuthFailed("password_reset", "email", error, "forgot_password");
      if (isUnexpectedAuthError(error)) reportError(error, { flow: "password_reset_code" });
      throw error;
    }
    navigation.navigate("ResetPassword", {
      email: sentTo,
      recoveryVerified: true,
      ...(fromSignedIn ? { fromSignedIn: true } : {}),
    });
  };

  const handleSend = handleSubmit(async ({ email }) => {
    try {
      if (isSupabaseMode) {
        await getHungryService().auth.forgotPassword(email);
        trackPasswordResetRequested();
      }
      setSentTo(email.trim().toLowerCase());
      restartResendCooldown();
    } catch (error) {
      trackAuthFailed("password_reset", "email", error, "forgot_password");
      if (isUnexpectedAuthError(error)) reportError(error, { flow: "password_reset_request" });
      // A 429 means an email went out within the last minute: wait it out, don't retry.
      if (getAuthErrorKind(error) === "rate_limited") restartResendCooldown();
      showToast({
        message: getAuthFailureMessage(error, AUTH_COPY.forgotPassword.genericErrorToast),
        tone: "error",
      });
    }
  });

  return (
    <FeedErrorBoundary
      title={AUTH_COPY.forgotPassword.errorTitle}
      body={AUTH_COPY.forgotPassword.errorBody}
    >
      <AuthScreenShell
        title={sentTo ? AUTH_COPY.forgotPassword.sentShellTitle : AUTH_COPY.forgotPassword.title}
        subtitle={sentTo ? undefined : AUTH_COPY.forgotPassword.subtitle}
        compact
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            accessibilityHint={
              fromSignedIn ? "Returns to the previous screen" : "Returns to the sign in screen"
            }
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Login");
              }
            }}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              minHeight: 44,
            }}
          >
            <AppSymbol name="back" color={palette.text} size={14} />
            <AppText tone="accent" style={{ fontWeight: "700" }}>
              {backLabel}
            </AppText>
          </Pressable>
        }
      >
        {sentTo ? (
          <View style={{ gap: spacing[4] }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: 80,
                  justifyContent: "center",
                  width: 80,
                }}
              >
                <AppSymbol name="emailSent" color={palette.orange} size={30} />
              </View>
            </View>
            <View accessible accessibilityLiveRegion="polite" style={{ gap: spacing[2] }}>
              <AppText tone="secondary" style={{ textAlign: "center" }}>
                {AUTH_COPY.forgotPassword.sentBody.replace("{email}", sentTo)}
              </AppText>
              <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
                {AUTH_COPY.forgotPassword.sentSpamHint}
              </AppText>
            </View>
            <EmailCodeField
              screen="forgot_password"
              onSubmit={handleResetCode}
              submitLabel="Reset password"
            />
            {/* The code is the one primary action; the rest are plain text links. */}
            <View style={{ alignItems: "center", gap: spacing[1] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  resendSeconds > 0
                    ? `Send again, available in ${formatCooldown(resendSeconds)}`
                    : AUTH_COPY.forgotPassword.resendButton
                }
                accessibilityState={{ disabled: resendSeconds > 0 || isSubmitting }}
                disabled={resendSeconds > 0 || isSubmitting}
                onPress={handleSend}
                hitSlop={8}
                style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[2] }}
              >
                <AppText tone={resendSeconds > 0 ? "muted" : "accent"}>
                  {resendSeconds > 0
                    ? AUTH_COPY.forgotPassword.resendInButton.replace(
                        "{time}",
                        formatCooldown(resendSeconds),
                      )
                    : AUTH_COPY.forgotPassword.resendButton}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={AUTH_COPY.forgotPassword.useDifferentEmail}
                onPress={() => setSentTo(null)}
                hitSlop={8}
                style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[2] }}
              >
                <AppText tone="accent">{AUTH_COPY.forgotPassword.useDifferentEmail}</AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing[4] }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: 80,
                  justifyContent: "center",
                  width: 80,
                }}
              >
                <AppSymbol name="resetPassword" color={palette.orange} size={30} />
              </View>
            </View>

            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={() => void handleSend()}
                  label={AUTH_COPY.forgotPassword.emailLabel}
                  value={value}
                  onChangeText={(next) => {
                    emailSuggestion.clear();
                    onChange(next);
                  }}
                  onBlur={() => {
                    onBlur();
                    emailSuggestion.check(value);
                  }}
                  leftIcon={
                    <AppSymbol name="email" color={palette.textMuted} size={16} weight="regular" />
                  }
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
            <Button
              label={AUTH_COPY.forgotPassword.primaryButton}
              onPress={handleSend}
              loading={isSubmitting}
            />
          </View>
        )}
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
