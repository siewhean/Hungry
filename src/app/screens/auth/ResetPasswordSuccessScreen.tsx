import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPasswordSuccess">;

/**
 * Shown after the new password is saved. Supabase recovery leaves the user
 * signed in, so "Continue" finishes sign-in and releases the recovery hold
 * (AppBody then mounts the signed-in app). Without a session (mock mode or an
 * expired recovery session) the user is sent to Login instead.
 */
export function ResetPasswordSuccessScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const [isContinuing, setIsContinuing] = useState(false);

  // Leaving this screen any other way also releases the recovery hold.
  useEffect(() => () => setPasswordRecoveryInProgress(false), [setPasswordRecoveryInProgress]);

  const goToLogin = () => {
    setPasswordRecoveryInProgress(false);
    navigation.navigate("Login");
  };

  const handleContinue = async () => {
    const session = useSessionStore.getState();
    if (getConfiguredDataSource() !== "supabase") {
      goToLogin();
      return;
    }
    setIsContinuing(true);
    try {
      const recoverySession = await getHungryService().auth.getCurrentSession();
      if (!recoverySession) {
        goToLogin();
        return;
      }
      const migration = await applySignedInProfile(recoverySession.profile, {
        profileReady: recoverySession.profileReady,
        onSyncWarning: () =>
          showToast({
            message: "Signed in, but your taste profile could not sync. Try updating it later.",
            tone: "warning",
          }),
      });
      if (migration.status === "failed") {
        goToLogin();
        return;
      }
      session.completeAuth({
        authProvider: "email",
        completedOnboarding: true,
        skippedTasteQuiz: true,
        trackSignInEvent: false,
      });
      setPasswordRecoveryInProgress(false);
    } catch (error) {
      reportError(error, { surface: "reset_password_success" });
      goToLogin();
    } finally {
      setIsContinuing(false);
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

        <Button
          label="Continue"
          onPress={() => {
            void handleContinue();
          }}
          loading={isContinuing}
          style={{ minHeight: 56 }}
        />

        <View style={{ backgroundColor: palette.infoSoft, borderRadius: 16, padding: spacing[3] }}>
          <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
            If you didn&apos;t make this change, reset your password again and contact Hungry
            support.
          </AppText>
        </View>
      </View>
    </AuthScreenShell>
  );
}
