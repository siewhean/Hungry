import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Button, Card, Input } from "@/components/ui";
import {
  validateConfirmPassword,
  validatePassword,
  validateRequired,
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
  const navigation = useNavigation();
  const { spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [isSaving, setIsSaving] = useState(false);
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
      } else {
        showToast({ message: "Could not update your password. Please try again.", tone: "error" });
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
                secureTextEntry
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
                secureTextEntry
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
                secureTextEntry
                value={value}
                onChangeText={onChange}
                error={!!errors.confirmPassword}
                errorText={errors.confirmPassword?.message}
              />
            )}
          />
          <AppText variant="bodySmall" tone="muted">
            At least 12 characters, including uppercase, lowercase, a number and a special
            character.
          </AppText>
        </View>
      </Card>
      <Button label="Update password" loading={isSaving} onPress={handleChange} />
    </ProfileScreenShell>
  );
}
