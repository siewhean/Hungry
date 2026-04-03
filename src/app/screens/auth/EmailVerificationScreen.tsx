import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, Card, InlineBanner } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation }: Props) {
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const showToast = useUIStore((state) => state.showToast);

  const handleVerify = () => {
    completeAuth();
    showToast({ message: "Email verified. Continue onboarding.", tone: "success" });
  };

  return (
    <AuthScreenShell
      title="Check your inbox"
      subtitle="Verify your email before moving on to the onboarding screens."
      footer={<Button label="Back to sign up" variant="ghost" onPress={() => navigation.navigate("SignUp")} />}
    >
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">Verification needed</AppText>
          <AppText tone="secondary">
            The mock app keeps this step explicit so the navigator can route to onboarding only after verification.
          </AppText>
          <InlineBanner tone="info" message="Tap verify to simulate the email link opening in mobile." />
        </View>
      </Card>
      <Button label="Verify email" onPress={handleVerify} />
      <Button label="Resend email" variant="secondary" onPress={() => showToast({ message: "Verification email resent.", tone: "info" })} />
    </AuthScreenShell>
  );
}

