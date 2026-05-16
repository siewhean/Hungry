import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { getMockSignUpFailure } from "@/features/auth/mockAuth";
import { validateEmail, validatePassword, validateRequired } from "@/features/auth/validation";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButton } from "./AuthProviderButton";
import { AuthScreenShell } from "./AuthScreenShell";
import {
  AUTH_COPY,
  getAuthProviderUnavailableMessage,
  getSignUpProviderSuccessMessage,
  type AuthProvider,
} from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

export function SignUpScreen({ navigation }: Props) {
  const { colorScheme, palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const showToast = useUIStore((state) => state.showToast);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const {
    control,
    handleSubmit,
    formState: { errors },
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
        // session === null means email confirmation is required.
        if (!session) {
          showToast({ message: AUTH_COPY.signUp.emailVerificationToast, tone: "success" });
          navigation.navigate("EmailVerification", { email: values.email });
          return;
        }
        applyProfile(session.profile);
        // When project auth is auto-confirm, Supabase returns an active session immediately.
        completeAuth({
          authProvider: "email",
          completedOnboarding: false,
          trackSignInEvent: false,
        });
        showToast({ message: AUTH_COPY.signUp.continueOnboardingToast, tone: "success" });
        return;
      } else {
        const failure = getMockSignUpFailure(values.email);
        if (failure) {
          showToast({ message: failure.message, tone: "error" });
          return;
        }
        showToast({
          message: AUTH_COPY.signUp.verificationUnavailableToast,
          tone: "warning",
        });
      }
      showToast({ message: AUTH_COPY.signUp.emailVerificationToast, tone: "success" });
      navigation.navigate("EmailVerification", { email: values.email });
    } catch (err) {
      const code =
        (err as { error_code?: string; code?: string })?.error_code ??
        (err as { error_code?: string; code?: string })?.code;
      if (code === "over_email_send_rate_limit") {
        showToast({
          message: AUTH_COPY.signUp.tooManyAttemptsToast,
          tone: "error",
        });
      } else if (code === "email_address_invalid") {
        showToast({ message: AUTH_COPY.signUp.invalidEmailToast, tone: "error" });
      } else {
        showToast({ message: AUTH_COPY.signUp.genericErrorToast, tone: "error" });
      }
    }
  });

  const handleProviderContinue = async (provider: AuthProvider) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        const service = getHungryService();
        let session;
        if (provider === "google") {
          session = await service.auth.signInWithGoogle();
        } else {
          session = await service.auth.signInWithApple();
        }
        applyProfile(session.profile);
      }
      showToast({
        message: getSignUpProviderSuccessMessage(provider),
        tone: "success",
      });
      completeAuth({
        authProvider: provider,
        completedOnboarding: false,
        trackSignInEvent: false,
      });
      navigation.getParent()?.reset({
        index: 0,
        routes: [
          { name: "OnboardingStack" as never, params: { screen: "OnboardingIntro1" } as never },
        ],
      });
    } catch (err) {
      const message = (err as { message?: string })?.message?.toLowerCase() ?? "";
      if (message.includes("provider is not enabled")) {
        showToast({
          message: getAuthProviderUnavailableMessage(provider),
          tone: "error",
        });
        return;
      }
      if (message.includes("cancelled")) {
        showToast({ message: AUTH_COPY.signUp.providerCancelledToast, tone: "warning" });
        return;
      }
      showToast({ message: AUTH_COPY.signUp.genericErrorToast, tone: "error" });
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.signUp.errorTitle} body={AUTH_COPY.signUp.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.signUp.title}
        subtitle={AUTH_COPY.signUp.subtitle}
        compact
        scroll={false}
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <View style={{ alignItems: "center", gap: spacing[4] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <AppText variant="micro" tone="secondary" style={{ textAlign: "center" }}>
                {AUTH_COPY.signUp.termsPrefix}
                <AppText
                  variant="micro"
                  tone="accent"
                  onPress={() => void openTrustedExternalUrl("https://hungry.sg/terms")}
                >
                  {AUTH_COPY.signUp.termsLabel}
                </AppText>
                {AUTH_COPY.signUp.privacyJoiner}
                <AppText
                  variant="micro"
                  tone="accent"
                  onPress={() => void openTrustedExternalUrl("https://hungry.sg/privacy")}
                >
                  {AUTH_COPY.signUp.privacyLabel}
                </AppText>
                {AUTH_COPY.signUp.termsSuffix}
              </AppText>
            </View>

            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
              <AppText tone="secondary">{AUTH_COPY.signUp.footerPrompt}</AppText>
              <Pressable
                onPress={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.navigate("Login");
                  }
                }}
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
          <View style={{ gap: spacing[3] }}>
            <AuthProviderButton
              intent="continue"
              provider="google"
              onPress={() => {
                void handleProviderContinue("google");
              }}
            />
            <AuthProviderButton
              intent="continue"
              provider="apple"
              onPress={() => {
                void handleProviderContinue("apple");
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

          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="displayName"
              rules={{
                validate: (value) =>
                  validateRequired(value, AUTH_COPY.signUp.displayNameValidationLabel),
              }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    placeholder={AUTH_COPY.signUp.displayNamePlaceholder}
                    value={value}
                    onChangeText={onChange}
                    leftIcon={<User color={palette.textMuted} size={18} />}
                  />
                  {errors.displayName ? (
                    <AppText variant="bodySmall" style={{ color: palette.error }}>
                      {errors.displayName.message}
                    </AppText>
                  ) : null}
                </View>
              )}
            />
            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    placeholder={AUTH_COPY.signUp.emailPlaceholder}
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    leftIcon={<Mail color={palette.textMuted} size={18} />}
                  />
                  {errors.email ? (
                    <AppText variant="bodySmall" style={{ color: palette.error }}>
                      {errors.email.message}
                    </AppText>
                  ) : null}
                </View>
              )}
            />
            <Controller
              control={control}
              name="password"
              rules={{ validate: (value) => validatePassword(value) }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    placeholder={AUTH_COPY.signUp.passwordPlaceholder}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={!showPassword}
                    leftIcon={<Lock color={palette.textMuted} size={18} />}
                    rightIcon={
                      <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
                        {showPassword ? (
                          <EyeOff color={palette.textMuted} size={18} />
                        ) : (
                          <Eye color={palette.textMuted} size={18} />
                        )}
                      </Pressable>
                    }
                  />
                  {errors.password ? (
                    <AppText variant="bodySmall" style={{ color: palette.error }}>
                      {errors.password.message}
                    </AppText>
                  ) : null}
                </View>
              )}
            />
          </View>

          <Button label={AUTH_COPY.signUp.primaryButton} onPress={handleSignUp} />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
