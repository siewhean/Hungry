import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react-native";
import { useEffect, useState } from "react";

import { AppText, Button, FeedErrorBoundary, InlineBanner, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { getMockLoginFailure } from "@/features/auth/mockAuth";
import { validateEmail, validateRequired } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore, type AuthNotice } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButton } from "./AuthProviderButton";
import { AuthScreenShell } from "./AuthScreenShell";
import { AUTH_COPY, getAuthProviderUnavailableMessage, type AuthProvider } from "./authCopy";
import { getAuthErrorLogContext, getLoginErrorMessage } from "./authErrors";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;
type FormValues = { email: string; password: string };

export function LoginScreen({ navigation }: Props) {
  const { colorScheme, palette, spacing } = useHungryTheme();
  const oauthProvidersEnabled = FEATURE_FLAGS.oauthProvidersEnabled;
  const [showPassword, setShowPassword] = useState(false);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const pendingAuthNotice = useSessionStore((state) => state.authNotice);
  const showToast = useUIStore((state) => state.showToast);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);

  // One-shot notices (session expiry, account deletion confirmation) are set
  // before the signed-out navigator mounts; show them here, then clear them.
  useEffect(() => {
    if (!sessionExpired && !pendingAuthNotice) return;
    const notice = useSessionStore.getState().consumeAuthNotice();
    if (notice) setAuthNotice(notice);
  }, [pendingAuthNotice, sessionExpired]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  const finishLogin = (authProvider: "email" | AuthProvider, trackSignInEvent = true) => {
    completeAuth({
      authProvider,
      // Existing-account sign-in must open the authenticated shell immediately.
      // Local onboarding completion is device state and cannot gate a restored
      // authenticated account after a reinstall or deep link.
      completedOnboarding: true,
      skippedTasteQuiz: true,
      trackSignInEvent,
    });
  };

  const handleLogin = handleSubmit(async (values) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        const session = await getHungryService().auth.signIn(values.email, values.password);
        const migration = await applySignedInProfile(session.profile, {
          profileReady: session.profileReady,
          onSyncWarning: () =>
            showToast({
              message: "Signed in, but your taste profile could not sync. Try updating it later.",
              tone: "warning",
            }),
        });
        if (migration.status === "failed") return;
      } else {
        const failure = getMockLoginFailure(values.email, values.password);
        if (failure) {
          showToast({ message: failure.message, tone: "error" });
          return;
        }
      }
      finishLogin("email");
    } catch (err) {
      // Diagnostics only: provider code/status, never the email or password.
      console.warn("[auth] Email sign-in failed", getAuthErrorLogContext(err));
      showToast({ message: getLoginErrorMessage(err), tone: "error" });
    }
  });

  const handleProviderLogin = async (provider: AuthProvider) => {
    const providerErrorMessage = (error: unknown) => {
      const rawMessage =
        (error as { message?: string })?.message ?? AUTH_COPY.login.genericErrorToast;
      const message = rawMessage.toLowerCase();
      if (message.includes("provider is not enabled")) {
        return getAuthProviderUnavailableMessage(provider);
      }
      if (message.includes("cancelled")) return AUTH_COPY.login.providerCancelledToast;
      if (message.includes("callback url was not trusted")) return message;
      if (message.includes("state did not match")) return message;
      if (message.includes("no active session") || message.includes("session credentials")) {
        return rawMessage;
      }
      if (typeof __DEV__ !== "undefined" && __DEV__) return rawMessage;
      return AUTH_COPY.login.genericErrorToast;
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
      finishLogin(provider);
    } catch (err) {
      const message = providerErrorMessage(err);
      showToast({
        message,
        tone: message === AUTH_COPY.login.providerCancelledToast ? "warning" : "error",
      });
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.login.errorTitle} body={AUTH_COPY.login.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.login.title}
        compact
        contentOffsetTop={spacing[16]}
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              marginTop: spacing[2],
            }}
          >
            <AppText tone="secondary">{AUTH_COPY.login.footerPrompt}</AppText>
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={AUTH_COPY.login.footerAction}
              accessibilityHint="Opens the account creation screen"
              onPress={() => navigation.navigate("SignUp")}
            >
              <AppText variant="bodyBold" tone="accent">
                {AUTH_COPY.login.footerAction}
              </AppText>
            </Pressable>
          </View>
        }
      >
        <View style={{ gap: spacing[4] }}>
          {authNotice ? <InlineBanner message={authNotice.message} tone={authNotice.tone} /> : null}
          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <Input
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={AUTH_COPY.login.emailPlaceholder}
                  value={value}
                  onChangeText={onChange}
                  leftIcon={<Mail color={palette.textMuted} size={18} />}
                  error={!!errors.email}
                  errorText={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{
                validate: (value) =>
                  validateRequired(value, AUTH_COPY.login.passwordValidationLabel),
              }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    placeholder={AUTH_COPY.login.passwordPlaceholder}
                    secureTextEntry={!showPassword}
                    value={value}
                    onChangeText={onChange}
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
                  <View style={{ alignItems: "flex-end" }}>
                    <Pressable
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={AUTH_COPY.login.forgotPasswordLink}
                      accessibilityHint="Opens password reset"
                      onPress={() => navigation.navigate("ForgotPassword")}
                    >
                      <AppText variant="micro" tone="accent">
                        {AUTH_COPY.login.forgotPasswordLink}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>

          <Button
            label={AUTH_COPY.login.primaryButton}
            onPress={handleLogin}
            loading={isSubmitting}
            rightIcon={<ArrowRight size={18} color={palette.textOnOrange} />}
          />

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[3],
              marginVertical: spacing[2],
            }}
          >
            <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
            <AppText variant="micro" tone="muted">
              {AUTH_COPY.login.divider}
            </AppText>
            <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
          </View>

          <View style={{ gap: spacing[3] }}>
            <AuthProviderButton
              disabled={!oauthProvidersEnabled}
              intent="signIn"
              provider="google"
              onPress={() => void handleProviderLogin("google")}
            />
            <AuthProviderButton
              disabled={!oauthProvidersEnabled}
              intent="signIn"
              provider="apple"
              onPress={() => void handleProviderLogin("apple")}
            />
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
