import { WEB_LINKS } from "@/constants/links";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useOnboardingDraftStore } from "@/features/onboarding/useOnboardingDraftStore";
import { useAuthOperation } from "@/features/auth/useAuthOperation";
import { useState, useRef, useEffect } from "react";
import {
  View,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  applySignedInProfile,
  captureGuestProfileSnapshot,
} from "@/features/auth/applySignedInProfile";
import { getMockSignUpFailure, getMockLoginFailure } from "@/features/auth/mockAuth";
import { validateEmail, validatePassword, validateRequired } from "@/features/auth/validation";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
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
  const reduceMotion = useReduceMotion();
  const { busy, run } = useAuthOperation();
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const oauthEnabled = FEATURE_FLAGS.oauthProvidersEnabled;

  const [tab, setTab] = useState<Tab>("signup");
  const [showPassword, setShowPassword] = useState(false);

  const showToast = useUIStore((s) => s.showToast);
  const completeAuth = useSessionStore((s) => s.completeAuth);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 0 : 320,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, reduceMotion]);

  // Animate tab switch
  const tabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [tab, tabAnim, reduceMotion]);

  const signUpForm = useForm<SignUpValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const loginForm = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
  });

  // Signing up here happens before the location step; continue onboarding there.
  // LocationPermission marks onboarding complete like every other path.
  const finishOnboarding = () => {
    navigation.navigate("LocationPermission");
  };

  const applySessionProfile = async (
    sessionProfile: Parameters<typeof applySignedInProfile>[0],
    guestSnapshot: ReturnType<typeof captureGuestProfileSnapshot>,
  ) => {
    useOnboardingDraftStore.getState().setAccountScope(sessionProfile.id, { adoptGuest: true });
    return applySignedInProfile(sessionProfile, {
      guestSnapshot,
      onSyncWarning: () => {
        showToast({
          message: "Signed in, but your taste profile could not sync. Try updating it again later.",
          tone: "warning",
        });
      },
    });
  };

  const handleSignUp = signUpForm.handleSubmit(async (values) =>
    run(async () => {
      const guestSnapshot = captureGuestProfileSnapshot();
      try {
        const dataSource = getServiceProvider().mode;
        if (dataSource !== "supabase") {
          const failure = getMockSignUpFailure(values.email);
          if (failure) {
            showToast({ message: failure.message, tone: "error" });
            return;
          }
        }
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
                  params: {
                    email: values.email,
                    completedOnboarding: false,
                    resumeOnboarding: true,
                  },
                },
              },
            ],
          });
          return;
        }
        if (!(await applySessionProfile(session.profile, guestSnapshot))) return;
        completeAuth({
          userId: session.profile.id,
          authProvider: "email",
          completedOnboarding: false,
          trackSignInEvent: false,
        });
        finishOnboarding();
        return;
      } catch (err) {
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
    }),
  );

  const handleLogin = loginForm.handleSubmit(async (values) =>
    run(async () => {
      const guestSnapshot = captureGuestProfileSnapshot();
      try {
        const dataSource = getServiceProvider().mode;
        if (dataSource !== "supabase") {
          const failure = getMockLoginFailure(values.email, values.password);
          if (failure) {
            showToast({ message: failure.message, tone: "error" });
            return;
          }
        }
        const session = await getHungryService().auth.signIn(values.email, values.password);
        if (!(await applySessionProfile(session.profile, guestSnapshot))) return;
        completeAuth({
          userId: session.profile.id,
          authProvider: "email",
          completedOnboarding: false,
          trackSignInEvent: false,
        });
        finishOnboarding();
        return;
      } catch {
        showToast({ message: AUTH_COPY.signUp.genericErrorToast, tone: "error" });
      }
    }),
  );

  const handleProvider = async (provider: AuthProvider) =>
    run(async () => {
      const guestSnapshot = captureGuestProfileSnapshot();
      try {
        if (getServiceProvider().mode === "supabase") {
          const service = getHungryService();
          const session =
            provider === "google"
              ? await service.auth.signInWithGoogle()
              : await service.auth.signInWithApple();
          if (!(await applySessionProfile(session.profile, guestSnapshot))) return;
        }
        showToast({ message: getSignUpProviderSuccessMessage(provider), tone: "success" });
        completeAuth({
          authProvider: provider,
          completedOnboarding: false,
          trackSignInEvent: false,
        });
        finishOnboarding();
      } catch (err) {
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
      }
    });

  const signUpErrors = signUpForm.formState.errors;
  const loginErrors = loginForm.formState.errors;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View
          style={{
            flex: 1,
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
                disabled={busy}
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

          {/* OAuth buttons */}
          {oauthEnabled ? (
            <>
              <View style={{ gap: spacing[3], marginBottom: 20 }}>
                <AuthProviderButton
                  disabled={busy}
                  intent="continue"
                  provider="google"
                  onPress={() => void handleProvider("google")}
                />
                <AuthProviderButton
                  disabled={busy}
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

              {/* Form */}
            </>
          ) : null}
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
                        placeholder="Email address"
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        autoCorrect={false}
                        spellCheck={false}
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
                        placeholder="Password"
                        value={value}
                        onChangeText={onChange}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        secureTextEntry={!showPassword}
                        autoCorrect={false}
                        spellCheck={false}
                        autoCapitalize="none"
                        leftIcon={<Lock color={palette.textMuted} size={18} />}
                        rightIcon={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={16}
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
                  loading={busy}
                  onPress={handleSignUp}
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
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        autoCorrect={false}
                        spellCheck={false}
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
                        placeholder="Password"
                        value={value}
                        onChangeText={onChange}
                        textContentType="password"
                        autoComplete="current-password"
                        secureTextEntry={!showPassword}
                        autoCorrect={false}
                        spellCheck={false}
                        autoCapitalize="none"
                        leftIcon={<Lock color={palette.textMuted} size={18} />}
                        rightIcon={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={16}
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
                <Pressable
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() =>
                    navigation
                      .getParent<NavigationProp<RootStackParamList>>()
                      ?.navigate("AuthStack", { screen: "ForgotPassword" })
                  }
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <AppText tone="accent">Forgot password?</AppText>
                </Pressable>
                <Button
                  label="Sign in"
                  loading={busy}
                  onPress={handleLogin}
                  variant="primary"
                  style={{ marginTop: spacing[2] }}
                />
              </>
            )}
          </Animated.View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: spacing[3],
            }}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Terms of service"
              onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <AppText tone="accent">Terms</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Privacy policy"
              onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <AppText tone="accent">Privacy</AppText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
