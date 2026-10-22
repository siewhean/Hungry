import { useAuthFlowStore } from "@/features/auth/useAuthFlowStore";
import { useAuthOperation } from "@/features/auth/useAuthOperation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff } from "lucide-react-native";
import { useEffect, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { validateConfirmPassword, validatePassword } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string; confirmPassword: string };

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { busy, run } = useAuthOperation();
  const { colorScheme, componentRadii, palette, spacing, radii } = useHungryTheme();
  const [resetError, setResetError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  useEffect(() => {
    setPasswordRecoveryInProgress(true);
    useAuthFlowStore.getState().setPasswordResetCompleted(false);
    return () => setPasswordRecoveryInProgress(false);
  }, [setPasswordRecoveryInProgress]);
  const passwordValue = watch("password");

  const handleReset = handleSubmit(async ({ password }) =>
    run(async () => {
      try {
        setResetError(null);
        await getHungryService().auth.resetPassword(route.params?.code ?? "", password);
        useAuthFlowStore.getState().setPasswordResetCompleted(true);
        showToast({
          message: "Password updated. Sign in with your new password.",
          tone: "success",
        });
        navigation.navigate("ResetPasswordSuccess");
      } catch {
        setResetError(
          "Password reset failed. Your entries are preserved. Retry, or request a new reset email if the link has expired.",
        );
        showToast({ message: "Password reset failed. Please try again.", tone: "error" });
      }
    }),
  );

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title="Choose a new password"
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        scroll
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Back to Sign In"
            accessibilityHint="Returns to the sign in screen"
            onPress={() => navigation.navigate("Login")}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={12} />
            <AppText tone="secondary" style={{ fontWeight: "600" }}>
              Back to Sign In
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <Controller
            control={control}
            name="password"
            rules={{ validate: (value) => validatePassword(value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="NEW PASSWORD"
                textContentType="newPassword"
                autoComplete="new-password"
                secureTextEntry={!showPassword}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="••••••••"
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
                    hitSlop={16}
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
                label="CONFIRM NEW PASSWORD"
                textContentType="newPassword"
                autoComplete="new-password"
                secureTextEntry={!showConfirmPassword}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="••••••••"
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
                    hitSlop={16}
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
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              {(passwordValue?.length ?? 0) >= 12 ? (
                <CheckCircle2 color={palette.orange} size={12} />
              ) : (
                <Circle color={palette.textMuted} size={12} />
              )}
              <AppText variant="bodySmall">
                {(passwordValue?.length ?? 0) >= 12 ? "✓ " : ""}At least 12 characters
              </AppText>
            </View>
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <View
                style={{
                  borderColor: palette.border,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  height: 10,
                  width: 10,
                }}
              />
              <AppText variant="bodySmall" tone="muted">
                {/[A-Z]/.test(passwordValue ?? "") &&
                /[a-z]/.test(passwordValue ?? "") &&
                /\d/.test(passwordValue ?? "") &&
                /[^A-Za-z0-9]/.test(passwordValue ?? "")
                  ? "✓ "
                  : ""}
                Include uppercase, lowercase, number, and special character
              </AppText>
            </View>
          </View>

          {resetError ? (
            <View style={{ gap: spacing[2] }}>
              <AppText accessibilityLiveRegion="polite" style={{ color: palette.error }}>
                {resetError}
              </AppText>
              <Button
                variant="ghost"
                label="Request a new reset email"
                disabled={busy}
                onPress={() => navigation.navigate("ForgotPassword")}
              />
            </View>
          ) : null}
          <Button
            label="Update Password"
            loading={busy}
            onPress={handleReset}
            style={{ minHeight: 56 }}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
