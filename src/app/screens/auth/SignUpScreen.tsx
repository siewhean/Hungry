import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm } from "react-hook-form";
import { View } from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
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
  const continueAsGuest = useSessionStore((state) => state.continueAsGuest);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const { control, handleSubmit, register, setValue } = useForm<FormValues>({
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
    showToast({ message: "Signed in with Google. Please verify your email.", tone: "success" });
    navigation.navigate("EmailVerification");
  };

  const handleGuest = () => {
    continueAsGuest();
    completeOnboarding(true);
    showToast({ message: "Continuing as guest.", tone: "info" });
  };

  return (
    <AuthScreenShell
      title="Create account"
      subtitle="Save favourites, write reviews, and keep your taste profile in sync."
      footer={<Button label="Already have an account? Log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <Input label={authFieldLabels.signUp.displayName} placeholder="Wei Ming" onChangeText={(value) => setValue("displayName", value)} />
      <Input label={authFieldLabels.signUp.email} keyboardType="email-address" autoCapitalize="none" placeholder="weiming@example.com" onChangeText={(value) => setValue("email", value)} />
      <Input label={authFieldLabels.signUp.password} secureTextEntry placeholder="Minimum 8 characters" onChangeText={(value) => setValue("password", value)} />
      <Button label="Sign up" onPress={handleSignUp} />
      <Button label="Continue with Google" variant="secondary" onPress={handleGoogle} />
      <Button label="Continue as guest" variant="ghost" onPress={handleGuest} />
      <AppText variant="bodySmall" tone="muted">
        By continuing, you accept the Hungry terms and privacy policy.
      </AppText>
    </AuthScreenShell>
  );
}
