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
import * as Haptics from "expo-haptics";

import { AppText, Button, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import { getMockSignUpFailure } from "@/features/auth/mockAuth";
import {
  PASSWORD_RULES,
  validateEmail,
  validatePassword,
  validateRequired,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AuthProviderButton } from "../auth/AuthProviderButton";
import {
  AUTH_COPY,
  getAuthProviderUnavailableMessage,
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
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const oauthEnabled = FEATURE_FLAGS.oauthProvidersEnabled;

  const [tab, setTab] = useState<Tab>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  const signUpEmailRef = useRef<TextInput>(null);
  const signUpPasswordRef = useRef<TextInput>(null);
  const loginPasswordRef = useRef<TextInput>(null);

  const showToast = useUIStore((s) => s.showToast);
  const completeAuth = useSessionStore((s) => s.completeAuth);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    trackAuthScreenViewed("onboarding_auth");
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Animate tab switch
  const tabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [tab, tabAnim]);

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

  const applySessionProfile = async (
    sessionProfile: Parameters<typeof applySignedInProfile>[0],
  ) => {
    await applySignedInProfile(sessionProfile, {
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
    try {
      const dataSource = getConfiguredDataSource();
      if (dataSource === "supabase") {
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
        await applySessionProfile(session.profile);
        completeAuth({ authProvider: "email", isNewUser: true });
        finishOnboarding();
        return;
      }
      const failure = getMockSignUpFailure(values.email);
      if (failure) {
        showToast({ message: failure.message, tone: "error" });
        return;
      }
      completeAuth({ authProvider: "email", isNewUser: true });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_up", "email", err);
      const code =
        (err as { error_code?: string; code?: string })?.error_code ??
        (err as { error_code?: string; code?: string })?.code;
      if (code === "over_email_send_rate_limit") {
        showToast({ message: AUTH_COPY.signUp.tooManyAttemptsToast, tone: "error" });
      } else if (code === "email_address_invalid") {
        showToast({ message: AUTH_COPY.signUp.invalidEmailToast, tone: "error" });
      } else {
        showToast({ message: AUTH_COPY.signUp.genericErrorToast, tone: "error" });
      }
    }
  });

  const handleLogin = loginForm.handleSubmit(async (values) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const dataSource = getConfiguredDataSource();
      if (dataSource === "supabase") {
        const session = await getHungryService().auth.signIn(values.email, values.password);
        await applySessionProfile(session.profile);
        completeAuth({ authProvider: "email", trackSignInEvent: false });
        finishOnboarding();
        return;
      }
      completeAuth({ authProvider: "email", trackSignInEvent: false });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_in", "email", err);
      showToast({ message: AUTH_COPY.signUp.genericErrorToast, tone: "error" });
    }
  });

  const handleProvider = async (provider: AuthProvider) => {
    if (isBusy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProviderInFlight(provider);
    try {
      if (getConfiguredDataSource() === "supabase") {
        const service = getHungryService();
        const session =
          provider === "google"
            ? await service.auth.signInWithGoogle()
            : await service.auth.signInWithApple();
        await applySessionProfile(session.profile);
      }
      showToast({ message: getSignUpProviderSuccessMessage(provider), tone: "success" });
      completeAuth({ authProvider: provider, trackSignInEvent: false });
      finishOnboarding();
    } catch (err) {
      trackAuthFailed("sign_up", provider, err);
      const message = (err as { message?: string })?.message?.toLowerCase() ?? "";
      if (message.includes("provider is not enabled")) {
        showToast({ message: getAuthProviderUnavailableMessage(provider), tone: "error" });
        return;
      }
      if (message.includes("cancelled")) {
        showToast({ message: AUTH_COPY.signUp.providerCancelledToast, tone: "warning" });
        return;
      }
      showToast({ message: AUTH_COPY.signUp.genericErrorToast, tone: "error" });
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
            <View style={{ marginBottom: 28 }}>
              <AppText
                style={{
                  fontFamily: "Fraunces_700Bold",
                  fontSize: 32,
                  lineHeight: 38,
                  color: palette.text,
                  marginBottom: 6,
                }}
              >
                {"Save your\ntaste profile"}
              </AppText>
              <AppText style={{ color: palette.textSecondary, fontSize: 14, lineHeight: 20 }}>
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
                  onPress={() => setTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 9,
                    alignItems: "center",
                    backgroundColor: tab === t ? palette.surface : "transparent",
                  }}
                >
                  <AppText
                    style={{
                      fontFamily: tab === t ? "Nunito_700Bold" : "Nunito_400Regular",
                      fontSize: 14,
                      color: tab === t ? palette.text : palette.textSecondary,
                    }}
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
                          placeholder="Your name"
                          value={value}
                          onChangeText={onChange}
                          textContentType="name"
                          autoComplete="name"
                          returnKeyType="next"
                          submitBehavior="submit"
                          onSubmitEditing={() => signUpEmailRef.current?.focus()}
                          leftIcon={<User color={palette.textMuted} size={18} />}
                        />
                        {signUpErrors.displayName ? (
                          <AppText variant="bodySmall" style={{ color: palette.error }}>
                            {signUpErrors.displayName.message}
                          </AppText>
                        ) : null}
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
                        />
                        {signUpErrors.email ? (
                          <AppText variant="bodySmall" style={{ color: palette.error }}>
                            {signUpErrors.email.message}
                          </AppText>
                        ) : null}
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
                        />
                        {signUpErrors.password ? (
                          <AppText variant="bodySmall" style={{ color: palette.error }}>
                            {signUpErrors.password.message}
                          </AppText>
                        ) : null}
                      </View>
                    )}
                  />
                  <Button
                    label="Create account"
                    onPress={handleSignUp}
                    loading={signUpForm.formState.isSubmitting}
                    disabled={isBusy}
                    variant="primary"
                    style={{ marginTop: spacing[2] }}
                  />
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
                        />
                        {loginErrors.email ? (
                          <AppText variant="bodySmall" style={{ color: palette.error }}>
                            {loginErrors.email.message}
                          </AppText>
                        ) : null}
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
                        />
                        {loginErrors.password ? (
                          <AppText variant="bodySmall" style={{ color: palette.error }}>
                            {loginErrors.password.message}
                          </AppText>
                        ) : null}
                      </View>
                    )}
                  />
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
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
