import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import {
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

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { colorScheme, componentRadii, palette, spacing, radii } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const confirmPasswordRef = useRef<TextInput>(null);
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

  const handleReset = handleSubmit(async ({ password }) => {
    // Exchanging the recovery code signs the user in. Hold RootNavigator's
    // signed-in redirect until the new password is saved and confirmed on
    // ResetPasswordSuccess, which releases the hold.
    setPasswordRecoveryInProgress(true);
    try {
      if (getConfiguredDataSource() === "supabase") {
        await getHungryService().auth.resetPassword(route.params?.code ?? "", password);
      }
      navigation.navigate("ResetPasswordSuccess");
    } catch (error) {
      setPasswordRecoveryInProgress(false);
      trackAuthFailed("password_reset", "email", error);
      showToast({ message: "Password reset failed. Please try again.", tone: "error" });
    }
  });

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title=""
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
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
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
                label="CONFIRM NEW PASSWORD"
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                returnKeyType="go"
                onSubmitEditing={() => void handleReset()}
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
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <CheckCircle2 color={palette.orange} size={12} />
              <AppText variant="bodySmall">At least 12 characters</AppText>
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
                Include uppercase, lowercase, number, and special character
              </AppText>
            </View>
          </View>

          <Button
            label="Update Password"
            onPress={handleReset}
            loading={isSubmitting}
            style={{ minHeight: 56 }}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
