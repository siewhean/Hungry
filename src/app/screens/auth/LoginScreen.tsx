import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import { validateEmail, validatePassword } from "@/features/auth/validation";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type FormValues = {
  email: string;
  password: string;
};

export function LoginScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
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
    completeAuth();
    showToast({ message: "Welcome back. Continue setup to unlock your feed.", tone: "success" });
  });

  const handleProviderLogin = (provider: "Google" | "Apple") => {
    completeAuth();
    showToast({ message: `${provider} connected. Finish setup to continue.`, tone: "success" });
  };

  return (
    <AuthScreenShell
      title="Welcome to Hungry"
      subtitle="Sign in before you browse dishes, save favourites, or write reviews."
      footer={
        <>
          <Button label="Forgot password?" variant="ghost" onPress={() => navigation.navigate("ForgotPassword")} />
          <Button label="Create account" variant="ghost" onPress={() => navigation.navigate("SignUp")} />
        </>
      }
    >
      <Button label="Continue with Google" variant="secondary" onPress={() => handleProviderLogin("Google")} />
      <Button label="Continue with Apple" variant="secondary" onPress={() => handleProviderLogin("Apple")} />
      <View style={{ gap: 8 }}>
        <AppText variant="micro" tone="muted">
          OR CONTINUE WITH EMAIL
        </AppText>
      </View>
      <Controller
        control={control}
        name="email"
        rules={{ validate: validateEmail }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              placeholder="weiming@example.com"
              value={value}
              onChangeText={onChange}
            />
            {errors.email ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {errors.email.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="password"
        rules={{ validate: (value) => validatePassword(value, 8) }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry
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
      <Button label="Continue with Email" onPress={handleLogin} />
      <AppText variant="bodySmall" tone="muted">
        Google and Apple remain mock auth actions in this build, but the app flow matches the final product shell.
      </AppText>
    </AuthScreenShell>
  );
}
