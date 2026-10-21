import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Eye, EyeOff } from "lucide-react-native";

import { AppText, Button, Card, Input } from "@/components/ui";
import { AUTH_EYE_BUTTON_STYLE } from "@/app/screens/auth/authEyeButton";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getAuthFailureMessage } from "@/features/auth/authErrors";
import {
  isWeakPasswordError,
  PASSWORD_REQUIREMENTS_COPY,
  PASSWORD_RULES,
  validateConfirmPassword,
  validatePassword,
  validateRequired,
  WEAK_PASSWORD_MESSAGE,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type FormValues = { currentPassword: string; newPassword: string; confirmPassword: string };

/**
 * Signed-in password change: re-authenticates with the current password, then
 * updates it. Unlike ResetPassword it never exchanges a recovery code.
 */
export function ChangePasswordScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPasswordValue = watch("newPassword");
  const visibilityToggle = (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={showPasswords ? "Hide passwords" : "Show passwords"}
      onPress={() => setShowPasswords((current) => !current)}
      hitSlop={8}
      style={AUTH_EYE_BUTTON_STYLE}
    >
      {showPasswords ? (
        <EyeOff color={palette.textMuted} size={18} />
      ) : (
        <Eye color={palette.textMuted} size={18} />
      )}
    </Pressable>
  );

  const handleChange = handleSubmit(async ({ currentPassword, newPassword }) => {
    if (currentPassword === newPassword) {
      setError("newPassword", { message: "Choose a password you have not used here." });
      return;
    }
    setIsSaving(true);
    try {
      await getHungryService().auth.changePassword(currentPassword, newPassword);
      showToast({ message: "Password updated.", tone: "success" });
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Current password is incorrect.") {
        setError("currentPassword", { message });
      } else if (isWeakPasswordError(error)) {
        setError("newPassword", { message: WEAK_PASSWORD_MESSAGE });
      } else {
        // A dropped connection or rate limit is not "wrong password"; say what happened.
        showToast({
          message: getAuthFailureMessage(
            error,
            "Could not update your password. Please try again.",
          ),
          tone: "error",
        });
      }
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <ProfileScreenShell title="Change password" testID="change-password-screen">
      <Card>
        <View style={{ gap: spacing[3] }}>
          <Controller
            control={control}
            name="currentPassword"
            rules={{ validate: (value) => validateRequired(value, "Current password") }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="Current password"
                secureTextEntry={!showPasswords}
                textContentType="password"
                autoComplete="current-password"
                rightIcon={visibilityToggle}
                value={value}
                onChangeText={onChange}
                error={!!errors.currentPassword}
                errorText={errors.currentPassword?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="newPassword"
            rules={{ validate: (value) => validatePassword(value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="New password"
                secureTextEntry={!showPasswords}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                rightIcon={visibilityToggle}
                value={value}
                onChangeText={onChange}
                error={!!errors.newPassword}
                errorText={errors.newPassword?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            rules={{
              validate: (value) => validateConfirmPassword(newPasswordValue ?? "", value),
            }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="Confirm new password"
                secureTextEntry={!showPasswords}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                rightIcon={visibilityToggle}
                value={value}
                onChangeText={onChange}
                error={!!errors.confirmPassword}
                errorText={errors.confirmPassword?.message}
              />
            )}
          />
          <AppText variant="bodySmall" tone="muted">
            {PASSWORD_REQUIREMENTS_COPY}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot current password?"
            accessibilityHint="Opens password reset"
            onPress={() => navigation.navigate("AuthStack", { screen: "ForgotPassword" })}
            hitSlop={8}
            style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 44 }}
          >
            <AppText variant="bodySmall" tone="accent">
              Forgot current password?
            </AppText>
          </Pressable>
        </View>
      </Card>
      <Button label="Update password" loading={isSaving} onPress={handleChange} />
    </ProfileScreenShell>
  );
}
