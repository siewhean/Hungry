import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, HungryLogo, Input } from "@/components/ui";
import { validateEmail, validatePassword } from "@/features/auth/validation";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type FormValues = {
  email: string;
  password: string;
};

export function LoginScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
  });

  const handleLogin = handleSubmit((values) => {
    if (!values.email || !values.password) return;
    completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
    showToast({ message: "Welcome back.", tone: "success" });
  });

  const handleProviderLogin = () => {
    completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
    showToast({ message: "Signed in successfully.", tone: "success" });
  };

  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing[5] }}>
        <View style={{ alignItems: "center", marginBottom: spacing[6] }}>
          <HungryLogo size={64} showWordmark wordmarkColor="#A93100" />
          <AppText tone="secondary">Your digital maître d' awaitu.</AppText>
        </View>

        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, gap: spacing[4], padding: spacing[5] }}>
          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: 4 }}>
                  <Input
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email Address"
                    value={value}
                    onChangeText={onChange}
                    leftIcon={<Mail color="#B79D8F" size={16} />}
                  />
                  {errors.email ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.email.message}</AppText> : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{ validate: (value) => validatePassword(value, 8) }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: 2 }}>
                  <Input
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={value}
                    onChangeText={onChange}
                    leftIcon={<Lock color="#B79D8F" size={15} />}
                    rightIcon={(
                      <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
                        {showPassword ? <EyeOff color="#B79D8F" size={15} /> : <Eye color="#B79D8F" size={15} />}
                      </Pressable>
                    )}
                  />
                  {errors.password ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.password.message}</AppText> : null}
                  <View style={{ alignItems: "flex-end" }}>
                    <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
                      <AppText variant="micro" tone="accent">Forget Password</AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>

          <Button label="Sign In" onPress={handleLogin} style={{ borderRadius: 16 }} />

          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
            <View style={{ backgroundColor: "#E9E1D9", flex: 1, height: 1 }} />
            <AppText variant="micro" tone="muted">OR CONTINUE WITH</AppText>
            <View style={{ backgroundColor: "#E9E1D9", flex: 1, height: 1 }} />
          </View>

          <Button label="Sign in with Google" variant="secondary" onPress={handleProviderLogin} style={{ borderRadius: 16 }} />
          <Button label="Sign in with Apple" variant="secondary" onPress={handleProviderLogin} style={{ borderRadius: 16 }} />
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: spacing[5] }}>
          <AppText tone="secondary">New to Hungry? </AppText>
          <Pressable onPress={() => navigation.navigate("SignUp")}>
            <AppText tone="accent" style={{ fontFamily: "Nunito_700Bold" }}>Create account</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
