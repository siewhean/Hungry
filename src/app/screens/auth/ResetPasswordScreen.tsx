import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, RotateCcw } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, Input } from "@/components/ui";
import { validateConfirmPassword, validatePassword } from "@/features/auth/validation";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string; confirmPassword: string };

export function ResetPasswordScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  const passwordValue = watch("password");

  const handleReset = handleSubmit(() => {
    showToast({ message: "Password updated. Please check your inbox.", tone: "success" });
    navigation.navigate("ResetPasswordSuccess");
  });

  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Pressable onPress={() => navigation.goBack()}><ArrowLeft color="#1E1B16" size={18} /></Pressable>
          <AppText variant="h1">Hungry</AppText>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing[5], paddingVertical: spacing[5] }}>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, gap: spacing[4], padding: 28 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(209,67,11,0.1)", borderRadius: 30, height: 60, justifyContent: "center", width: 60 }}>
            <RotateCcw color="#A93100" size={22} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>Reset Password</AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }}>Secure your account by creating a new strong password.</AppText>

          <Controller
            control={control}
            name="password"
            rules={{ validate: (value) => validatePassword(value, 8) }}
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 4 }}>
                <Input
                  label="NEW PASSWORD"
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  rightIcon={(
                    <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
                      {showPassword ? <EyeOff color="#B79D8F" size={15} /> : <Eye color="#B79D8F" size={15} />}
                    </Pressable>
                  )}
                />
                {errors.password ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.password.message}</AppText> : null}
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
                  label="CONFIRM NEW PASSWORD"
                  secureTextEntry={!showConfirmPassword}
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  rightIcon={(
                    <Pressable onPress={() => setShowConfirmPassword((current) => !current)} hitSlop={8}>
                      {showConfirmPassword ? <EyeOff color="#B79D8F" size={15} /> : <Eye color="#B79D8F" size={15} />}
                    </Pressable>
                  )}
                />
                {errors.confirmPassword ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.confirmPassword.message}</AppText> : null}
              </View>
            )}
          />

          <View style={{ backgroundColor: "#FAF2E9", borderRadius: 16, gap: 8, padding: 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <CheckCircle2 color="#A93100" size={12} />
              <AppText variant="bodySmall">At least 8 characters</AppText>
            </View>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <View style={{ borderColor: "#A8A29E", borderRadius: 999, borderWidth: 1, height: 10, width: 10 }} />
              <AppText variant="bodySmall" tone="muted">Include a number or special character</AppText>
            </View>
          </View>

          <Button label="Update Password" onPress={handleReset} style={{ borderRadius: 24, minHeight: 56 }} />
          <Pressable onPress={() => navigation.navigate("Login")} style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" }}>
            <ArrowLeft color="#5A4139" size={12} />
            <AppText tone="secondary" style={{ fontFamily: "Nunito_600SemiBold" }}>Back to Sign In</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
