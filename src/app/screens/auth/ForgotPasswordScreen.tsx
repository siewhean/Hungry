import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm } from "react-hook-form";

import { AppText, Button, Input, InlineBanner } from "@/components/ui";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";
import { useUIStore } from "@/store/useUIStore";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

type FormValues = {
  email: string;
};

export function ForgotPasswordScreen({ navigation }: Props) {
  const showToast = useUIStore((state) => state.showToast);
  const { handleSubmit, register, setValue } = useForm<FormValues>({
    defaultValues: { email: "" },
  });

  register("email");

  const handleSend = handleSubmit(() => {
    showToast({ message: "If the email exists, a reset link was sent.", tone: "info" });
    navigation.navigate("ResetPassword");
  });

  return (
    <AuthScreenShell
      title="Reset password"
      subtitle="We will send a link without revealing whether the address exists."
      footer={<Button label="Back to log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <Input label="Email" keyboardType="email-address" autoCapitalize="none" placeholder="weiming@example.com" onChangeText={(value) => setValue("email", value)} />
      <InlineBanner tone="info" message="Check your inbox after you submit. The link expires soon." />
      <Button label="Send reset link" onPress={handleSend} />
    </AuthScreenShell>
  );
}
