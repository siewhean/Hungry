import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Eye, EyeOff } from "lucide-react-native";

import { AppText, Button, Card, Input } from "@/components/ui";
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
import { useProfileStore } from "@/store/useProfileStore";
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
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const email = useProfileStore((state) => state.profile.email);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  // Changing a password does not end sessions already signed in elsewhere.
  const offerSignOutOfOtherDevices = () => {
    Alert.alert(
      "Sign out other devices?",
      "Your old password no longer works, but phones already signed in to Hungry stay signed in. Sign them out now if someone else may have had access.",
      [
        { text: "Not now", style: "cancel", onPress: () => navigation.goBack() },
        {
          text: "Sign out other devices",
          onPress: () => {
            void getHungryService()
              .auth.signOut({ scope: "others" })
              .then(() => showToast({ message: "Other devices signed out.", tone: "success" }))
              .catch(() =>
                showToast({
                  message:
                    "Couldn't sign out other devices. Try Sign out of all devices in Settings.",
                  tone: "error",
                }),
              );
            navigation.goBack();
          },
        },
      ],
      { cancelable: false },
    );
  };

  const handleForgotCurrentPassword = () => {
    const address = email?.trim();
    if (!address) {
      showToast({ message: "We couldn't find your email address.", tone: "warning" });
      return;
    }
    void getHungryService()
      .auth.forgotPassword(address)
      .then(() => showToast({ message: `Reset instructions sent to ${address}.`, tone: "success" }))
      .catch(() =>
        showToast({ message: "Couldn't send the reset email. Please try again.", tone: "error" }),
      );
  };

  const revealToggle = (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={showPassword ? "Hide passwords" : "Show passwords"}
      accessibilityHint={
        showPassword ? "Hides the password characters" : "Shows the password characters"
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
      offerSignOutOfOtherDevices();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Current password is incorrect.") {
        setError("currentPassword", { message });
      } else if (isWeakPasswordError(error)) {
        setError("newPassword", { message: WEAK_PASSWORD_MESSAGE });
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
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="current-password"
                value={value}
                onChangeText={onChange}
                error={!!errors.currentPassword}
                errorText={errors.currentPassword?.message}
                rightIcon={revealToggle}
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
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
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
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
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
            accessibilityLabel="Forgot your current password?"
            accessibilityHint="Emails you a link to reset it"
            onPress={handleForgotCurrentPassword}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <AppText style={{ color: palette.orange, fontWeight: "600" }}>
              Forgot your current password?
            </AppText>
          </Pressable>
        </View>
      </Card>
      <Button label="Update password" loading={isSaving} onPress={handleChange} />
    </ProfileScreenShell>
  );
}
