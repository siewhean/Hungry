import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, RotateCcw } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { validateConfirmPassword, validatePassword } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string; confirmPassword: string };

export function ResetPasswordScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  const passwordValue = watch("password");

  const handleReset = handleSubmit(async ({ password }) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        await getHungryService().auth.resetPassword("", password);
      }
      showToast({ message: "Password updated. Please check your inbox.", tone: "success" });
      navigation.navigate("ResetPasswordSuccess");
    } catch {
      showToast({ message: "Password reset failed. Please try again.", tone: "error" });
    }
  });

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title="Reset password"
        subtitle="Secure your account with a new password."
        footer={
          <Pressable
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
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.orangeLight,
              borderRadius: radii.pill,
              height: 60,
              justifyContent: "center",
              width: 60,
              alignSelf: "center",
            }}
          >
            <RotateCcw color={palette.orange} size={22} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>
            Reset Password
          </AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }}>
            Secure your account by creating a new strong password.
          </AppText>

          <Controller
            control={control}
            name="password"
            rules={{ validate: (value) => validatePassword(value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="NEW PASSWORD"
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                error={!!errors.password}
                errorText={errors.password?.message}
                rightIcon={
                  <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
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
                secureTextEntry={!showConfirmPassword}
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                error={!!errors.confirmPassword}
                errorText={errors.confirmPassword?.message}
                rightIcon={
                  <Pressable
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

          <Button label="Update Password" onPress={handleReset} style={{ minHeight: 56 }} />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
