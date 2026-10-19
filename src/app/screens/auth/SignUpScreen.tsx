import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { getMockSignUpFailure } from "@/features/auth/mockAuth";
import { setPendingSignUp } from "@/features/auth/pendingSignUp";
import { validateEmail, validatePassword, validateRequired } from "@/features/auth/validation";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButton } from "./AuthProviderButton";
import { AuthScreenShell } from "./AuthScreenShell";
import { PasswordRequirements } from "./PasswordRequirements";
import {
  AUTH_COPY,
  getAuthProviderUnavailableMessage,
  getSignUpProviderSuccessMessage,
  type AuthProvider,
} from "./authCopy";
import { WEB_LINKS } from "@/constants/links";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

// iOS strong-password generation honours the same rules as validatePassword.
const NEW_PASSWORD_RULES =
  "minlength: 12; required: lower; required: upper; required: digit; required: special;";

export function SignUpScreen({ navigation }: Props) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const oauthProvidersEnabled = FEATURE_FLAGS.oauthProvidersEnabled;
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const {
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const handleSignUp = handleSubmit(async (values) => {
    try {
      const dataSource = getConfiguredDataSource();
      if (dataSource === "supabase") {
        const session = await getHungryService().auth.signUp(
          values.email,
          values.password,
          values.displayName,
        );
        if (!session) {
          // Held in memory only so "I verified my email" can finish sign-in.
          setPendingSignUp({
            email: values.email,
            password: values.password,
            completedOnboarding: hasCompletedOnboarding,
          });
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
          trackSignInEvent: false,
        });
        showToast({
          message: hasCompletedOnboarding
            ? "Account created. Welcome to Hungry."
            : AUTH_COPY.signUp.continueOnboardingToast,
          tone: "success",
        });
        return;
      }

      const failure = getMockSignUpFailure(values.email);
      if (failure) {
        showToast({ message: failure.message, tone: "error" });
        return;
      }
      showToast({ message: AUTH_COPY.signUp.verificationUnavailableToast, tone: "warning" });
      navigation.navigate("EmailVerification", {
        email: values.email,
        completedOnboarding: hasCompletedOnboarding,
      });
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
  });

  const handleProviderContinue = async (provider: AuthProvider) => {
    const providerErrorMessage = (error: unknown) => {
      const rawMessage =
        (error as { message?: string })?.message ?? AUTH_COPY.signUp.genericErrorToast;
      const message = rawMessage.toLowerCase();
      if (message.includes("provider is not enabled")) {
        return getAuthProviderUnavailableMessage(provider);
      }
      if (message.includes("cancelled")) return AUTH_COPY.signUp.providerCancelledToast;
      if (message.includes("callback url was not trusted")) return message;
      if (message.includes("state did not match")) return message;
      if (message.includes("no active session") || message.includes("session credentials")) {
        return rawMessage;
      }
      if (typeof __DEV__ !== "undefined" && __DEV__) return rawMessage;
      return AUTH_COPY.signUp.genericErrorToast;
    };

    try {
      if (getConfiguredDataSource() === "supabase") {
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
      showToast({ message: getSignUpProviderSuccessMessage(provider), tone: "success" });
      completeAuth({
        authProvider: provider,
        completedOnboarding: hasCompletedOnboarding,
        trackSignInEvent: false,
      });
    } catch (err) {
      const message = providerErrorMessage(err);
      showToast({
        message,
        tone: message === AUTH_COPY.signUp.providerCancelledToast ? "warning" : "error",
      });
    }
  };

  const providerButtons = oauthProvidersEnabled ? (
    <View style={{ gap: spacing[3] }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
        <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
        <AppText variant="micro" tone="muted">
          {AUTH_COPY.signUp.divider}
        </AppText>
        <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
      </View>
      <AuthProviderButton
        intent="continue"
        provider="google"
        onPress={() => void handleProviderContinue("google")}
      />
      <AuthProviderButton
        intent="continue"
        provider="apple"
        onPress={() => void handleProviderContinue("apple")}
      />
    </View>
  ) : null;

  return (
    <FeedErrorBoundary title={AUTH_COPY.signUp.errorTitle} body={AUTH_COPY.signUp.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.signUp.title}
        compact
        layout="balanced"
        // Consent, the primary action and the Sign in link stay pinned above the
        // keyboard and visible without scrolling.
        stickyAction={
          <>
            <AppText
              testID="signup-terms-consent"
              variant="micro"
              tone="secondary"
              style={{ textAlign: "center" }}
            >
              {AUTH_COPY.signUp.termsPrefix}
              <AppText
                variant="micro"
                tone="accent"
                accessibilityRole="link"
                onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
              >
                {AUTH_COPY.signUp.termsLabel}
              </AppText>
              {AUTH_COPY.signUp.privacyJoiner}
              <AppText
                variant="micro"
                tone="accent"
                accessibilityRole="link"
                onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
              >
                {AUTH_COPY.signUp.privacyLabel}
              </AppText>
              {AUTH_COPY.signUp.termsSuffix}
            </AppText>
            <Button
              label={AUTH_COPY.signUp.primaryButton}
              onPress={handleSignUp}
              loading={isSubmitting}
            />
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={AUTH_COPY.signUp.footerAction}
              accessibilityHint="Opens the sign in screen for an existing account"
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate("Login");
              }}
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                minHeight: componentSizes.touchTarget,
              }}
            >
              <AppText tone="secondary">{AUTH_COPY.signUp.footerPrompt}</AppText>
              <AppText variant="bodyBold" tone="accent">
                {AUTH_COPY.signUp.footerAction}
              </AppText>
            </Pressable>
          </>
        }
      >
        <View style={{ gap: spacing[5] }}>
          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="displayName"
              rules={{
                validate: (value) =>
                  validateRequired(value, AUTH_COPY.signUp.displayNameValidationLabel),
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  accessibilityLabel={AUTH_COPY.signUp.displayNamePlaceholder}
                  placeholder={AUTH_COPY.signUp.displayNamePlaceholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => setFocus("email")}
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
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <Input
                  ref={ref}
                  accessibilityLabel={AUTH_COPY.signUp.emailPlaceholder}
                  placeholder={AUTH_COPY.signUp.emailPlaceholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => setFocus("password")}
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
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <View style={{ gap: spacing[2] }}>
                  <Input
                    ref={ref}
                    accessibilityLabel={AUTH_COPY.signUp.passwordPlaceholder}
                    placeholder={AUTH_COPY.signUp.passwordPlaceholder}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => {
                      setIsPasswordFocused(false);
                      onBlur();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    passwordRules={NEW_PASSWORD_RULES}
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
                        hitSlop={10}
                        style={{
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: componentSizes.touchTarget,
                          minWidth: componentSizes.touchTarget,
                        }}
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
                  <PasswordRequirements password={value} revealed={isPasswordFocused} />
                </View>
              )}
            />
          </View>

          {providerButtons}
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
