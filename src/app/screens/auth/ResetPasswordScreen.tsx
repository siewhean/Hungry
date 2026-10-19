import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import {
  getPasswordUpdateErrorMessage,
  PASSWORD_RULES,
  validateConfirmPassword,
  validatePassword,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string; confirmPassword: string };

// Mirrors validatePassword so the checklist ticks as the user types.
const PASSWORD_CHECKS = [
  { label: "At least 12 characters", test: (value: string) => value.length >= 12 },
  {
    label: "Upper and lowercase letters",
    test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value),
  },
  { label: "A number", test: (value: string) => /\d/.test(value) },
  { label: "A symbol", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const confirmPasswordRef = useRef<TextInput>(null);
  // The reset link's code can be exchanged only once; a retry after a rejected
  // password must call updatePassword alone.
  const recoveryCodeExchangedRef = useRef(false);
  // An expired or used link can never succeed on retry; offer a new one instead.
  const [linkExpired, setLinkExpired] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  const passwordValue = watch("password");

  useEffect(() => {
    trackAuthScreenViewed("reset_password");
  }, []);

  // Leaving the reset flow releases the hold so RootNavigator can route onward.
  useEffect(() => () => setPasswordRecoveryInProgress(false), [setPasswordRecoveryInProgress]);

  const handleReset = handleSubmit(async ({ password }) => {
    // Exchanging the recovery code signs the user in. Hold RootNavigator's
    // signed-in redirect until the new password is saved and confirmed on
    // ResetPasswordSuccess, which releases the hold.
    setPasswordRecoveryInProgress(true);
    if (getConfiguredDataSource() === "supabase") {
      const auth = getHungryService().auth;
      if (!recoveryCodeExchangedRef.current) {
        try {
          await auth.exchangeRecoveryCode(route.params?.code ?? "");
          recoveryCodeExchangedRef.current = true;
        } catch (error) {
          // No session was created, so nothing to hold.
          setPasswordRecoveryInProgress(false);
          trackAuthFailed("password_reset", "email", error);
          setLinkExpired(true);
          showToast({
            message: "This reset link has expired or was already used. Request a new one.",
            tone: "error",
          });
          return;
        }
      }
      try {
        await auth.updatePassword(password);
      } catch (error) {
        // The recovery session is signed in: keep the hold so the user stays
        // here and can retry with a different password.
        trackAuthFailed("password_reset", "email", error);
        showToast({ message: getPasswordUpdateErrorMessage(error), tone: "error" });
        return;
      }
    }
    navigation.navigate("ResetPasswordSuccess");
  });

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title="Set a new password"
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            accessibilityHint="Returns to the sign in screen"
            onPress={() => navigation.navigate("Login")}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              minHeight: 44,
            }}
          >
            <ArrowLeft color={palette.text} size={12} />
            <AppText tone="secondary" style={{ fontWeight: "600" }}>
              Back to sign in
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          {linkExpired ? (
            <View
              accessible
              accessibilityRole="alert"
              style={{
                backgroundColor: palette.errorSoft,
                borderRadius: componentRadii.card,
                gap: spacing[2],
                padding: spacing[3],
              }}
            >
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                This reset link has expired or was already used.
              </AppText>
              <Button
                label="Send a new link"
                variant="secondary"
                onPress={() => navigation.navigate("ForgotPassword")}
              />
            </View>
          ) : null}
          <Controller
            control={control}
            name="password"
            rules={{ validate: (value) => validatePassword(value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="New password"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                value={value}
                onChangeText={onChange}
                error={!!errors.password}
                errorText={errors.password?.message}
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
                      <EyeOff color={palette.textMuted} size={15} />
                    ) : (
                      <Eye color={palette.textMuted} size={15} />
                    )}
                  </Pressable>
                }
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            rules={{ validate: (value) => validateConfirmPassword(passwordValue ?? "", value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                ref={confirmPasswordRef}
                label="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                returnKeyType="go"
                onSubmitEditing={() => void handleReset()}
                value={value}
                onChangeText={onChange}
                error={!!errors.confirmPassword}
                errorText={errors.confirmPassword?.message}
                rightIcon={
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    accessibilityHint={
                      showConfirmPassword
                        ? "Hides the confirmation password characters"
                        : "Shows the confirmation password characters"
                    }
                    onPress={() => setShowConfirmPassword((current) => !current)}
                    hitSlop={8}
                  >
                    {showConfirmPassword ? (
                      <EyeOff color={palette.textMuted} size={15} />
                    ) : (
                      <Eye color={palette.textMuted} size={15} />
                    )}
                  </Pressable>
                }
              />
            )}
          />

          <View
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: componentRadii.card,
              gap: spacing[2],
              padding: spacing[4],
            }}
          >
            {PASSWORD_CHECKS.map((check) => {
              const met = check.test(passwordValue ?? "");
              return (
                <View
                  key={check.label}
                  accessible
                  accessibilityLabel={`${check.label}, ${met ? "met" : "not met yet"}`}
                  style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
                >
                  {met ? (
                    <CheckCircle2 color={palette.success} size={14} />
                  ) : (
                    <Circle color={palette.textMuted} size={14} />
                  )}
                  <AppText variant="bodySmall" tone={met ? "default" : "muted"}>
                    {check.label}
                  </AppText>
                </View>
              );
            })}
          </View>

          <Button
            label="Update password"
            onPress={handleReset}
            loading={isSubmitting}
            style={{ minHeight: 56 }}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
