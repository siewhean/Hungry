import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { getMockLoginFailure } from "@/features/auth/mockAuth";
import { validateEmail, validatePassword } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

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

  const handleLogin = handleSubmit(async (values) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        await getHungryService().auth.signIn(values.email, values.password);
      } else {
        const failure = getMockLoginFailure(values.email, values.password);
        if (failure) {
          showToast({ message: failure.message, tone: "error" });
          return;
        }
      }
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
      showToast({ message: "Welcome back.", tone: "success" });
    } catch {
      showToast({ message: "Sign in failed. Please try again.", tone: "error" });
    }
  });

  const handleProviderLogin = async (provider: "google" | "apple") => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        if (provider === "google") {
          await getHungryService().auth.signInWithGoogle();
        } else {
          await getHungryService().auth.signInWithApple();
        }
      }
      completeAuth({ completedOnboarding: true, skippedTasteQuiz: true });
      showToast({ message: "Signed in successfully.", tone: "success" });
    } catch {
      showToast({ message: "Sign in failed. Please try again.", tone: "error" });
    }
  };

  return (
    <FeedErrorBoundary
      title="Sign in unavailable"
      body="Couldn't load sign in right now. Please retry."
    >
      <AuthScreenShell
        title="Welcome back"
        subtitle="Your digital maître d' awaits."
        footer={
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              marginTop: spacing[2],
            }}
          >
            <AppText tone="secondary">New to Hungry? </AppText>
            <Pressable onPress={() => navigation.navigate("SignUp")}>
              <AppText variant="bodyBold" tone="accent">
                Create account
              </AppText>
            </Pressable>
          </View>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View style={{ gap: spacing[2] }}>
            <Controller
              control={control}
              name="email"
              rules={{ validate: validateEmail }}
              render={({ field: { onChange, value } }) => (
                <Input
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Email Address"
                  value={value}
                  onChangeText={onChange}
                  leftIcon={<Mail color={palette.textMuted} size={18} />}
                  error={!!errors.email}
                  errorText={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{ validate: (value) => validatePassword(value, 8) }}
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[1] }}>
                  <Input
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={value}
                    onChangeText={onChange}
                    leftIcon={<Lock color={palette.textMuted} size={18} />}
                    rightIcon={
                      <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
                        {showPassword ? (
                          <EyeOff color={palette.textMuted} size={18} />
                        ) : (
                          <Eye color={palette.textMuted} size={18} />
                        )}
                      </Pressable>
                    }
                    error={!!errors.password}
                    errorText={errors.password?.message}
                  />
                  <View style={{ alignItems: "flex-end" }}>
                    <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
                      <AppText variant="micro" tone="accent">
                        Forget Password?
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>

          <Button
            label="Sign In"
            onPress={handleLogin}
            rightIcon={<ArrowRight size={18} color={palette.white} />}
          />

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[3],
              marginVertical: spacing[2],
            }}
          >
            <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
            <AppText variant="micro" tone="muted">
              OR CONTINUE WITH
            </AppText>
            <View style={{ backgroundColor: palette.border, flex: 1, height: 1 }} />
          </View>

          <View style={{ gap: spacing[3] }}>
            <Button
              label="Sign in with Google"
              variant="secondary"
              onPress={() => {
                void handleProviderLogin("google");
              }}
            />
            <Button
              label="Sign in with Apple"
              variant="secondary"
              onPress={() => {
                void handleProviderLogin("apple");
              }}
            />
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
