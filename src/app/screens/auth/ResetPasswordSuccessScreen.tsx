import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CheckCircle2 } from "lucide-react-native";
import { View } from "react-native";

import { AppText, Button, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPasswordSuccess">;

export function ResetPasswordSuccessScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();

  return (
    <AuthScreenShell
      title="Password updated"
      subtitle="Your account is ready to use again."
      footer={<Button label="Back to log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <Card>
        <View style={{ alignItems: "center", gap: spacing[3] }}>
          <CheckCircle2 color={palette.success} size={52} />
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            <AppText variant="h3">Reset complete</AppText>
            <AppText tone="secondary">
              The next step is signing in with your new password.
            </AppText>
          </View>
        </View>
      </Card>
      <Button label="Log in now" onPress={() => navigation.navigate("Login")} />
    </AuthScreenShell>
  );
}
