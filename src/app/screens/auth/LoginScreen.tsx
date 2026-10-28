import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, InlineBanner, Input } from "@/components/ui";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackSignInSubmitted,
} from "@/features/auth/authAnalytics";
import { getAuthErrorCode, isUnexpectedAuthError } from "@/features/auth/authErrors";
import { useEmailCodeFirst } from "@/features/auth/useEmailCodeFirst";
import { useSignedInProfileSync } from "@/features/auth/useSignedInProfileSync";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { validateEmail, validateRequired } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore, type AuthNotice } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButtons } from "./AuthProviderButtons";
import { AuthScreenShell } from "./AuthScreenShell";
import { AuthTermsNotice } from "./AuthTermsNotice";
import { AuthTextLink } from "./AuthTextLink";
import { EmailCodeEntry } from "./EmailCodeEntry";
import { EmailSuggestionHint, useEmailSuggestion } from "./EmailSuggestion";
import { ProfileSyncFailureBanner } from "./ProfileSyncFailureBanner";
import { AUTH_EYE_BUTTON_STYLE } from "./authEyeButton";
import { AUTH_COPY, getProviderErrorMessage, type AuthProvider } from "./authCopy";
import { getAuthErrorLogContext, getLoginErrorMessage } from "./authErrors";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;
type FormValues = { email: string; password: string };

