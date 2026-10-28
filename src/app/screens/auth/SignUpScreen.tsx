import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { AccessibilityInfo, Pressable, View, type TextInput } from "react-native";
import { Eye, EyeOff, Mail, Lock } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackSignUpSubmitted,
} from "@/features/auth/authAnalytics";
import {
  getAuthErrorCode,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "@/features/auth/authErrors";
import { useEmailCodeFirst } from "@/features/auth/useEmailCodeFirst";
import { useSignedInProfileSync } from "@/features/auth/useSignedInProfileSync";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import {
  isWeakPasswordError,
  PASSWORD_RULES,
  validateDisplayName,
  validateEmail,
  validatePassword,
  WEAK_PASSWORD_MESSAGE,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButtons } from "./AuthProviderButtons";
import { AuthScreenShell } from "./AuthScreenShell";
import { AuthTextLink } from "./AuthTextLink";
import { DisplayNameField } from "./DisplayNameField";
import { EmailCodeEntry } from "./EmailCodeEntry";
import { EmailSuggestionHint, useEmailSuggestion } from "./EmailSuggestion";
import { PasswordRequirements } from "./PasswordRequirements";
import { ProfileSyncFailureBanner } from "./ProfileSyncFailureBanner";
import { AUTH_EYE_BUTTON_STYLE } from "./authEyeButton";
import { AuthTermsNotice } from "./AuthTermsNotice";
import { AUTH_COPY, getProviderErrorMessage, type AuthProvider } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

export function SignUpScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const emailCodeFirst = useEmailCodeFirst();
  // "Use a password instead": the older form, for people who prefer one.
  const [passwordChosen, setPasswordChosen] = useState(false);
  const showPasswordForm = !emailCodeFirst || passwordChosen;
  const profileSync = useSignedInProfileSync("sign_up");
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  // A visible field reads every typed character aloud, so screen-reader users stay masked and
  // out of the test. null until known: nobody is exposed before the check answers. On web,
  // react-native-web cannot tell and always answers true, so web is left out of the test.
  const [screenReaderOn, setScreenReaderOn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (active) setScreenReaderOn(enabled);
      })
      .catch(() => {
        if (active) setScreenReaderOn(true);
      });
    return () => {
      active = false;
    };
  }, []);
  // A/B test: everyone else who sees the password form while signed out is exposed; the
  // password field is on screen from the first frame.
  const passwordVariant = useExperimentVariant("auth_signup_password_visible_v1", {
    enabled: !isAuthenticated && screenReaderOn === false && showPasswordForm,
  });
  // null until the person taps Show/Hide; until then the variant decides.
  const [passwordShownChoice, setPasswordShownChoice] = useState<boolean | null>(null);
  const showPassword = passwordShownChoice ?? passwordVariant === "visible_password";
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const showToast = useUIStore((state) => state.showToast);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  // Inline copy of the last server error, so it is not only a passing toast.
  const [formError, setFormError] = useState<string | null>(null);
  const emailSuggestion = useEmailSuggestion();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const isBusy = isSubmitting || providerInFlight !== null;

  useEffect(() => {
    trackAuthScreenViewed("sign_up");
  }, []);

  // A new account from the code form or a provider: the auth listener decides from the account
  // whether onboarding runs, and onboarding already finished on this device stays done.
  const finishSignUp = (authProvider: AuthProvider | "email") =>
    completeAuth({
      authProvider,
      completedOnboarding: hasCompletedOnboarding,
      trackSignInEvent: false,
      // The mock has no auth listener to tell a new account from a returning one.
      ...(getConfiguredDataSource() !== "supabase" ? { isNewUser: true } : {}),
    });

  const handleSignUp = handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    try {
      const session = await getHungryService().auth.signUp(
        email,
        values.password,
        values.displayName.trim(),
      );
      trackSignUpSubmitted("sign_up", "email");
      // session === null means email confirmation is required. The mock service always
      // returns a session, but its sign-up mirrors the confirmation flow.
      if (!session || getConfiguredDataSource() !== "supabase") {
        // An address that already has an account also lands here (Supabase answers the same and
        // sends nothing), so the verify screen offers sign-in.
        navigation.navigate("EmailVerification", {
          email,
          // Onboarding usually finished before this account step; verification completes it.
          completedOnboarding: hasCompletedOnboarding,
        });
        return;
      }
      // When project auth is auto-confirm, Supabase returns an active session immediately.
      await profileSync.apply(session, {
        onSyncWarning: () =>
          showToast({
            message:
              "Account created, but your taste profile could not sync. Try updating it later.",
            tone: "warning",
          }),
        onSynced: () =>
          completeAuth({
            authProvider: "email",
            completedOnboarding: hasCompletedOnboarding,
            isNewUser: true,
          }),
      });
    } catch (err) {
      trackAuthFailed("sign_up", "email", err, "sign_up");
      if (isUnexpectedAuthError(err) && !isWeakPasswordError(err)) {
        reportError(err, { flow: "sign_up", provider: "email" });
      }
      const code = getAuthErrorCode(err);
      // The inline banner is the one announcement; a toast on top would read twice.
      setFormError(
        isWeakPasswordError(err)
          ? WEAK_PASSWORD_MESSAGE
          : code === "email_address_invalid"
            ? AUTH_COPY.signUp.invalidEmailToast
            : code === "user_already_exists" || code === "email_exists"
              ? AUTH_COPY.signUp.emailTakenToast
              : getAuthFailureMessage(err, AUTH_COPY.signUp.genericErrorToast),
      );
    }
  });

  const handleProviderContinue = async (provider: AuthProvider) => {
    if (isBusy) return;
    setFormError(null);
    setProviderInFlight(provider);
    try {
      if (getConfiguredDataSource() === "supabase") {
        const auth = getHungryService().auth;
        const session = await (provider === "google"
          ? auth.signInWithGoogle()
          : auth.signInWithApple());
        // RootNavigator alone routes after auth: the auth listener decides from the
        // account whether onboarding runs (new account) or not (returning one).
        await profileSync.apply(session, {
          onSyncWarning: () =>
            showToast({ message: AUTH_COPY.emailCode.syncWarning, tone: "warning" }),
          onSynced: () => finishSignUp(provider),
        });
        return;
      }
      finishSignUp(provider);
    } catch (err) {
      trackAuthFailed("sign_up", provider, err, "sign_up");
      const message = getProviderErrorMessage(err, provider, {
        cancelled: AUTH_COPY.signUp.providerCancelledToast,
        failed: AUTH_COPY.signUp.genericErrorToast,
      });
      if (message === AUTH_COPY.signUp.providerCancelledToast) {
        // Cancelling is not an error: a passing toast, no red banner.
        showToast({ message, tone: "warning" });
      } else {
        reportError(err, { flow: "sign_up", provider });
        setFormError(message);
      }
    } finally {
      setProviderInFlight(null);
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.signUp.errorTitle} body={AUTH_COPY.signUp.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.signUp.title}
        subtitle={AUTH_COPY.signUp.subtitle}
        compact
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Login"))}
        footer={
          <View style={{ alignItems: "center", gap: spacing[4] }}>
            <AuthTermsNotice />

            <View
              testID="sign-up-footer"
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <AppText tone="secondary">{AUTH_COPY.signUp.footerPrompt}</AppText>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={AUTH_COPY.signUp.footerAction}
                accessibilityHint="Returns to the sign in screen"
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.navigate("Login");
                }}
                hitSlop={8}
                style={{ justifyContent: "center", minHeight: 44 }}
              >
                <AppText variant="bodyBold" tone="accent">
                  {AUTH_COPY.signUp.footerAction}
                </AppText>
              </Pressable>
            </View>
          </View>
        }
      >
        <View style={{ gap: spacing[4] }}>
          {/* A provider shows only where it is enabled and allowed (authProviders.ts). */}
          <AuthProviderButtons
            disabled={isBusy}
            divider={AUTH_COPY.signUp.divider}
            onPress={(provider) => void handleProviderContinue(provider)}
          />
          {profileSync.failed ? (
            <ProfileSyncFailureBanner
              onRetry={() => void profileSync.retry()}
              retrying={profileSync.isRetrying}
            />
          ) : null}

          {!showPasswordForm ? (
            <>
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
              <EmailCodeEntry
                screen="sign_up"
                askName
                onSignedIn={() => finishSignUp("email")}
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
                <Controller
                  control={control}
                  name="email"
                  rules={{ validate: validateEmail }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      ref={emailRef}
                      label={AUTH_COPY.signUp.emailLabel}
                      value={value}
                      onChangeText={(next) => {
                        emailSuggestion.clear();
                        onChange(next);
                      }}
                      onBlur={() => {
                        onBlur();
                        emailSuggestion.check(value);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => passwordRef.current?.focus()}
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
                  rules={{ validate: (value) => validatePassword(value) }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        ref={passwordRef}
                        label={AUTH_COPY.signUp.passwordLabel}
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        passwordRules={PASSWORD_RULES}
                        returnKeyType="go"
                        onSubmitEditing={() => void handleSignUp()}
                        accessibilityHint={AUTH_COPY.signUp.passwordRules}
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
                            onPress={() => setPasswordShownChoice(!showPassword)}
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
                      <PasswordRequirements password={value} />
                    </View>
                  )}
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
                label={AUTH_COPY.signUp.primaryButton}
                onPress={handleSignUp}
                loading={isSubmitting}
                disabled={isBusy}
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
