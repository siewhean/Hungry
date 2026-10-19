import type { NavigationProp } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackGuestContinued,
} from "@/features/auth/authAnalytics";
import { getMockLoginFailure } from "@/features/auth/mockAuth";
import { validateEmail, validateRequired } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { AuthStackParamList } from "./AuthStack";
import { AuthProviderButton } from "./AuthProviderButton";
import { AuthScreenShell } from "./AuthScreenShell";
import { AUTH_COPY, getAuthProviderUnavailableMessage, type AuthProvider } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type FormValues = {
  email: string;
  password: string;
};

export function LoginScreen({ navigation }: Props) {
  const { colorScheme, palette, spacing } = useHungryTheme();
  const oauthProvidersEnabled = FEATURE_FLAGS.oauthProvidersEnabled;
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const showToast = useUIStore((state) => state.showToast);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
  });
  const isBusy = isSubmitting || providerInFlight !== null;

  useEffect(() => {
    trackAuthScreenViewed("login");
  }, []);

  // Sign-in is optional: guests can browse and are asked to sign in on demand.
  const continueAsGuest = () => {
    trackGuestContinued("login");
    navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Home" } }],
    });
  };

  const handleLogin = handleSubmit(async (values) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        const session = await getHungryService().auth.signIn(values.email, values.password);
        await applySignedInProfile(session.profile, {
          profileReady: session.profileReady,
          onSyncWarning: () =>
            showToast({
              message: "Signed in, but your taste profile could not sync. Try updating it later.",
              tone: "warning",
            }),
        });
      } else {
        const failure = getMockLoginFailure(values.email, values.password);
        if (failure) {
          showToast({ message: failure.message, tone: "error" });
          return;
        }
      }
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
      showToast({ message: AUTH_COPY.login.successToast, tone: "success" });
    } catch (err) {
      trackAuthFailed("sign_in", "email", err);
      const code =
        (err as { error_code?: string; code?: string })?.error_code ??
        (err as { error_code?: string; code?: string })?.code;
      if (code === "email_not_confirmed") {
        showToast({ message: AUTH_COPY.login.emailNotConfirmedToast, tone: "error" });
      } else if (code === "invalid_credentials") {
        showToast({ message: AUTH_COPY.login.invalidCredentialsToast, tone: "error" });
      } else {
        showToast({ message: AUTH_COPY.login.genericErrorToast, tone: "error" });
      }
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
      if (message.includes("cancelled")) {
        return AUTH_COPY.login.providerCancelledToast;
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

      return AUTH_COPY.login.genericErrorToast;
    };

    if (isBusy) return;
    setProviderInFlight(provider);
    try {
      if (getConfiguredDataSource() === "supabase") {
        const service = getHungryService();
        let session;
        if (provider === "google") {
          session = await service.auth.signInWithGoogle();
        } else {
          session = await service.auth.signInWithApple();
        }
        await applySignedInProfile(session.profile, {
          profileReady: session.profileReady,
          onSyncWarning: () =>
            showToast({
              message: "Signed in, but your taste profile could not sync. Try updating it later.",
              tone: "warning",
            }),
        });
      }
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
      showToast({ message: AUTH_COPY.login.providerSuccessToast, tone: "success" });
    } catch (err) {
      trackAuthFailed("sign_in", provider, err);
      const message = providerErrorMessage(err);
      showToast({
        message,
        tone: message === AUTH_COPY.login.providerCancelledToast ? "warning" : "error",
      });
    } finally {
      setProviderInFlight(null);
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.login.errorTitle} body={AUTH_COPY.login.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.login.title}
        compact
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <View style={{ alignItems: "center", gap: spacing[1] }}>
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
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={AUTH_COPY.login.continueAsGuest}
              accessibilityHint="Opens Hungry without signing in"
              onPress={continueAsGuest}
              style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[3] }}
            >
              <AppText tone="secondary" style={{ textDecorationLine: "underline" }}>
                {AUTH_COPY.login.continueAsGuest}
              </AppText>
            </Pressable>
          </View>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <Input
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
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
                    ref={passwordRef}
                    placeholder={AUTH_COPY.login.passwordPlaceholder}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="current-password"
                    returnKeyType="go"
                    onSubmitEditing={() => void handleLogin()}
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
            disabled={isBusy}
            rightIcon={<ArrowRight size={18} color={palette.white} />}
            labelColor={palette.white}
          />

          {/* Google/Apple stay hidden until they are enabled for this build. */}
          {oauthProvidersEnabled ? (
            <>
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
                  disabled={isBusy}
                  intent="signIn"
                  provider="google"
                  onPress={() => {
                    void handleProviderLogin("google");
                  }}
                />
                <AuthProviderButton
                  disabled={isBusy}
                  intent="signIn"
                  provider="apple"
                  onPress={() => {
                    void handleProviderLogin("apple");
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
