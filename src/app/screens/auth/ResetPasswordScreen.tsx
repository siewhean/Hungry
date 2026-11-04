import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input, AppSymbol } from "@/components/ui";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackPasswordResetCompleted,
} from "@/features/auth/authAnalytics";
import {
  getAuthErrorKind,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "@/features/auth/authErrors";
import {
  getPasswordUpdateErrorMessage,
  PASSWORD_RULES,
  validatePassword,
} from "@/features/auth/validation";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { PasswordRequirements } from "./PasswordRequirements";
import { AUTH_EYE_BUTTON_STYLE } from "./authEyeButton";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string };

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  // Inline copy of the last rejected password, so it is not only a passing toast.
  const [resetError, setResetError] = useState<string | null>(null);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
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
    defaultValues: { password: "" },
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
        trackAuthFailed("password_reset", "email", error, "reset_password");
        const missingVerifier =
          (error as { name?: unknown } | null)?.name === "AuthPKCECodeVerifierMissingError";
        if (!missingVerifier && isUnexpectedAuthError(error)) {
          reportError(error, { flow: "password_reset_link" });
        }
        // Without the PKCE verifier the link was opened on a different phone than asked.
        setLinkProblem(missingVerifier ? "other_device" : "expired");
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
    setResetError(null);
    let otherDevicesSignedOut = false;
    if (getConfiguredDataSource() === "supabase") {
      const auth = getHungryService().auth;
      if (!(await exchangeLinkCode())) return;
      try {
        await auth.updatePassword(password);
      } catch (error) {
        // The recovery session is signed in: keep the hold so the user stays
        // here and can retry with a different password.
        trackAuthFailed("password_reset", "email", error, "reset_password");
        if (isUnexpectedAuthError(error)) reportError(error, { flow: "password_reset_update" });
        setResetError(
          getAuthErrorKind(error) === "other"
            ? getPasswordUpdateErrorMessage(error)
            : getAuthFailureMessage(error, ""),
        );
        return;
      }
      // A reset is often the answer to a stolen password: end every other session. The new
      // password is already saved, so a failure here is reported and the reset still finishes.
      try {
        await auth.signOut({ scope: "others" });
        otherDevicesSignedOut = true;
      } catch (error) {
        reportError(error, { flow: "password_reset_sign_out_others" });
      }
    } else {
      setPasswordRecoveryInProgress(true);
    }
    trackPasswordResetCompleted();
    navigation.navigate("ResetPasswordSuccess", { otherDevicesSignedOut });
  });

  // A recovery session is already a sign-in. Leaving without a new password signs it out
  // again, so "Back to sign in" never lands the user in the app on a password they did not set.
  // A user who was signed in before ("Forgot current password?" in Settings) stays signed in
  // and goes back to where they came from.
  const fromSignedIn = route.params?.fromSignedIn === true;
  const leavingRef = useRef(false);
  const leaveReset = () => {
    leavingRef.current = true;
    if (fromSignedIn) {
      const parent = navigation.getParent();
      if (parent?.canGoBack()) parent.goBack();
      else navigation.goBack();
      return;
    }
    if (hasRecoverySession && getConfiguredDataSource() === "supabase") {
      useSessionStore.getState().signOut();
    }
    navigation.navigate("Login");
  };

  // Swipe-back and the Android back button leave the same way as Cancel, so they never
  // leave a recovery session signed in without a new password.
  const mustSignOutOnLeave =
    hasRecoverySession && !fromSignedIn && getConfiguredDataSource() === "supabase";
  useEffect(() => {
    if (!mustSignOutOnLeave) return;
    return navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current) return;
      event.preventDefault();
      leaveReset();
    });
  });

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title="Set a new password"
        compact
        onBack={leaveReset}
        backLabel={hasRecoverySession ? "Cancel" : "Back to sign in"}
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={hasRecoverySession ? "Cancel" : "Back to sign in"}
            accessibilityHint={
              fromSignedIn
                ? "Leaves without changing your password"
                : hasRecoverySession
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
            <AppSymbol name="back" color={palette.text} size={12} />
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
                onPress={() =>
                  navigation.navigate(
                    "ForgotPassword",
                    route.params?.email ? { email: route.params.email } : undefined,
                  )
                }
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
                    returnKeyType="go"
                    onSubmitEditing={() => void handleReset()}
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
                          <AppSymbol
                            name="hidePassword"
                            color={palette.textMuted}
                            size={18}
                            weight="regular"
                          />
                        ) : (
                          <AppSymbol
                            name="showPassword"
                            color={palette.textMuted}
                            size={18}
                            weight="regular"
                          />
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

              {resetError ? (
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
                    {resetError}
                  </AppText>
                </View>
              ) : null}

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
