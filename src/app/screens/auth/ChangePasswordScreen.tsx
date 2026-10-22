import { changePasswordValidation } from "@/features/auth/changePasswordValidation";
import { useAuthOperation } from "@/features/auth/useAuthOperation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { validateConfirmPassword } from "@/features/auth/validation";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ChangePassword">;
type FormValues = { currentPassword: string; newPassword: string; confirmPassword: string };

export function ChangePasswordScreen({ navigation }: Props) {
  const { busy, run } = useAuthOperation();
  const { palette, spacing } = useHungryTheme();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPasswordValue = watch("newPassword");

  const handleSave = handleSubmit(async ({ currentPassword, newPassword }) =>
    run(async () => {
      try {
        if (getServiceProvider().mode === "supabase") {
          await getHungryService().auth.changePassword(currentPassword, newPassword);
        }
        showToast({ message: "Password updated successfully.", tone: "success" });
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      } catch (err: unknown) {
        const isWrongPassword =
          err instanceof Error && err.message.toLowerCase().includes("current password");
        showToast({
          message: isWrongPassword
            ? "Current password is incorrect. Please try again."
            : "Password change failed. Please try again.",
          tone: "error",
        });
      }
    }),
  );

  return (
    <FeedErrorBoundary
      title="Password change unavailable"
      body="Couldn't load password change right now. Please retry."
    >
      <AuthScreenShell
        title="Change password"
        subtitle="Enter your current password, then choose a new one."
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : undefined)}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={12} />
            <AppText tone="secondary" style={{ fontWeight: "600" }}>
              Back
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <Controller
            control={control}
            name="currentPassword"
            rules={changePasswordValidation.currentPassword}
            render={({ field: { onChange, value } }) => (
              <Input
                label="Current password"
                secureTextEntry={!showCurrent}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="next"
                error={!!errors.currentPassword}
                errorText={errors.currentPassword?.message}
                rightIcon={
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={showCurrent ? "Hide password" : "Show password"}
                    onPress={() => setShowCurrent((v) => !v)}
                    hitSlop={16}
                  >
                    {showCurrent ? (
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
            name="newPassword"
            rules={changePasswordValidation.newPassword}
            render={({ field: { onChange, value } }) => (
              <Input
                label="New password"
                secureTextEntry={!showNew}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                error={!!errors.newPassword}
                errorText={errors.newPassword?.message}
                rightIcon={
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={showNew ? "Hide new password" : "Show new password"}
                    onPress={() => setShowNew((v) => !v)}
                    hitSlop={16}
                  >
                    {showNew ? (
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
            rules={{ validate: (v) => validateConfirmPassword(newPasswordValue ?? "", v) }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="Confirm new password"
                secureTextEntry={!showConfirm}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                error={!!errors.confirmPassword}
                errorText={errors.confirmPassword?.message}
                rightIcon={
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirm ? "Hide confirmation password" : "Show confirmation password"
                    }
                    onPress={() => setShowConfirm((v) => !v)}
                    hitSlop={16}
                  >
                    {showConfirm ? (
                      <EyeOff color={palette.textMuted} size={15} />
                    ) : (
                      <Eye color={palette.textMuted} size={15} />
                    )}
                  </Pressable>
                }
              />
            )}
          />

          <Button
            label="Update Password"
            loading={busy}
            onPress={handleSave}
            style={{ minHeight: 56 }}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
