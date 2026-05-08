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
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

export function SignUpScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
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
          showToast({ message: "Account created. Please verify your email.", tone: "success" });
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
        showToast({ message: "Account created. Continue onboarding.", tone: "success" });
        return;
      } else {
        const failure = getMockSignUpFailure(values.email);
        if (failure) {
          showToast({ message: failure.message, tone: "error" });
          return;
        }
        showToast({
          message: "Verification email is currently unavailable. You can continue and verify later.",
          tone: "warning",
        });
      }
      showToast({ message: "Account created. Please verify your email.", tone: "success" });
      navigation.navigate("EmailVerification", { email: values.email });
    } catch (err) {
      const code =
        (err as { error_code?: string; code?: string })?.error_code ??
        (err as { error_code?: string; code?: string })?.code;
      if (code === "over_email_send_rate_limit") {
        showToast({
          message: "Too many attempts. Please wait a moment and try again.",
          tone: "error",
        });
      } else if (code === "email_address_invalid") {
        showToast({ message: "Please use a valid email address.", tone: "error" });
      } else {
        showToast({ message: "Could not continue sign-up. Please try again.", tone: "error" });
      }
    }
  });

  const handleProviderContinue = async (provider: "google" | "apple") => {
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
        message: `Continue with ${provider === "google" ? "Google" : "Apple"} successful. Continue onboarding.`,
        tone: "success",
      });
      completeAuth({
        authProvider: provider,
        completedOnboarding: false,
        trackSignInEvent: false,
      });
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "OnboardingStack" as never, params: { screen: "OnboardingIntro1" } as never }],
      });
    } catch (err) {
      const message = (err as { message?: string })?.message?.toLowerCase() ?? "";
      if (message.includes("provider is not enabled")) {
        showToast({
          message: `${provider === "google" ? "Google" : "Apple"} sign-in is not enabled in Supabase Auth.`,
          tone: "error",
        });
        return;
      }
      if (message.includes("cancelled")) {
        showToast({ message: "Sign-up was cancelled.", tone: "warning" });
        return;
      }
      showToast({ message: "Could not continue sign-up. Please try again.", tone: "error" });
    }
  };

  return (
    <FeedErrorBoundary
      title="Sign-up unavailable"
      body="Couldn't load account creation right now. Please retry."
    >
      <AuthScreenShell
        title="Create account"
        subtitle="Join our community of food lovers."
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
                By creating an account, you agree to Hungry&apos;s{" "}
                <AppText
                  variant="micro"
                  tone="accent"
                  onPress={() => void openTrustedExternalUrl("https://hungry.sg/terms")}
                >
                  Terms of Service
                </AppText>{" "}
                and{" "}
                <AppText
                  variant="micro"
                  tone="accent"
                  onPress={() => void openTrustedExternalUrl("https://hungry.sg/privacy")}
                >
                  Privacy Policy
                </AppText>
                .
              </AppText>
            </View>

            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
              <AppText tone="secondary">Already have an account? </AppText>
              <Pressable onPress={() => navigation.navigate("Login")}>
                <AppText variant="bodyBold" tone="accent">
                  Log in
                </AppText>
              </Pressable>
            </View>
          </View>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View style={{ gap: spacing[3] }}>
            <Button
              label="Continue with Google"
              variant="secondary"
              onPress={() => {
                void handleProviderContinue("google");
              }}
            />
            <Button
              label="Continue with Apple"
              variant="secondary"
              onPress={() => {
                void handleProviderContinue("apple");
              }}
            />
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
            <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
            <AppText variant="micro" tone="muted">
              OR REGISTER WITH EMAIL
            </AppText>
            <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
          </View>

          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="displayName"
              rules={{ validate: (value) => validateRequired(value, "Display name") }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    placeholder="Full Name"
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
                    placeholder="Email Address"
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
                    placeholder="Create Password"
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

          <Button label="Create Account" onPress={handleSignUp} />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
