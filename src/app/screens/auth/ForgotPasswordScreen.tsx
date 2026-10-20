import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { ArrowLeft, LockKeyhole, Mail, MailCheck } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackPasswordResetRequested,
} from "@/features/auth/authAnalytics";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import { validateEmail } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { AUTH_COPY } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;
type FormValues = { email: string };

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colorScheme, palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  // After a send the screen becomes "Check your inbox" instead of bouncing to Login.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: "" } });

  useEffect(() => {
    trackAuthScreenViewed("forgot_password");
  }, []);

  // The emailed code works when the link was opened on another device. Verifying
  // signs the user in, so hold RootNavigator's redirect until the password is saved.
  const handleResetCode = async (code: string) => {
    if (!sentTo) return;
    setPasswordRecoveryInProgress(true);
    try {
      await getHungryService().auth.verifyEmailCode(sentTo, code, "recovery");
    } catch (error) {
      setPasswordRecoveryInProgress(false);
      trackAuthFailed("password_reset", "email", error);
      throw error;
    }
    navigation.navigate("ResetPassword", { email: sentTo, recoveryVerified: true });
  };

  const handleSend = handleSubmit(async ({ email }) => {
    try {
      if (isSupabaseMode) {
        await getHungryService().auth.forgotPassword(email);
        trackPasswordResetRequested();
      }
      setSentTo(email.trim().toLowerCase());
    } catch (error) {
      trackAuthFailed("password_reset", "email", error);
      showToast({ message: AUTH_COPY.forgotPassword.genericErrorToast, tone: "error" });
    }
  });

  return (
    <FeedErrorBoundary
      title={AUTH_COPY.forgotPassword.errorTitle}
      body={AUTH_COPY.forgotPassword.errorBody}
    >
      <AuthScreenShell
        title={AUTH_COPY.forgotPassword.title}
        subtitle={AUTH_COPY.forgotPassword.subtitle}
        compact
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={AUTH_COPY.forgotPassword.backToLogin}
            accessibilityHint="Returns to the sign in screen"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Login");
              }
            }}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              minHeight: 44,
            }}
          >
            <ArrowLeft color={palette.text} size={14} />
            <AppText tone="accent" style={{ fontWeight: "700" }}>
              {AUTH_COPY.forgotPassword.backToLogin}
            </AppText>
          </Pressable>
        }
      >
        {sentTo ? (
          <View style={{ gap: spacing[4] }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: 80,
                  justifyContent: "center",
                  width: 80,
                }}
              >
                <MailCheck color={palette.orange} size={30} />
              </View>
            </View>
            <View accessible accessibilityLiveRegion="polite" style={{ gap: spacing[2] }}>
              <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
                {AUTH_COPY.forgotPassword.sentTitle}
              </AppText>
              <AppText tone="secondary" style={{ textAlign: "center" }}>
                {AUTH_COPY.forgotPassword.sentBody.replace("{email}", sentTo)}
              </AppText>
              <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
                {AUTH_COPY.forgotPassword.sentSpamHint}
              </AppText>
            </View>
            <EmailCodeField onSubmit={handleResetCode} submitLabel="Reset password" />
            {isSupabaseMode ? null : (
              // Mock mode has no email; open the reset screen as the link would.
              <Button
                label="Open reset link (demo)"
                onPress={() => navigation.navigate("ResetPassword", { email: sentTo })}
              />
            )}
            <Button
              label={AUTH_COPY.forgotPassword.resendButton}
              variant="secondary"
              loading={isSubmitting}
              onPress={handleSend}
            />
            <Button
              label={AUTH_COPY.forgotPassword.useDifferentEmail}
              variant="ghost"
              onPress={() => setSentTo(null)}
            />
          </View>
        ) : (
          <View style={{ gap: spacing[4] }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: 80,
                  justifyContent: "center",
                  width: 80,
                }}
              >
                <LockKeyhole color={palette.orange} size={30} />
              </View>
            </View>

            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <Input
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={() => void handleSend()}
                  placeholder={AUTH_COPY.forgotPassword.emailPlaceholder}
                  value={value}
                  onChangeText={onChange}
                  leftIcon={<Mail color={palette.textMuted} size={16} />}
                  error={!!errors.email}
                  errorText={errors.email?.message}
                />
              )}
            />
            <Button
              label={AUTH_COPY.forgotPassword.primaryButton}
              onPress={handleSend}
              loading={isSubmitting}
            />
          </View>
        )}
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
