import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm, Controller } from "react-hook-form";
import { View } from "react-native";

import { AppText, Badge, Button, Input } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type FormValues = {
  email: string;
  password: string;
};

export function LoginScreen({ navigation }: Props) {
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
    // Mock auth: any non-empty email + password succeeds
    if (!values.email || !values.password) return;
    completeAuth();
    showToast({ message: "Welcome back. Your profile is ready.", tone: "success" });
  });

  return (
    <AuthScreenShell
      title="Log in"
      subtitle="Return to your favourites, reviews, and personalised picks."
      footer={
        <>
          <Button label="Forgot password?" variant="ghost" onPress={() => navigation.navigate("ForgotPassword")} />
          <Button label="Create account" variant="ghost" onPress={() => navigation.navigate("SignUp")} />
        </>
      }
    >
      <Controller
        control={control}
        name="email"
        rules={{
          required: "Email is required",
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
        }}
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
              <AppText variant="bodySmall" style={{ color: "#E53935" }}>
                {errors.email.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="password"
        rules={{ required: "Password is required", minLength: { value: 6, message: "Password must be at least 6 characters" } }}
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
              <AppText variant="bodySmall" style={{ color: "#E53935" }}>
                {errors.password.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Badge label="Remember me" tone="neutral" />
        <Badge label="Google sign-in shell" tone="info" />
      </View>
      <Button label="Log in" onPress={handleLogin} />
      <AppText variant="bodySmall" tone="muted">
        This build keeps the auth surface mock-first while preserving the final mobile flow.
      </AppText>
    </AuthScreenShell>
  );
}
