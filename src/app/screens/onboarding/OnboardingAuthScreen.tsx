import { useState, useRef, useEffect } from "react";
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
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import { AppText, Button, Input } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import { getAuthErrorCode, getAuthFailureMessage } from "@/features/auth/authErrors";
import {
  isWeakPasswordError,
  PASSWORD_RULES,
  validateEmail,
  validatePassword,
  validateRequired,
  WEAK_PASSWORD_MESSAGE,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AuthProviderButton } from "../auth/AuthProviderButton";
import { AUTH_EYE_BUTTON_STYLE } from "../auth/authEyeButton";
import { AuthTermsNotice } from "../auth/AuthTermsNotice";
import {
  AUTH_COPY,
  getProviderErrorMessage,
  getSignUpProviderSuccessMessage,
  type AuthProvider,
} from "../auth/authCopy";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingAuth">;
type Tab = "signup" | "login";
type SignUpValues = { displayName: string; email: string; password: string };
type LoginValues = { email: string; password: string };

export function OnboardingAuthScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const oauthEnabled = FEATURE_FLAGS.oauthProvidersEnabled;

  const [tab, setTab] = useState<Tab>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  // Inline copy of the last server error (a toast alone passes before it can be read, and
  // has no red border or screen-reader role), as on the shared sign-in screens.
  const [formError, setFormError] = useState<string | null>(null);
  const signUpEmailRef = useRef<TextInput>(null);
  const signUpPasswordRef = useRef<TextInput>(null);
  const loginPasswordRef = useRef<TextInput>(null);

  const showToast = useUIStore((s) => s.showToast);
  const completeAuth = useSessionStore((s) => s.completeAuth);
  const reduceMotion = useReduceMotion();

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

  // Opened just-in-time when an onboarding action needs an account (e.g. saving a
  // dish on the last step). Return there; that step still completes onboarding.
  const finishOnboarding = () => {
    navigation.goBack();
  };

  const openForgotPassword = () => {
    navigation
      .getParent<NavigationProp<RootStackParamList>>()
      ?.navigate("AuthStack", { screen: "ForgotPassword" });
  };

  const applySessionProfile = async (session: {
    profile: Parameters<typeof applySignedInProfile>[0];
    profileReady?: Promise<Parameters<typeof applySignedInProfile>[0]>;
  }) => {
    await applySignedInProfile(session.profile, {
      profileReady: session.profileReady,
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
      await applySessionProfile(session);
      completeAuth({ authProvider: "email", isNewUser: true });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_up", "email", err);
      const code = getAuthErrorCode(err);
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
    try {
      const session = await getHungryService().auth.signIn(values.email, values.password);
      await applySessionProfile(session);
      completeAuth({ authProvider: "email", trackSignInEvent: false });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_in", "email", err);
      const code = getAuthErrorCode(err);
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
        await applySessionProfile(session);
      }
      showToast({ message: getSignUpProviderSuccessMessage(provider), tone: "success" });
      completeAuth({ authProvider: provider, trackSignInEvent: false });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_up", provider, err);
      const message = getProviderErrorMessage(err, provider, {
        cancelled: AUTH_COPY.signUp.providerCancelledToast,
        failed: AUTH_COPY.signUp.genericErrorToast,
      });
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

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              flexGrow: 1,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 24,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
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
                Create an account to keep your preferences and discover more.
              </AppText>
            </View>

            {/* Tab switcher */}
            <View
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
                  onPress={() => {
                    setFormError(null);
                    setTab(t);
                  }}
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
              {tab === "signup" ? (
                <>
                  <Controller
                    control={signUpForm.control}
                    name="displayName"
                    rules={{
                      validate: (v) => validateRequired(v, "Name"),
                    }}
                    render={({ field: { onChange, value } }) => (
                      <View style={{ gap: spacing[1] }}>
                        <Input
                          label={AUTH_COPY.signUp.displayNameLabel}
                          helperText={AUTH_COPY.signUp.displayNameHelper}
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
                          label={AUTH_COPY.signUp.passwordLabel}
                          helperText={AUTH_COPY.signUp.passwordRules}
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
                              style={AUTH_EYE_BUTTON_STYLE}
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
                </>
              ) : (
                <>
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
                          label={AUTH_COPY.login.passwordLabel}
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
                              style={AUTH_EYE_BUTTON_STYLE}
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
                    label="Sign in"
                    onPress={handleLogin}
                    loading={loginForm.formState.isSubmitting}
                    disabled={isBusy}
                    variant="primary"
                    style={{ marginTop: spacing[2] }}
                  />
                </>
              )}
            </Animated.View>

            {/* Sign-in is optional here: return to the last step without an account. */}
            <Button
              label="Not now"
              variant="ghost"
              disabled={isBusy}
              onPress={() => navigation.goBack()}
              style={{ marginTop: spacing[4] }}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
