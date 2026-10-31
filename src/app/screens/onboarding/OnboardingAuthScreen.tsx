import { Fragment, useState, useRef, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type TextInput,
} from "react-native";
import ReAnimated from "react-native-reanimated";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import { AppText, Button, Input, AppSymbol } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useFadeRiseIn } from "@/lib/motion/uiMotion";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackSignInSubmitted,
  trackSignUpSubmitted,
} from "@/features/auth/authAnalytics";
import {
  getAuthErrorCode,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "@/features/auth/authErrors";
import { useEmailCodeFirst } from "@/features/auth/useEmailCodeFirst";
import { useSignedInProfileSync } from "@/features/auth/useSignedInProfileSync";
import {
  isWeakPasswordError,
  PASSWORD_RULES,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateRequired,
  WEAK_PASSWORD_MESSAGE,
} from "@/features/auth/validation";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AuthProviderButtons } from "../auth/AuthProviderButtons";
import { AuthTextLink } from "../auth/AuthTextLink";
import { DisplayNameField } from "../auth/DisplayNameField";
import { EmailCodeEntry } from "../auth/EmailCodeEntry";
import { EmailSuggestionHint, useEmailSuggestion } from "../auth/EmailSuggestion";
import { PasswordRequirements } from "../auth/PasswordRequirements";
import { ProfileSyncFailureBanner } from "../auth/ProfileSyncFailureBanner";
import { AuthTermsNotice } from "../auth/AuthTermsNotice";
import { AUTH_COPY, getProviderErrorMessage, type AuthProvider } from "../auth/authCopy";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useKeyboardRevealFocusedInput } from "@/hooks/useKeyboardRevealFocusedInput";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingProgress, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingAuth">;
type Tab = "signup" | "login";
type SignUpValues = { displayName: string; email: string; password: string };
type LoginValues = { email: string; password: string };

