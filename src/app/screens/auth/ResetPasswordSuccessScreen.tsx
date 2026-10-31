import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, InlineBanner, AppSymbol } from "@/components/ui";
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
export function ResetPasswordSuccessScreen({ navigation, route }: Props) {
  const otherDevicesSignedOut = route.params?.otherDevicesSignedOut === true;
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const [isContinuing, setIsContinuing] = useState(false);
  // Finishing sign-in failed while the recovery session is still signed in. Leaving now
  // would release the hold and drop the user on Home with no word, so stay and offer a retry.
  const [finishFailed, setFinishFailed] = useState(false);

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
    setFinishFailed(false);
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
        setFinishFailed(true);
        return;
      }
      // Only an existing account resets its password, so onboarding is done; its taste-quiz
      // choice is the account's own and is left as it is.
      session.completeAuth({
        authProvider: "email",
        completedOnboarding: true,
        trackSignInEvent: false,
      });
      setPasswordRecoveryInProgress(false);
    } catch (error) {
      reportError(error, { surface: "reset_password_success" });
      if (useSessionStore.getState().isAuthenticated) setFinishFailed(true);
      else goToLogin();
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <AuthScreenShell
      title="Password updated"
      compact
      subtitle={
        isAuthenticated
          ? otherDevicesSignedOut
            ? "Your new password is saved and you're signed in. We signed you out on your other devices."
            : "Your new password is saved and you're signed in."
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
          <AppSymbol name="done" color={palette.orange} size={40} />
        </View>

        {finishFailed ? (
          <InlineBanner
            message="Your new password is saved, but we couldn't finish signing you in. Try again."
            tone="error"
          />
        ) : null}

        <Button
          label={finishFailed ? "Try again" : "Continue"}
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
