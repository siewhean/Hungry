import { Fragment, useState, useRef, useEffect } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type TextInput,
} from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import { AppText, Button, Input } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
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
import {
  isWeakPasswordError,
  PASSWORD_RULES,
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
import { AuthProviderButton } from "../auth/AuthProviderButton";
import { PasswordRequirements } from "../auth/PasswordRequirements";
import { AuthTermsNotice } from "../auth/AuthTermsNotice";
import {
  AUTH_COPY,
  getProviderErrorMessage,
  getSignUpProviderSuccessMessage,
  type AuthProvider,
} from "../auth/authCopy";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useKeyboardRevealFocusedInput } from "@/hooks/useKeyboardRevealFocusedInput";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingAuth">;
type Tab = "signup" | "login";
type SignUpValues = { displayName: string; email: string; password: string };
type LoginValues = { email: string; password: string };

export function OnboardingAuthScreen({ navigation, route }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const oauthEnabled = FEATURE_FLAGS.oauthProvidersEnabled;

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    trackAuthScreenViewed("onboarding_auth");
  }, []);

  useEffect(() => {
    const duration = reduceMotion ? 0 : 320;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, reduceMotion, slideAnim]);

  // Animate tab switch
  const tabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, tab, tabAnim]);

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

  const openForgotPassword = () => {
    navigation
      .getParent<NavigationProp<RootStackParamList>>()
      ?.navigate("AuthStack", { screen: "ForgotPassword" });
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

  const applySessionProfile = async (
    sessionProfile: Parameters<typeof applySignedInProfile>[0],
    profileReady?: Promise<Parameters<typeof applySignedInProfile>[0]>,
  ) => {
    return applySignedInProfile(sessionProfile, {
      profileReady,
      onSyncWarning: () => {
        showToast({
          message: "Signed in, but your taste profile could not sync. Try updating it again later.",
          tone: "warning",
        });
      },
    });
  };

  const handleSignUp = signUpForm.handleSubmit(async (values) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFormError(null);
    try {
      const session = await getHungryService().auth.signUp(
        values.email,
        values.password,
        values.displayName,
      );
      // Most accounts are made here, so the sign-up tests' leading metric must count them.
      trackSignUpSubmitted("onboarding_auth", "email");
      if (!session) {
        showToast({ message: AUTH_COPY.signUp.emailVerificationToast, tone: "success" });
        navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
          index: 0,
          routes: [
            {
              name: "AuthStack",
              params: {
                screen: "EmailVerification",
                params: { email: values.email, completedOnboarding: true },
              },
            },
          ],
        });
        return;
      }
      const migration = await applySessionProfile(session.profile, session.profileReady);
      if (migration.status === "failed") return;
      completeAuth({ authProvider: "email", completedOnboarding: true, isNewUser: true });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_up", "email", err);
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
    try {
      const dataSource = getConfiguredDataSource();
      if (dataSource === "supabase") {
        const session = await getHungryService().auth.signIn(values.email, values.password);
        const migration = await applySessionProfile(session.profile, session.profileReady);
        if (migration.status === "failed") return;
        completeAuth({ authProvider: "email", completedOnboarding: true, trackSignInEvent: false });
        finishOnboarding();
        return;
      }
      completeAuth({ authProvider: "email", completedOnboarding: true, trackSignInEvent: false });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_in", "email", err);
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
        const service = getHungryService();
        const session =
          provider === "google"
            ? await service.auth.signInWithGoogle()
            : await service.auth.signInWithApple();
        const migration = await applySessionProfile(session.profile, session.profileReady);
        if (migration.status === "failed") return;
      }
      showToast({ message: getSignUpProviderSuccessMessage(provider), tone: "success" });
      completeAuth({ authProvider: provider, completedOnboarding: true, trackSignInEvent: false });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed(tab === "login" ? "sign_in" : "sign_up", provider, err);
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
        <Animated.View
          onFocus={keyboardReveal.onFocus}
          style={{
            flex: 1,
            paddingTop: 20,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
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
              <ArrowLeft color={palette.text} size={22} />
            </Pressable>
          ) : null}

          {/* Header */}
          <View style={{ marginBottom: spacing[6] }}>
            <AppText
              variant="display"
              accessibilityRole="header"
              style={{ marginBottom: spacing[1] }}
            >
              {"Save your\ntaste profile"}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {framing === "test"
                ? "Create an account to keep your taste profile and the dishes picked for you."
                : "Create an account to keep your preferences and discover more."}
            </AppText>
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

          {/* OAuth buttons stay hidden until Google/Apple are enabled for this build. */}
          {oauthEnabled ? (
            <>
              <View style={{ gap: spacing[3], marginBottom: 20 }}>
                <AuthProviderButton
                  disabled={isBusy}
                  intent="continue"
                  provider="google"
                  onPress={() => void handleProvider("google")}
                />
                <AuthProviderButton
                  disabled={isBusy}
                  intent="continue"
                  provider="apple"
                  onPress={() => void handleProvider("apple")}
                />
              </View>

              {/* Divider */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  marginBottom: 20,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
                <AppText variant="micro" tone="muted">
                  or
                </AppText>
                <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
              </View>
            </>
          ) : null}

          {/* Form */}
          <Animated.View
            style={{
              gap: spacing[2],
              opacity: tabAnim,
              transform: [
                {
                  translateY: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            }}
          >
            {/* Keyed: the two forms must not share Controller instances, or typing on Sign in
                after Create account would write into the sign-up form (useController keeps
                the control it first registered with). */}
            {tab === "signup" ? (
              <Fragment key="signup">
                <Controller
                  control={signUpForm.control}
                  name="displayName"
                  rules={{
                    validate: (v) => validateRequired(v, "Name"),
                  }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        placeholder="Your name"
                        value={value}
                        onChangeText={onChange}
                        textContentType="name"
                        autoComplete="name"
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => signUpEmailRef.current?.focus()}
                        leftIcon={<User color={palette.textMuted} size={18} />}
                        error={!!signUpErrors.displayName}
                        errorText={signUpErrors.displayName?.message}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={signUpForm.control}
                  name="email"
                  rules={{ validate: validateEmail }}
                  render={({ field: { onChange, value } }) => (
                    <View style={{ gap: spacing[1] }}>
                      <Input
                        ref={signUpEmailRef}
                        placeholder="Email address"
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => signUpPasswordRef.current?.focus()}
                        leftIcon={<Mail color={palette.textMuted} size={18} />}
                        error={!!signUpErrors.email}
                        errorText={signUpErrors.email?.message}
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
                        placeholder="Password"
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        passwordRules={PASSWORD_RULES}
                        returnKeyType="go"
                        onSubmitEditing={() => void handleSignUp()}
                        leftIcon={<Lock color={palette.textMuted} size={18} />}
                        rightIcon={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={8}
                          >
                            {showPassword ? (
                              <EyeOff color={palette.textMuted} size={18} />
                            ) : (
                              <Eye color={palette.textMuted} size={18} />
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
                  label="Create account"
                  onPress={handleSignUp}
                  loading={signUpForm.formState.isSubmitting}
                  disabled={isBusy}
                  variant="primary"
                  style={{ marginTop: spacing[2] }}
                />
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
                        placeholder="Email address"
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
                        leftIcon={<Mail color={palette.textMuted} size={18} />}
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
                        placeholder="Password"
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry={!showPassword}
                        textContentType="password"
                        autoComplete="current-password"
                        returnKeyType="go"
                        onSubmitEditing={() => void handleLogin()}
                        leftIcon={<Lock color={palette.textMuted} size={18} />}
                        rightIcon={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={8}
                          >
                            {showPassword ? (
                              <EyeOff color={palette.textMuted} size={18} />
                            ) : (
                              <Eye color={palette.textMuted} size={18} />
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
                {formError ? (
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
                ) : null}
                <Button
                  label="Sign in"
                  onPress={handleLogin}
                  loading={loginForm.formState.isSubmitting}
                  disabled={isBusy}
                  variant="primary"
                  style={{ marginTop: spacing[2] }}
                />
              </Fragment>
            )}
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
