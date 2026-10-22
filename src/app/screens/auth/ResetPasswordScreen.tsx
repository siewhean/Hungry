import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import { getAuthErrorKind, getAuthFailureMessage } from "@/features/auth/authErrors";
import {
  getPasswordUpdateErrorMessage,
  PASSWORD_RULES,
  validateConfirmPassword,
  validatePassword,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { PasswordRequirements } from "./PasswordRequirements";
import { AUTH_EYE_BUTTON_STYLE } from "./authEyeButton";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string; confirmPassword: string };

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const confirmPasswordRef = useRef<TextInput>(null);
  // The reset link's code can be exchanged only once; a retry after a rejected
  // password must call updatePassword alone.
  const recoveryCodeExchangedRef = useRef(route.params?.recoveryVerified === true);
  // An expired, used or cross-device link can never succeed on retry; offer a new one
  // instead of letting the user type a password first.
  const [linkProblem, setLinkProblem] = useState<"expired" | "other_device" | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  // A recovery session exists (the link or code was exchanged): it is a real sign-in.
  const [hasRecoverySession, setHasRecoverySession] = useState(
    route.params?.recoveryVerified === true,
  );
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  const passwordValue = watch("password");

  useEffect(() => {
    trackAuthScreenViewed("reset_password");
  }, []);

  // Leaving the reset flow releases the hold so RootNavigator can route onward.
  useEffect(() => () => setPasswordRecoveryInProgress(false), [setPasswordRecoveryInProgress]);

  // Exchanging the recovery code signs the user in. Hold RootNavigator's signed-in
  // redirect until the new password is saved and confirmed on ResetPasswordSuccess,
  // which releases the hold. Resolves false (with the problem shown) when the link
  // cannot be used.
  const exchangeLinkCode = async (): Promise<boolean> => {
    // Nothing to exchange: an error redirect, or a link cut off before its code.
    if (!recoveryCodeExchangedRef.current && !route.params?.code) {
      setLinkProblem("expired");
      return false;
    }
    setPasswordRecoveryInProgress(true);
    if (!recoveryCodeExchangedRef.current) {
      try {
        await getHungryService().auth.exchangeRecoveryCode(route.params?.code ?? "");
        recoveryCodeExchangedRef.current = true;
      } catch (error) {
        // No session was created, so nothing to hold.
        setPasswordRecoveryInProgress(false);
        trackAuthFailed("password_reset", "email", error);
        // Without the PKCE verifier the link was opened on a different phone than asked.
        setLinkProblem(
          (error as { name?: unknown } | null)?.name === "AuthPKCECodeVerifierMissingError"
            ? "other_device"
            : "expired",
        );
        return false;
      }
    }
    setHasRecoverySession(true);
    return true;
  };

  // Check the link as soon as the screen opens, so a dead link is known before the user
  // types two passwords.
  useEffect(() => {
    if (getConfiguredDataSource() !== "supabase" || recoveryCodeExchangedRef.current) return;
    // The deep link passes `error`; older callers pass `linkError`.
    if (route.params?.linkError ?? route.params?.error) {
      setLinkProblem("expired");
      return;
    }
    setIsCheckingLink(true);
    void exchangeLinkCode().finally(() => setIsCheckingLink(false));
    // Runs once for the link this screen opened with.
  }, []);

  const handleReset = handleSubmit(async ({ password }) => {
    if (getConfiguredDataSource() === "supabase") {
      const auth = getHungryService().auth;
      if (!(await exchangeLinkCode())) return;
      try {
        await auth.updatePassword(password);
      } catch (error) {
        // The recovery session is signed in: keep the hold so the user stays
        // here and can retry with a different password.
        trackAuthFailed("password_reset", "email", error);
        showToast({
          message:
            getAuthErrorKind(error) === "other"
              ? getPasswordUpdateErrorMessage(error)
              : getAuthFailureMessage(error, ""),
          tone: "error",
        });
        return;
      }
    } else {
      setPasswordRecoveryInProgress(true);
    }
    navigation.navigate("ResetPasswordSuccess");
  });

  // A recovery session is already a sign-in. Leaving without a new password signs it out
  // again, so "Back to sign in" never lands the user in the app on a password they did not set.
  const leaveReset = () => {
    if (hasRecoverySession && getConfiguredDataSource() === "supabase") {
      useSessionStore.getState().signOut();
    }
    navigation.navigate("Login");
  };

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title="Set a new password"
        onBack={leaveReset}
        backLabel={hasRecoverySession ? "Cancel" : "Back to sign in"}
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={hasRecoverySession ? "Cancel" : "Back to sign in"}
            accessibilityHint={
              hasRecoverySession
                ? "Leaves without a new password and signs you out"
                : "Returns to the sign in screen"
            }
            onPress={leaveReset}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              minHeight: 44,
            }}
          >
            <ArrowLeft color={palette.text} size={12} />
            <AppText tone="secondary" style={{ fontWeight: "600" }}>
              {hasRecoverySession ? "Cancel" : "Back to sign in"}
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          {linkProblem ? (
            <View
              accessible
              accessibilityRole="alert"
              style={{
                backgroundColor: palette.errorSoft,
                borderRadius: componentRadii.card,
                gap: spacing[2],
                padding: spacing[3],
              }}
            >
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {linkProblem === "other_device"
                  ? "Open this link on the phone you asked for it on. Or send a new link and type the 8-digit code from the email instead."
                  : "This reset link has expired or was already used."}
              </AppText>
              <Button
                label="Send a new link"
                variant="secondary"
                onPress={() => navigation.navigate("ForgotPassword")}
              />
            </View>
          ) : isCheckingLink ? (
            <AppText tone="secondary" accessibilityLiveRegion="polite">
              Checking your reset link…
            </AppText>
          ) : null}
          {linkProblem ? null : (
            <>
              <Controller
                control={control}
                name="password"
                rules={{ validate: (value) => validatePassword(value) }}
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="New password"
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    passwordRules={PASSWORD_RULES}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    value={value}
                    onChangeText={onChange}
                    error={!!errors.password}
                    errorText={errors.password?.message}
                    rightIcon={
                      <Pressable
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                        accessibilityHint={
                          showPassword
                            ? "Hides the password characters"
                            : "Shows the password characters"
                        }
                        onPress={() => setShowPassword((current) => !current)}
                        hitSlop={8}
                        style={AUTH_EYE_BUTTON_STYLE}
                      >
                        {showPassword ? (
                          <EyeOff color={palette.textMuted} size={18} />
                        ) : (
                          <Eye color={palette.textMuted} size={18} />
                        )}
                      </Pressable>
                    }
                  />
                )}
              />
              <Controller
                control={control}
                name="confirmPassword"
                rules={{ validate: (value) => validateConfirmPassword(passwordValue ?? "", value) }}
                render={({ field: { onChange, value } }) => (
                  <Input
                    ref={confirmPasswordRef}
                    label="Confirm new password"
                    secureTextEntry={!showConfirmPassword}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    passwordRules={PASSWORD_RULES}
                    returnKeyType="go"
                    onSubmitEditing={() => void handleReset()}
                    value={value}
                    onChangeText={onChange}
                    error={!!errors.confirmPassword}
                    errorText={errors.confirmPassword?.message}
                    rightIcon={
                      <Pressable
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={
                          showConfirmPassword
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                        accessibilityHint={
                          showConfirmPassword
                            ? "Hides the confirmation password characters"
                            : "Shows the confirmation password characters"
                        }
                        onPress={() => setShowConfirmPassword((current) => !current)}
                        hitSlop={8}
                        style={AUTH_EYE_BUTTON_STYLE}
                      >
                        {showConfirmPassword ? (
                          <EyeOff color={palette.textMuted} size={18} />
                        ) : (
                          <Eye color={palette.textMuted} size={18} />
                        )}
                      </Pressable>
                    }
                  />
                )}
              />

              <View
                style={{
                  backgroundColor: palette.surfaceRaised,
                  borderRadius: componentRadii.card,
                  gap: spacing[2],
                  padding: spacing[4],
                }}
              >
                <PasswordRequirements password={passwordValue ?? ""} />
              </View>

              <Button
                label="Update password"
                onPress={handleReset}
                loading={isSubmitting}
                disabled={isCheckingLink}
                style={{ minHeight: 56 }}
              />
            </>
          )}
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
