import { useEffect } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";

import { Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPasswordSuccess">;

/** Shown after the new password is saved. Continue releases the recovery hold. */
export function ResetPasswordSuccessScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );

  useEffect(() => () => setPasswordRecoveryInProgress(false), [setPasswordRecoveryInProgress]);

  const handleContinue = () => {
    setPasswordRecoveryInProgress(false);
    // A signed-in recovery session is routed onward by RootNavigator once the hold lifts.
    if (!isAuthenticated) {
      navigation.navigate("Login");
    }
  };

  return (
    <AuthScreenShell
      title="Password updated"
      subtitle={
        isAuthenticated
          ? "Your new password is saved and you're signed in."
          : "Your new password is saved. Sign in with it to continue."
      }
    >
      <View style={{ gap: spacing[4] }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: radii.pill,
            height: 96,
            justifyContent: "center",
            width: 96,
            alignSelf: "center",
          }}
        >
          <CheckCircle2 color={palette.orange} size={40} />
        </View>

        <Button label="Continue" onPress={handleContinue} style={{ minHeight: 56 }} />
      </View>
    </AuthScreenShell>
  );
}
