import { useAuthOperation } from "@/features/auth/useAuthOperation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  applySignedInProfile,
  captureGuestProfileSnapshot,
} from "@/features/auth/applySignedInProfile";
import { getMockSignUpFailure } from "@/features/auth/mockAuth";
import { validateEmail, validatePassword, validateRequired } from "@/features/auth/validation";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
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
import { WEB_LINKS } from "@/constants/links";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

export function SignUpScreen({ navigation }: Props) {
  const { busy, run } = useAuthOperation();
  const { colorScheme, palette, spacing } = useHungryTheme();
  const oauthProvidersEnabled = FEATURE_FLAGS.oauthProvidersEnabled;
  const [showPassword, setShowPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const handleSignUp = handleSubmit(async (values) =>
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
        // session === null means email confirmation is required.
        if (!session) {
          showToast({ message: AUTH_COPY.signUp.emailVerificationToast, tone: "success" });
          navigation.navigate("EmailVerification", { email: values.email });
          return;
        }
        if (
          !(await applySignedInProfile(session.profile, {
            profileReady: session.profileReady,
            guestSnapshot,
            onSyncWarning: () =>
              showToast({
                message:
                  "Account created, but your taste profile could not sync. Try updating it later.",
                tone: "warning",
              }),
          }))
        )
          return;
        // When project auth is auto-confirm, Supabase returns an active session immediately.
        completeAuth({
          userId: session.profile.id,
          authProvider: "email",
          completedOnboarding: false,
          trackSignInEvent: false,
        });
        showToast({ message: AUTH_COPY.signUp.continueOnboardingToast, tone: "success" });
        return;
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
    }),
  );

  const handleProviderContinue = async (provider: AuthProvider) =>
    run(async () => {
      const guestSnapshot = captureGuestProfileSnapshot();
      const providerErrorMessage = (error: unknown) => {
        const rawMessage =
          (error as { message?: string })?.message ?? AUTH_COPY.signUp.genericErrorToast;
        const message = rawMessage.toLowerCase();
        if (message.includes("provider is not enabled")) {
          return getAuthProviderUnavailableMessage(provider);
        }
        if (message.includes("cancelled")) {
          return AUTH_COPY.signUp.providerCancelledToast;
        }
        if (message.includes("callback url was not trusted")) {
          return message;
        }
        if (message.includes("state did not match")) {
          return message;
        }
        if (message.includes("no active session") || message.includes("session credentials")) {
          return rawMessage;
        }

        if (typeof __DEV__ !== "undefined" && __DEV__) {
          return rawMessage;
        }

        return AUTH_COPY.signUp.genericErrorToast;
      };

      try {
        if (getServiceProvider().mode === "supabase") {
          const service = getHungryService();
          let session;
          if (provider === "google") {
            session = await service.auth.signInWithGoogle();
          } else {
            session = await service.auth.signInWithApple();
          }
          if (
            !(await applySignedInProfile(session.profile, {
              profileReady: session.profileReady,
              guestSnapshot,
              onSyncWarning: () =>
                showToast({
                  message:
                    "Signed in, but your taste profile could not sync. Try updating it later.",
                  tone: "warning",
                }),
            }))
          )
            return;
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
        // Guests who already finished onboarding on this device go straight home
        // (RootNavigator handles that); everyone else continues Intro -> Cuisine -> ... -> Location.
        if (!useSessionStore.getState().hasCompletedOnboarding) {
          navigation.getParent()?.reset({
            index: 0,
            routes: [
              { name: "OnboardingStack" as never, params: { screen: "OnboardingIntro1" } as never },
            ],
          });
        }
      } catch (err) {
        const message = providerErrorMessage(err);
        showToast({
          message,
          tone: message === AUTH_COPY.signUp.providerCancelledToast ? "warning" : "error",
        });
      }
    });

  return (
    <FeedErrorBoundary title={AUTH_COPY.signUp.errorTitle} body={AUTH_COPY.signUp.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.signUp.title}
        subtitle={AUTH_COPY.signUp.subtitle}
        compact
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
              <AppText
                variant="micro"
                tone="secondary"
                style={{ textAlign: "center", width: "100%" }}
              >
                {AUTH_COPY.signUp.termsPrefix.trim()}
              </AppText>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={AUTH_COPY.signUp.termsLabel}
                onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
                style={{ minHeight: 44, paddingHorizontal: spacing[2], justifyContent: "center" }}
              >
                <AppText variant="micro" tone="accent">
                  {AUTH_COPY.signUp.termsLabel}
                </AppText>
              </Pressable>
              <AppText variant="micro" tone="secondary">
                and
              </AppText>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={AUTH_COPY.signUp.privacyLabel}
                onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
                style={{ minHeight: 44, paddingHorizontal: spacing[2], justifyContent: "center" }}
              >
                <AppText variant="micro" tone="accent">
                  {AUTH_COPY.signUp.privacyLabel}
                </AppText>
              </Pressable>
            </View>

            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
              <AppText tone="secondary">{AUTH_COPY.signUp.footerPrompt}</AppText>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={AUTH_COPY.signUp.footerAction}
                disabled={busy}
                style={{ minHeight: 44, justifyContent: "center" }}
                accessibilityHint="Returns to the sign in screen"
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
          {oauthProvidersEnabled ? (
            <>
              <View style={{ gap: spacing[3] }}>
                <AuthProviderButton
                  disabled={busy}
                  intent="continue"
                  provider="google"
                  onPress={() => {
                    void handleProviderContinue("google");
                  }}
                />
                <AuthProviderButton
                  disabled={busy}
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
                <View style={{ gap: spacing[1] }}>
                  <Input
                    label="Display name"
                    error={!!errors.displayName}
                    errorText={errors.displayName?.message}
                    placeholder={AUTH_COPY.signUp.displayNamePlaceholder}
                    value={value}
                    onChangeText={onChange}
                    leftIcon={<User color={palette.textMuted} size={18} />}
                  />
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
                    label="Email"
                    error={!!errors.email}
                    errorText={errors.email?.message}
                    placeholder={AUTH_COPY.signUp.emailPlaceholder}
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
                    label="Password"
                    error={!!errors.password}
                    errorText={errors.password?.message}
                    placeholder={AUTH_COPY.signUp.passwordPlaceholder}
                    value={value}
                    onChangeText={onChange}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    secureTextEntry={!showPassword}
                    autoCorrect={false}
                    spellCheck={false}
                    autoCapitalize="none"
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
                  {!errors.password ? (
                    <AppText variant="bodySmall" tone="secondary">
                      {AUTH_COPY.signUp.passwordRules}
                    </AppText>
                  ) : null}
                </View>
              )}
            />
          </View>

          <Button label={AUTH_COPY.signUp.primaryButton} loading={busy} onPress={handleSignUp} />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
