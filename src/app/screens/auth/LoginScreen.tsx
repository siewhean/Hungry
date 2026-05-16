import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { getMockLoginFailure } from "@/features/auth/mockAuth";
import { validateEmail, validateRequired } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
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
  const [showPassword, setShowPassword] = useState(false);
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const showToast = useUIStore((state) => state.showToast);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
  });

  const handleLogin = handleSubmit(async (values) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        const session = await getHungryService().auth.signIn(values.email, values.password);
        applyProfile(session.profile);
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
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
      showToast({ message: AUTH_COPY.login.providerSuccessToast, tone: "success" });
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
        showToast({ message: AUTH_COPY.login.providerCancelledToast, tone: "warning" });
        return;
      }
      showToast({ message: AUTH_COPY.login.genericErrorToast, tone: "error" });
    }
  };

  return (
    <FeedErrorBoundary title={AUTH_COPY.login.errorTitle} body={AUTH_COPY.login.errorBody}>
      <AuthScreenShell
        title={AUTH_COPY.login.title}
        scroll={false}
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
            <Pressable onPress={() => navigation.navigate("SignUp")}>
              <AppText variant="bodyBold" tone="accent">
                {AUTH_COPY.login.footerAction}
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
                      <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
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
                    <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
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
            rightIcon={<ArrowRight size={18} color={palette.white} />}
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
              intent="signIn"
              provider="google"
              onPress={() => {
                void handleProviderLogin("google");
              }}
            />
            <AuthProviderButton
              intent="signIn"
              provider="apple"
              onPress={() => {
                void handleProviderLogin("apple");
              }}
            />
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