export function OnboardingAuthScreen({ navigation, route }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const emailCodeFirst = useEmailCodeFirst();
  // "Use a password instead" swaps the email-code form for the older password forms.
  const [passwordChosen, setPasswordChosen] = useState(false);
  const showPasswordForms = !emailCodeFirst || passwordChosen;
  const profileSync = useSignedInProfileSync("onboarding_auth");

  const [tab, setTabState] = useState<Tab>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  // Inline copy of the last server error (a toast alone passes before it can be read, and
  // has no red border or screen-reader role), as on the shared sign-in screens.
  const [formError, setFormError] = useState<string | null>(null);
  // Set when sign-in says the email is not confirmed: the code already sent still works.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const signUpEmailRef = useRef<TextInput>(null);
  const signUpPasswordRef = useRef<TextInput>(null);
  const loginPasswordRef = useRef<TextInput>(null);
  const signUpEmailSuggestion = useEmailSuggestion();

  const showToast = useUIStore((s) => s.showToast);
  const completeAuth = useSessionStore((s) => s.completeAuth);
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);
  const reduceMotion = useReduceMotion();
  // The result screen exposed this user; follow the variant here (also when flags load after
  // a relaunch straight into this step) without exposing again.
  const framing = useExperimentVariant("onboarding_account_framing_v1", { expose: false });
  // A server error belongs to the form it came from; switching tabs starts clean.
  const setTab = (next: Tab) => {
    setTabState(next);
    setFormError(null);
    setUnconfirmedEmail(null);
  };

  // Under 300 ms on the UI thread; Reduce Motion keeps a short fade and drops the slide.
  const entranceStyle = useFadeRiseIn(reduceMotion, { duration: 240, distance: 20 });

  useEffect(() => {
    trackAuthScreenViewed("onboarding_auth");
    trackOnboardingStepViewed("account");
  }, []);

  // Animate tab switch: a short rise and fade on the UI thread; Reduce Motion keeps the fade.
  const tabStyle = useFadeRiseIn(reduceMotion, { distance: 6, resetKey: tab });

  const signUpForm = useForm<SignUpValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const loginForm = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
  });
  const isBusy =
    signUpForm.formState.isSubmitting ||
    loginForm.formState.isSubmitting ||
    providerInFlight !== null;

  const finishOnboarding = () => {
    completeOnboarding();
  };

  // The account is in and its profile synced: onboarding is done and the app takes over.
  const finishAccount = (authProvider: AuthProvider | "email", isNewUser = false) => {
    completeAuth({
      authProvider,
      completedOnboarding: true,
      ...(isNewUser ? { isNewUser: true } : { trackSignInEvent: false }),
    });
    finishOnboarding();
  };

  const openForgotPassword = () => {
    const email = loginForm.getValues("email").trim().toLowerCase();
    navigation.getParent<NavigationProp<RootStackParamList>>()?.navigate("AuthStack", {
      screen: "ForgotPassword",
      ...(email ? { params: { email } } : {}),
    });
  };

  // As on Login: open the code screen for this address without sending another email.
  const openEmailVerification = () => {
    if (!unconfirmedEmail) return;
    navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
      index: 0,
      routes: [
        {
          name: "AuthStack",
          params: {
            screen: "EmailVerification",
            params: { email: unconfirmedEmail, completedOnboarding: true },
          },
        },
      ],
    });
  };

  const syncWarning = () =>
    showToast({ message: AUTH_COPY.emailCode.syncWarning, tone: "warning" });

  const handleSignUp = signUpForm.handleSubmit(async (values) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    try {
      const session = await getHungryService().auth.signUp(
        email,
        values.password,
        values.displayName.trim(),
      );
      // Most accounts are made here, so the sign-up tests' leading metric must count them.
      trackSignUpSubmitted("onboarding_auth", "email");
      if (!session) {
        navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
          index: 0,
          routes: [
            {
              name: "AuthStack",
              params: {
                screen: "EmailVerification",
                params: { email, completedOnboarding: true },
              },
            },
          ],
        });
        return;
      }
      await profileSync.apply(session, {
        onSyncWarning: syncWarning,
        onSynced: () => finishAccount("email", true),
      });
    } catch (err) {
      trackAuthFailed("sign_up", "email", err, "onboarding_auth");
      const code = getAuthErrorCode(err);
      // A weak password, a taken email, offline or a rate limit is not an app error.
      if (!isWeakPasswordError(err) && isUnexpectedAuthError(err)) {
        reportError(err, { screen: "OnboardingAuth", action: "sign_up" });
      }
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

  const handleLogin = loginForm.handleSubmit(async (values) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFormError(null);
    setUnconfirmedEmail(null);
    trackSignInSubmitted("onboarding_auth", "email");
    try {
      if (getConfiguredDataSource() === "supabase") {
        const session = await getHungryService().auth.signIn(values.email, values.password);
        await profileSync.apply(session, {
          onSyncWarning: syncWarning,
          onSynced: () => finishAccount("email"),
        });
        return;
      }
      finishAccount("email");
    } catch (err) {
      trackAuthFailed("sign_in", "email", err, "onboarding_auth");
      const code = getAuthErrorCode(err);
      if (isUnexpectedAuthError(err)) {
        reportError(err, { screen: "OnboardingAuth", action: "sign_in" });
      }
      if (code === "email_not_confirmed") setUnconfirmedEmail(values.email.trim().toLowerCase());
      setFormError(
        code === "invalid_credentials"
          ? AUTH_COPY.login.invalidCredentialsToast
          : code === "email_not_confirmed"
            ? AUTH_COPY.login.emailNotConfirmedToast
            : getAuthFailureMessage(err, AUTH_COPY.login.genericErrorToast),
      );
    }
  });

  const handleProvider = async (provider: AuthProvider) => {
    if (isBusy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormError(null);
    setProviderInFlight(provider);
    try {
      if (getConfiguredDataSource() === "supabase") {
        const auth = getHungryService().auth;
        const session = await (provider === "google"
          ? auth.signInWithGoogle()
          : auth.signInWithApple());
        await profileSync.apply(session, {
          onSyncWarning: syncWarning,
          onSynced: () => finishAccount(provider),
        });
        return;
      }
      finishAccount(provider);
    } catch (err) {
      trackAuthFailed(tab === "login" ? "sign_in" : "sign_up", provider, err, "onboarding_auth");
      const message = getProviderErrorMessage(err, provider, {
        cancelled: AUTH_COPY.signUp.providerCancelledToast,
        failed: AUTH_COPY.signUp.genericErrorToast,
      });
      if (message !== AUTH_COPY.signUp.providerCancelledToast) {
        reportError(err, { screen: "OnboardingAuth", action: "provider_sign_in", provider });
      }
      if (message === AUTH_COPY.signUp.providerCancelledToast) {
        // Cancelling is not an error: a passing toast, no red banner.
        showToast({ message, tone: "warning" });
      } else {
        setFormError(message);
      }
    } finally {
      setProviderInFlight(null);
    }
  };

  const signUpErrors = signUpForm.formState.errors;
  const loginErrors = loginForm.formState.errors;

  const keyboardReveal = useKeyboardRevealFocusedInput();

  const errorBanner = (
    <View
      accessible={!unconfirmedEmail}
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
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // The top inset lives on the container (not the scroll content) so content
      // lifted for the keyboard is clipped below the status bar / Dynamic Island.
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
    >
      <ScrollView
        ref={keyboardReveal.scrollRef}
        onScroll={keyboardReveal.onScroll}
        scrollEventThrottle={keyboardReveal.scrollEventThrottle}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ReAnimated.View
          onFocus={keyboardReveal.onFocus}
          style={[
            {
              flex: 1,
              paddingTop: 20,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 24,
            },
            entranceStyle,
          ]}
        >
          {/* Back to the result screen; absent when a relaunch opened this step directly. */}
          {navigation.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
              style={{
                alignItems: "center",
                borderRadius: radii.pill,
                height: 44,
                justifyContent: "center",
                marginLeft: -10,
                marginBottom: spacing[2],
                width: 44,
              }}
            >
              <AppSymbol name="back" color={palette.text} size={22} />
            </Pressable>
          ) : null}

          {/* The last of the five onboarding steps: setup is not done until the account exists. */}
          <View style={{ marginBottom: spacing[4] }}>
            <OnboardingProgress step="account" />
          </View>

          {/* Header */}
          <View style={{ marginBottom: spacing[6] }}>
            <OnboardingHeader
              title="Save your taste profile"
              subtitle={
                framing === "test"
                  ? "Create an account to keep your taste profile and the dishes picked for you."
                  : "Create an account to keep your preferences and discover more."
              }
            />
          </View>

          {/* Tab switcher */}
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              backgroundColor: palette.bgSoft,
              borderRadius: 12,
              padding: 4,
              marginBottom: 24,
            }}
          >
            {(["signup", "login"] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={{
                  flex: 1,
                  justifyContent: "center",
                  minHeight: 44,
                  borderRadius: 9,
                  alignItems: "center",
                  backgroundColor: tab === t ? palette.surface : "transparent",
                }}
              >
                <AppText
                  variant={tab === t ? "bodyBold" : "body"}
                  tone={tab === t ? "default" : "secondary"}
                >
                  {t === "signup" ? "Create account" : "Sign in"}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* A provider shows only where it is enabled and allowed (authProviders.ts). */}
          <AuthProviderButtons
            disabled={isBusy}
            divider="or"
            onPress={(provider) => void handleProvider(provider)}
            spacingBelow={20}
          />

          {profileSync.failed ? (
            <View style={{ marginBottom: spacing[3] }}>
              <ProfileSyncFailureBanner
                onRetry={() => void profileSync.retry()}
                retrying={profileSync.isRetrying}
              />
            </View>
          ) : null}

          {/* Form */}
          <ReAnimated.View style={[{ gap: spacing[2] }, tabStyle]}>
            {/* Keyed: the two forms must not share Controller instances, or typing on Sign in
                after Create account would write into the sign-up form (useController keeps
                the control it first registered with). */}
            {!showPasswordForms ? (
              <Fragment key={`code-${tab}`}>
                {formError ? errorBanner : null}
                <EmailCodeEntry
                  screen="onboarding_auth"
                  askName={tab === "signup"}
                  // With Supabase the auth listener tells a new account from a returning one; the
                  // mock has none, so a created account is declared new here.
                  onSignedIn={() =>
                    finishAccount(
                      "email",
                      tab === "signup" && getConfiguredDataSource() !== "supabase",
                    )
                  }
                  onUsePassword={() => {
                    setFormError(null);
                    setPasswordChosen(true);
                  }}
                />
                {tab === "signup" ? (
                  <AuthTermsNotice prefix={AUTH_COPY.emailCode.termsPrefix} />
                ) : null}
              </Fragment>
            ) : tab === "signup" ? (
              <Fragment key="signup">
                <Controller
                  control={signUpForm.control}
                  name="displayName"
                  rules={{ validate: (v) => validateDisplayName(v) }}
                  render={({ field: { onChange, value } }) => (
                    <DisplayNameField
                      value={value}
                      onChangeText={onChange}
                      errorText={signUpErrors.displayName?.message}
                      onSubmitEditing={() => signUpEmailRef.current?.focus()}
                    />
                  )}
                />
                <Controller
                  control={signUpForm.control}
                  name="email"
                  rules={{ validate: validateEmail }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        ref={signUpEmailRef}
                        label={AUTH_COPY.signUp.emailLabel}
                        value={value}
                        onChangeText={(next) => {
                          signUpEmailSuggestion.clear();
                          onChange(next);
                        }}
                        onBlur={() => {
                          onBlur();
                          signUpEmailSuggestion.check(value);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => signUpPasswordRef.current?.focus()}
                        leftIcon={
                          <AppSymbol
                            name="email"
                            color={palette.textMuted}
                            size={18}
                            weight="regular"
                          />
                        }
                        error={!!signUpErrors.email}
                        errorText={signUpErrors.email?.message}
                      />
                      <EmailSuggestionHint
                        suggestion={signUpEmailSuggestion.suggestion}
                        onAccept={(address) => {
                          signUpForm.setValue("email", address, { shouldValidate: true });
                          signUpEmailSuggestion.clear();
                        }}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={signUpForm.control}
                  name="password"
                  rules={{ validate: (value) => validatePassword(value) }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        ref={signUpPasswordRef}
                        label={AUTH_COPY.signUp.passwordLabel}
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        passwordRules={PASSWORD_RULES}
                        returnKeyType="go"
                        onSubmitEditing={() => void handleSignUp()}
                        leftIcon={
                          <AppSymbol
                            name="password"
                            color={palette.textMuted}
                            size={18}
                            weight="regular"
                          />
                        }
                        rightIcon={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={8}
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
                        error={!!signUpErrors.password}
                        errorText={signUpErrors.password?.message}
                      />
                      <PasswordRequirements password={value} />
                    </View>
                  )}
                />
                {formError ? errorBanner : null}
                <Button
                  label="Create account"
                  onPress={handleSignUp}
                  loading={signUpForm.formState.isSubmitting}
                  disabled={isBusy}
                  variant="primary"
                  style={{ marginTop: spacing[2] }}
                />
                {emailCodeFirst ? (
                  <View style={{ alignItems: "center" }}>
                    <AuthTextLink
                      label={AUTH_COPY.emailCode.useCode}
                      onPress={() => {
                        setFormError(null);
                        setPasswordChosen(false);
                      }}
                    />
                  </View>
                ) : null}
                <AuthTermsNotice />
              </Fragment>
            ) : (
              <Fragment key="login">
                <Controller
                  control={loginForm.control}
                  name="email"
                  rules={{ validate: validateEmail }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        label={AUTH_COPY.login.emailLabel}
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => loginPasswordRef.current?.focus()}
                        leftIcon={
                          <AppSymbol
                            name="email"
                            color={palette.textMuted}
                            size={18}
                            weight="regular"
                          />
                        }
                        error={!!loginErrors.email}
                        errorText={loginErrors.email?.message}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={loginForm.control}
                  name="password"
                  rules={{ validate: (v) => validateRequired(v, "Password") }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        ref={loginPasswordRef}
                        label={AUTH_COPY.login.passwordLabel}
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry={!showPassword}
                        textContentType="password"
                        autoComplete="current-password"
                        returnKeyType="go"
                        onSubmitEditing={() => void handleLogin()}
                        leftIcon={
                          <AppSymbol
                            name="password"
                            color={palette.textMuted}
                            size={18}
                            weight="regular"
                          />
                        }
                        rightIcon={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={8}
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
                        error={!!loginErrors.password}
                        errorText={loginErrors.password?.message}
                      />
                    </View>
                  )}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={AUTH_COPY.login.forgotPasswordLink}
                  accessibilityHint="Opens password reset"
                  onPress={openForgotPassword}
                  hitSlop={8}
                  style={{ alignSelf: "flex-end", justifyContent: "center", minHeight: 44 }}
                >
                  <AppText variant="bodySmall" tone="accent">
                    {AUTH_COPY.login.forgotPasswordLink}
                  </AppText>
                </Pressable>
                {formError ? errorBanner : null}
                <Button
                  label="Sign in"
                  onPress={handleLogin}
                  loading={loginForm.formState.isSubmitting}
                  disabled={isBusy}
                  variant="primary"
                  style={{ marginTop: spacing[2] }}
                />
                {emailCodeFirst ? (
                  <View style={{ alignItems: "center" }}>
                    <AuthTextLink
                      label={AUTH_COPY.emailCode.useCode}
                      onPress={() => {
                        setFormError(null);
                        setPasswordChosen(false);
                      }}
                    />
                  </View>
                ) : null}
              </Fragment>
            )}
          </ReAnimated.View>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
