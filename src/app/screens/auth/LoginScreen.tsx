import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm } from "react-hook-form";
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
  const { handleSubmit, register, setValue } = useForm<FormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  register("email");
  register("password");

  const handleLogin = handleSubmit(() => {
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
      <Input
        autoCapitalize="none"
        keyboardType="email-address"
        label="Email"
        placeholder="weiming@example.com"
        onChangeText={(value) => setValue("email", value)}
      />
      <Input
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        onChangeText={(value) => setValue("password", value)}
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
