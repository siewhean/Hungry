import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "@/components/ui";
import { useAuthFlowStore } from "@/features/auth/useAuthFlowStore";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPasswordSuccess">;

export function ResetPasswordSuccessScreen({ navigation }: Props) {
  const completed = useAuthFlowStore((state) => state.passwordResetCompleted);
  return (
    <AuthScreenShell
      title={completed ? "Password updated" : "Password recovery"}
      subtitle={
        completed
          ? "Sign in with your new password."
          : "Request a reset email to change your password."
      }
    >
      <Button
        label={completed ? "Back to sign in" : "Request reset email"}
        onPress={() => navigation.navigate(completed ? "Login" : "ForgotPassword")}
      />
    </AuthScreenShell>
  );
}
