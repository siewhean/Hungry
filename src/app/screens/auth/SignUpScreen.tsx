import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm } from "react-hook-form";

import { AppText, Button, Input } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { authFieldLabels } from "@/features/auth/authContent";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

type FormValues = {
  displayName: string;
  email: string;
  password: string;
};

export function SignUpScreen({ navigation }: Props) {
  const showToast = useUIStore((state) => state.showToast);
  const { handleSubmit, register, setValue } = useForm<FormValues>({
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  register("displayName");
  register("email");
  register("password");

  const handleSignUp = handleSubmit(() => {
    showToast({ message: "Account created. Please verify your email.", tone: "success" });
    navigation.navigate("EmailVerification");
  });

  const handleGoogle = () => {
    showToast({ message: "Google sign-up mocked. Verify the account to continue.", tone: "success" });
    navigation.navigate("EmailVerification");
  };

  const handleApple = () => {
    showToast({ message: "Apple sign-up mocked. Verify the account to continue.", tone: "success" });
    navigation.navigate("EmailVerification");
  };

  return (
    <AuthScreenShell
      title="Create account"
      subtitle="Create your Hungry account before you start browsing dishes, stalls, and editorial content."
      footer={<Button label="Already have an account? Log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <Button label="Continue with Google" variant="secondary" onPress={handleGoogle} />
      <Button label="Continue with Apple" variant="secondary" onPress={handleApple} />
      <AppText variant="micro" tone="muted">
        OR CREATE AN ACCOUNT WITH EMAIL
      </AppText>
      <Input label={authFieldLabels.signUp.displayName} placeholder="Wei Ming" onChangeText={(value) => setValue("displayName", value)} />
      <Input label={authFieldLabels.signUp.email} keyboardType="email-address" autoCapitalize="none" placeholder="weiming@example.com" onChangeText={(value) => setValue("email", value)} />
      <Input label={authFieldLabels.signUp.password} secureTextEntry placeholder="Minimum 8 characters" onChangeText={(value) => setValue("password", value)} />
      <Button label="Create account" onPress={handleSignUp} />
      <AppText variant="bodySmall" tone="muted">
        By continuing, you accept the Hungry terms and privacy policy.
      </AppText>
    </AuthScreenShell>
  );
}