export function LoginScreen({ navigation, route }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const emailCodeFirst = useEmailCodeFirst();
  // "Use a password instead": an account that has a password can still sign in with it.
  const [passwordChosen, setPasswordChosen] = useState(false);
  const showPasswordForm = !emailCodeFirst || passwordChosen;
  const profileSync = useSignedInProfileSync("login");
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const pendingAuthNotice = useSessionStore((state) => state.authNotice);
  const showToast = useUIStore((state) => state.showToast);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);

  // One-shot notices (session expiry, account deletion confirmation) are set
  // before the signed-out navigator mounts; show them here, then clear them.
  useEffect(() => {
    if (!sessionExpired && !pendingAuthNotice) return;
    const notice = useSessionStore.getState().consumeAuthNotice();
    if (notice) setAuthNotice(notice);
  }, [pendingAuthNotice, sessionExpired]);
  // Inline copy of the last server error, so it is not only a passing toast.
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [wrongPassword, setWrongPassword] = useState(false);
  // Exposed only once a wrong-password message is on screen: that is where the nudge shows.
  const resetNudge = useExperimentVariant("auth_login_reset_nudge_v1", {
    enabled: wrongPassword,
  });
  const showResetNudge = wrongPassword && resetNudge === "nudge";
  const emailSuggestion = useEmailSuggestion();

  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { email: route.params?.email ?? "", password: "" },
  });
  const isBusy = isSubmitting || providerInFlight !== null;

  useEffect(() => {
    trackAuthScreenViewed("login");
  }, []);

  // The code in the email already sent still works, so open the code screen with the
  // address instead of sending (and spending) another email. Resend waits there.
  const openEmailVerification = () => {
    const email = unconfirmedEmail ?? getValues("email");
    if (!email) return;
    navigation.navigate("EmailVerification", { email: email.trim().toLowerCase() });
  };

  const openForgotPassword = () => {
    const email = getValues("email").trim().toLowerCase();
    navigation.navigate("ForgotPassword", email ? { email } : undefined);
  };

  // With Supabase the auth listener decides from the account whether first-run onboarding
  // runs (a new account that confirmed elsewhere still gets it); the mock has no listener,
  // and its accounts always exist.
  const finishSignIn = (authProvider?: AuthProvider | "email") => {
    const isMock = getConfiguredDataSource() !== "supabase";
    completeAuth({
      ...(authProvider ? { authProvider, trackSignInEvent: isMock } : {}),
      completedOnboarding: isMock,
    });
  };

  const handleLogin = handleSubmit(async (values) => {
    setFormError(null);
    setUnconfirmedEmail(null);
    setWrongPassword(false);
    trackSignInSubmitted("login", "email");
    try {
      const session = await getHungryService().auth.signIn(values.email, values.password);
      await profileSync.apply(session, {
        onSyncWarning: () =>
          showToast({ message: AUTH_COPY.emailCode.syncWarning, tone: "warning" }),
        onSynced: () => finishSignIn(),
      });
    } catch (err) {
      trackAuthFailed("sign_in", "email", err, "login");
      // Diagnostics only: provider code/status, never the email or password.
      console.warn("[auth] Email sign-in failed", getAuthErrorLogContext(err));
      if (isUnexpectedAuthError(err)) reportError(err, { flow: "sign_in", provider: "email" });
      const code = getAuthErrorCode(err);
      const message = getLoginErrorMessage(err);
      if (code === "email_not_confirmed") setUnconfirmedEmail(values.email);
      if (code === "invalid_credentials") setWrongPassword(true);
      // The inline banner is the one announcement; a toast on top would read twice.
      setFormError(message);
    }
  });

  const handleProviderLogin = async (provider: AuthProvider) => {
    if (isBusy) return;
    setFormError(null);
    setProviderInFlight(provider);
    try {
      if (getConfiguredDataSource() === "supabase") {
        const auth = getHungryService().auth;
        const session = await (provider === "google"
          ? auth.signInWithGoogle()
          : auth.signInWithApple());
        await profileSync.apply(session, {
          onSyncWarning: () =>
            showToast({ message: AUTH_COPY.emailCode.syncWarning, tone: "warning" }),
          onSynced: () => finishSignIn(provider),
        });
        return;
      }
      finishSignIn(provider);
    } catch (err) {
      trackAuthFailed("sign_in", provider, err, "login");
      const message = getProviderErrorMessage(err, provider, {
        cancelled: AUTH_COPY.login.providerCancelledToast,
        failed: AUTH_COPY.login.providerFailedToast,
      });
      if (message === AUTH_COPY.login.providerCancelledToast) {
        // Cancelling is not an error: a passing toast, no red banner.
        showToast({ message, tone: "warning" });
      } else {
        reportError(err, { flow: "sign_in", provider });
        setFormError(message);
      }
    } finally {
      setProviderInFlight(null);
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.login.errorTitle} body={AUTH_COPY.login.errorBody}>
      <AuthScreenShell
        title={route.params?.title ?? AUTH_COPY.login.title}
        compact
        footer={
          <View style={{ alignItems: "center", gap: spacing[2] }}>
            {emailCodeFirst ? <AuthTermsNotice prefix={AUTH_COPY.emailCode.termsPrefix} /> : null}
            <View
              testID="login-footer"
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: spacing[2],
              }}
            >
              <AppText tone="secondary">{AUTH_COPY.login.footerPrompt}</AppText>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={AUTH_COPY.login.footerAction}
                accessibilityHint="Opens the account creation screen"
                onPress={() => navigation.navigate("SignUp")}
                hitSlop={8}
                style={{ justifyContent: "center", minHeight: 44 }}
              >
                <AppText variant="bodyBold" tone="accent">
                  {AUTH_COPY.login.footerAction}
                </AppText>
              </Pressable>
            </View>
          </View>
        }
      >
        <View style={{ gap: spacing[4] }}>
          {authNotice ? <InlineBanner message={authNotice.message} tone={authNotice.tone} /> : null}
          {/* One layout on every auth screen: Apple, Google, then email. A provider shows only
              where it is enabled and allowed (authProviders.ts). */}
          <AuthProviderButtons
            disabled={isBusy}
            divider={AUTH_COPY.login.divider}
            onPress={(provider) => void handleProviderLogin(provider)}
          />
          {profileSync.failed ? (
            <ProfileSyncFailureBanner
              onRetry={() => void profileSync.retry()}
              retrying={profileSync.isRetrying}
            />
          ) : null}

          {!showPasswordForm ? (
            <>
              {formError ? <InlineBanner message={formError} tone="error" /> : null}
              <EmailCodeEntry
                screen="login"
                askName={false}
                initialEmail={route.params?.email}
                onSignedIn={() => finishSignIn("email")}
                onUsePassword={() => {
                  setFormError(null);
                  setPasswordChosen(true);
                }}
              />
            </>
          ) : (
            <>
              <View style={{ gap: spacing[2] }}>
                <Controller
                  control={control}
                  name="email"
                  rules={{ validate: validateEmail }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      label={AUTH_COPY.login.emailLabel}
                      value={value}
                      onChangeText={(next) => {
                        emailSuggestion.clear();
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

                <Controller
                  control={control}
                  name="password"
                  rules={{
                    validate: (value) =>
                      validateRequired(value, AUTH_COPY.login.passwordValidationLabel),
                  }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        ref={passwordRef}
                        label={AUTH_COPY.login.passwordLabel}
                        secureTextEntry={!showPassword}
                        textContentType="password"
                        autoComplete="current-password"
                        returnKeyType="go"
                        onSubmitEditing={() => void handleLogin()}
                        value={value}
                        onChangeText={onChange}
                        leftIcon={<Lock color={palette.textMuted} size={18} />}
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
                        error={!!errors.password}
                        errorText={errors.password?.message}
                      />
                      <View style={{ alignItems: "flex-end" }}>
                        <Pressable
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel={AUTH_COPY.login.forgotPasswordLink}
                          accessibilityHint="Opens password reset"
                          onPress={openForgotPassword}
                          hitSlop={8}
                          style={{ justifyContent: "center", minHeight: 44 }}
                        >
                          <AppText variant="bodySmall" tone="accent">
                            {AUTH_COPY.login.forgotPasswordLink}
                          </AppText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                />
              </View>

              {formError ? (
                <View
                  accessible={!unconfirmedEmail && !showResetNudge}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={{
                    backgroundColor: palette.errorSoft,
                    borderRadius: componentRadii.card,
                    gap: spacing[1],
                    padding: spacing[3],
                  }}
                >
                  <AppText variant="bodySmall" style={{ color: palette.error }}>
                    {formError}
                  </AppText>
                  {unconfirmedEmail ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={AUTH_COPY.login.verifyEmailAction}
                      accessibilityHint="Opens the screen to type the code from the email"
                      onPress={openEmailVerification}
                      style={{ justifyContent: "center", minHeight: 44 }}
                    >
                      <AppText variant="bodyBold" tone="accent">
                        {AUTH_COPY.login.verifyEmailAction}
                      </AppText>
                    </Pressable>
                  ) : null}
                  {showResetNudge ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Reset password"
                      accessibilityHint="Opens password reset with your email filled in"
                      onPress={openForgotPassword}
                      style={{ justifyContent: "center", minHeight: 44 }}
                    >
                      <AppText variant="bodyBold" tone="accent">
                        Reset password
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Button
                label={AUTH_COPY.login.primaryButton}
                onPress={handleLogin}
                loading={isSubmitting}
                disabled={isBusy}
                rightIcon={<ArrowRight size={18} color={palette.textOnOrange} />}
              />
              {emailCodeFirst ? (
                <View style={{ alignItems: "center" }}>
                  <AuthTextLink
                    label={AUTH_COPY.emailCode.useCode}
                    onPress={() => {
                      setPasswordChosen(false);
                      setFormError(null);
                    }}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
