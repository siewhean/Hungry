import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { AppText, Button, Input, InlineBanner } from "@/components/ui";
import { validateConfirmPassword, validatePassword } from "@/features/auth/validation";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

type FormValues = {
  password: string;
  confirmPassword: string;
};

export function ResetPasswordScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
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

  const handleReset = handleSubmit(() => {
    showToast({ message: "Password updated. Please log in again.", tone: "success" });
    navigation.navigate("ResetPasswordSuccess");
  });

  return (
    <AuthScreenShell
      title="Set a new password"
      subtitle="Choose a strong password and return to the log-in screen."
      footer={<Button label="Back to log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <InlineBanner tone="warning" message="For the mock app, this screen preserves the full reset flow without backend wiring." />
      <Controller
        control={control}
        name="password"
        rules={{ validate: (value) => validatePassword(value, 8) }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label="New password"
              secureTextEntry
              placeholder="At least 8 characters"
              value={value}
              onChangeText={onChange}
            />
            {errors.password ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {errors.password.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        rules={{ validate: (value) => validateConfirmPassword(passwordValue ?? "", value) }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label="Confirm password"
              secureTextEntry
              placeholder="Repeat the password"
              value={value}
              onChangeText={onChange}
            />
            {errors.confirmPassword ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {errors.confirmPassword.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Button label="Update password" onPress={handleReset} />
      <AppText variant="bodySmall" tone="muted">
        A successful reset opens a confirmation screen before sending the user back to log in.
      </AppText>
    </AuthScreenShell>
  );
}
