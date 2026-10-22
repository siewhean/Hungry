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
import { getAuthErrorCode, getAuthFailureMessage } from "@/features/auth/authErrors";
import { clearPendingDishSave } from "@/features/auth/pendingDishSave";
import { reportError } from "@/lib/monitoring/reportError";
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
import { AUTH_EYE_BUTTON_STYLE } from "./authEyeButton";
import { AUTH_COPY, getProviderErrorMessage, type AuthProvider } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type FormValues = {
  email: string;
  password: string;
};

export function LoginScreen({ navigation, route }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const oauthProvidersEnabled = FEATURE_FLAGS.oauthProvidersEnabled;
  const [showPassword, setShowPassword] = useState(false);
  const [providerInFlight, setProviderInFlight] = useState<AuthProvider | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  // Inline copy of the last server error, so it is not only a passing toast.
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const {
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { email: route.params?.email ?? "", password: "" },
  });
  const isBusy = isSubmitting || providerInFlight !== null;

  useEffect(() => {
    trackAuthScreenViewed("login");
  }, []);

  // Sign-in is optional: guests can browse and are asked to sign in on demand.
  // "Not now" returns to where the gate opened (a dish, a tab) when it can, and
  // drops the pending return route so a later sign-in does not jump there.
  const continueAsGuest = () => {
    trackGuestContinued("login");
    setReturnRoute(undefined);
    useUIStore.getState().takePendingAuthAction();
    clearPendingDishSave();
    const root = navigation.getParent<NavigationProp<RootStackParamList>>();
    if (root?.canGoBack()) {
      root.goBack();
      return;
    }
    root?.reset({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Home" } }],
    });
  };

  const resendVerification = async () => {
    const email = unconfirmedEmail ?? getValues("email");
    if (!email || isResendingVerification) return;
    setIsResendingVerification(true);
    try {
      await getHungryService().auth.resendVerificationEmail(email);
      showToast({ message: AUTH_COPY.login.resendVerificationSentToast, tone: "success" });
      navigation.navigate("EmailVerification", { email: email.trim().toLowerCase() });
    } catch (err) {
      trackAuthFailed("email_confirm", "email", err);
      showToast({
        message: getAuthFailureMessage(
          err,
          "Could not resend verification email. Please try again shortly.",
        ),
        tone: "error",
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleLogin = handleSubmit(async (values) => {
    setFormError(null);
    setUnconfirmedEmail(null);
    try {
      const session = await getHungryService().auth.signIn(values.email, values.password);
      await applySignedInProfile(session.profile, {
        profileReady: session.profileReady,
        onSyncWarning: () =>
          showToast({
            message: "Signed in, but your taste profile could not sync. Try updating it later.",
            tone: "warning",
          }),
      });
      // With Supabase the auth listener decides from the account whether first-run
      // onboarding runs (a new account that confirmed elsewhere still gets it); the mock
      // has no listener, and its accounts always exist.
      completeAuth({ completedOnboarding: getConfiguredDataSource() !== "supabase" });
      showToast({ message: AUTH_COPY.login.successToast, tone: "success" });
    } catch (err) {
      trackAuthFailed("sign_in", "email", err);
      const code = getAuthErrorCode(err);
      const message =
        code === "email_not_confirmed"
          ? AUTH_COPY.login.emailNotConfirmedToast
          : code === "invalid_credentials"
            ? AUTH_COPY.login.invalidCredentialsToast
            : getAuthFailureMessage(err, AUTH_COPY.login.genericErrorToast);
      if (code === "email_not_confirmed") setUnconfirmedEmail(values.email);
      // The inline banner is the one announcement; a toast on top would read twice.
      setFormError(message);
    }
  });

  const handleProviderLogin = async (provider: AuthProvider) => {
    if (isBusy) return;
    setFormError(null);
    setProviderInFlight(provider);
    const isSupabase = getConfiguredDataSource() === "supabase";
    try {
      if (isSupabase) {
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
      // With Supabase the auth listener already decided from the account whether
      // onboarding runs (a new Google/Apple account still gets it).
      completeAuth({
        authProvider: provider,
        completedOnboarding: !isSupabase,
        trackSignInEvent: !isSupabase,
      });
      showToast({ message: AUTH_COPY.login.providerSuccessToast, tone: "success" });
    } catch (err) {
      trackAuthFailed("sign_in", provider, err);
      const message = getProviderErrorMessage(err, provider, {
        cancelled: AUTH_COPY.login.providerCancelledToast,
        failed: AUTH_COPY.login.providerFailedToast,
      });
      if (message === AUTH_COPY.login.providerCancelledToast) {
        // Cancelling is not an error: a passing toast, no red banner.
        showToast({ message, tone: "warning" });
      } else {
        reportError(err, { flow: "sign_in", provider });
        setFormError(message);
      }
    } finally {
      setProviderInFlight(null);
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.login.errorTitle} body={AUTH_COPY.login.errorBody}>
      <AuthScreenShell
        title={route.params?.title ?? AUTH_COPY.login.title}
        compact
        onClose={continueAsGuest}
        closeLabel={AUTH_COPY.login.closeLabel}
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
                hitSlop={8}
                style={{ justifyContent: "center", minHeight: 44 }}
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
          {/* One layout on every auth screen: Apple, Google, then email.
              Google/Apple stay hidden until they are enabled for this build. */}
          {oauthProvidersEnabled ? (
            <>
              <View style={{ gap: spacing[3] }}>
                <AuthProviderButton
                  disabled={isBusy}
                  intent="continue"
                  provider="apple"
                  onPress={() => {
                    void handleProviderLogin("apple");
                  }}
                />
                <AuthProviderButton
                  disabled={isBusy}
                  intent="continue"
                  provider="google"
                  onPress={() => {
                    void handleProviderLogin("google");
                  }}
                />
              </View>

              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
                <AppText variant="micro" tone="muted">
                  {AUTH_COPY.login.divider}
                </AppText>
                <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
              </View>
            </>
          ) : null}

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
                  label={AUTH_COPY.login.emailLabel}
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
                    label={AUTH_COPY.login.passwordLabel}
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
                        style={AUTH_EYE_BUTTON_STYLE}
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
                      hitSlop={8}
                      style={{ justifyContent: "center", minHeight: 44 }}
                    >
                      <AppText variant="bodySmall" tone="accent">
                        {AUTH_COPY.login.forgotPasswordLink}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>

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
                  accessibilityLabel={AUTH_COPY.login.resendVerificationAction}
                  accessibilityState={{ disabled: isResendingVerification }}
                  disabled={isResendingVerification}
                  onPress={() => void resendVerification()}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <AppText variant="bodyBold" tone="accent">
                    {AUTH_COPY.login.resendVerificationAction}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Button
            label={AUTH_COPY.login.primaryButton}
            onPress={handleLogin}
            loading={isSubmitting}
            disabled={isBusy}
            rightIcon={<ArrowRight size={18} color={palette.white} />}
            labelColor={palette.white}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
