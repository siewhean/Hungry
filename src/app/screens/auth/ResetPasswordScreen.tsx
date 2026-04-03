import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm } from "react-hook-form";

import { AppText, Button, Input, InlineBanner } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

type FormValues = {
  password: string;
  confirmPassword: string;
};

export function ResetPasswordScreen({ navigation }: Props) {
  const showToast = useUIStore((state) => state.showToast);
  const { handleSubmit, register, setValue } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });

  register("password");
  register("confirmPassword");

  const handleReset = handleSubmit(() => {
    showToast({ message: "Password updated. Please log in again.", tone: "success" });
    navigation.navigate("Login");
  });

  return (
    <AuthScreenShell
      title="Set a new password"
      subtitle="Choose a strong password and return to the log-in screen."
      footer={<Button label="Back to log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <InlineBanner tone="warning" message="For the mock app, this screen preserves the full reset flow without backend wiring." />
      <Input label="New password" secureTextEntry placeholder="At least 8 characters" onChangeText={(value) => setValue("password", value)} />
      <Input label="Confirm password" secureTextEntry placeholder="Repeat the password" onChangeText={(value) => setValue("confirmPassword", value)} />
      <Button label="Update password" onPress={handleReset} />
      <AppText variant="bodySmall" tone="muted">
        A successful reset returns the user to log in.
      </AppText>
    </AuthScreenShell>
  );
}
