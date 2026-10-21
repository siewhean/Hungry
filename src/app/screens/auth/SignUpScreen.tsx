import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import { getMockSignUpFailure } from "@/features/auth/mockAuth";
import { reportError } from "@/lib/monitoring/reportError";
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
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButton } from "./AuthProviderButton";
import { AuthScreenShell } from "./AuthScreenShell";
import { PasswordRequirements } from "./PasswordRequirements";
import { AuthTermsNotice } from "./AuthTermsNotice";
import {
  AUTH_COPY,
  getProviderErrorMessage,
  getSignUpProviderSuccessMessage,
  type AuthProvider,
} from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

export function SignUpScreen({ navigation }: Props) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();
  const oauthProvidersEnabled = FEATURE_FLAGS.oauthProvidersEnabled;
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const showToast = useUIStore((state) => state.showToast);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  // Inline copy of the last server error, so it is not only a passing toast.
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const isBusy = isSubmitting || providerInFlight !== null;

  useEffect(() => {
    trackAuthScreenViewed("sign_up");
  }, []);

  const handleSignUp = handleSubmit(async (values) => {
    setFormError(null);
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
          navigation.navigate("EmailVerification", {
            email: values.email,
            completedOnboarding: hasCompletedOnboarding,
          });
          return;
        }
        const migration = await applySignedInProfile(session.profile, {
          profileReady: session.profileReady,
          onSyncWarning: () =>
            showToast({
              message:
                "Account created, but your taste profile could not sync. Try updating it later.",
              tone: "warning",
            }),
        });
        if (migration.status === "failed") return;
        completeAuth({
          authProvider: "email",
          completedOnboarding: hasCompletedOnboarding,
          isNewUser: true,
        });
        showToast({
          message: hasCompletedOnboarding
            ? "Account created. Welcome to Hungry."
            : AUTH_COPY.signUp.continueOnboardingToast,
          tone: "success",
        });
        return;
      } else {
        const failure = getMockSignUpFailure(values.email);
        if (failure) {
          setFormError(failure.message);
          showToast({ message: failure.message, tone: "error" });
          return;
        }
      }
      showToast({ message: AUTH_COPY.signUp.emailVerificationToast, tone: "success" });
      navigation.navigate("EmailVerification", {
        email: values.email,
        completedOnboarding: hasCompletedOnboarding,
      });
    } catch (err) {
      trackAuthFailed("sign_up", "email", err);
      const code =
        (err as { error_code?: string; code?: string })?.error_code ??
        (err as { error_code?: string; code?: string })?.code;
      const message = isWeakPasswordError(err)
        ? WEAK_PASSWORD_MESSAGE
        : code === "over_email_send_rate_limit"
          ? AUTH_COPY.signUp.tooManyAttemptsToast
          : code === "email_address_invalid"
            ? AUTH_COPY.signUp.invalidEmailToast
            : AUTH_COPY.signUp.genericErrorToast;
      setFormError(message);
      showToast({ message, tone: "error" });
    }
  });

  const handleProviderContinue = async (provider: AuthProvider) => {
    if (isBusy) return;
    setFormError(null);
    setProviderInFlight(provider);
    const isSupabase = getConfiguredDataSource() === "supabase";
    try {
      if (isSupabase) {
        const service = getHungryService();
        const session =
          provider === "google"
            ? await service.auth.signInWithGoogle()
            : await service.auth.signInWithApple();
        const migration = await applySignedInProfile(session.profile, {
          profileReady: session.profileReady,
          onSyncWarning: () =>
            showToast({
              message: "Signed in, but your taste profile could not sync. Try updating it later.",
              tone: "warning",
            }),
        });
        if (migration.status === "failed") return;
      }
      showToast({
        message: getSignUpProviderSuccessMessage(provider),
        tone: "success",
      });
      // RootNavigator alone routes after auth: the auth listener decides from the
      // account whether onboarding runs (new account) or not (returning one), and
      // onboarding already finished on this device stays done.
      completeAuth({
        authProvider: provider,
        completedOnboarding: hasCompletedOnboarding,
        trackSignInEvent: false,
      });
    } catch (err) {
      trackAuthFailed("sign_up", provider, err);
      const message = getProviderErrorMessage(err, provider, {
        cancelled: AUTH_COPY.signUp.providerCancelledToast,
        failed: AUTH_COPY.signUp.genericErrorToast,
      });
      if (message !== AUTH_COPY.signUp.providerCancelledToast) {
        reportError(err, { flow: "sign_up", provider });
        setFormError(message);
      }
      showToast({
        message,
        tone: message === AUTH_COPY.signUp.providerCancelledToast ? "warning" : "error",
      });
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
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <View style={{ alignItems: "center", gap: spacing[4] }}>
            <AuthTermsNotice />

            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
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
          {/* Google/Apple stay hidden until they are enabled for this build. */}
          {oauthProvidersEnabled ? (
            <>
              <View style={{ gap: spacing[3] }}>
                <AuthProviderButton
                  disabled={isBusy}
                  intent="continue"
                  provider="apple"
                  onPress={() => {
                    void handleProviderContinue("apple");
                  }}
                />
                <AuthProviderButton
                  disabled={isBusy}
                  intent="continue"
                  provider="google"
                  onPress={() => {
                    void handleProviderContinue("google");
                  }}
                />
              </View>

              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
                <AppText variant="micro" tone="muted">
                  {AUTH_COPY.signUp.divider}
                </AppText>
                <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
              </View>
            </>
          ) : null}

          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="displayName"
              rules={{
                validate: (value) =>
                  validateRequired(value, AUTH_COPY.signUp.displayNameValidationLabel),
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder={AUTH_COPY.signUp.displayNamePlaceholder}
                  value={value}
                  onChangeText={onChange}
                  textContentType="name"
                  autoComplete="name"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  leftIcon={<User color={palette.textMuted} size={18} />}
                  error={!!errors.displayName}
                  errorText={errors.displayName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <Input
                  ref={emailRef}
                  placeholder={AUTH_COPY.signUp.emailPlaceholder}
                  value={value}
                  onChangeText={onChange}
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
            <Controller
              control={control}
              name="password"
              rules={{ validate: (value) => validatePassword(value) }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    ref={passwordRef}
                    placeholder={AUTH_COPY.signUp.passwordPlaceholder}
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
                        onPress={() => setShowPassword((current) => !current)}
                        hitSlop={8}
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
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
