import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { CheckCircle2, CircleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";

import { AppText, Button, FeedErrorBoundary } from "@/components/ui";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailChange">;

/**
 * Landing for the link in a sign-in email change (hungry://auth/email-change). Unlike the
 * sign-up link it only refreshes the session and profile: no welcome, no onboarding, and no
 * sign-up event, because the person already has an account.
 */
export function EmailChangeScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const code = route.params?.code;
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const [status, setStatus] = useState<"checking" | "done" | "failed">(
    code ? "checking" : "failed",
  );

  useEffect(() => {
    trackAuthScreenViewed("email_change");
  }, []);

  // Exchanging the code refreshes the session. Hold RootNavigator's signed-in redirect
  // until the result has been read; Continue (or leaving) releases it.
  useEffect(() => {
    if (!code) return;
    let active = true;
    setPasswordRecoveryInProgress(true);
    getHungryService()
      .auth.confirmEmail(code)
      .then((session) => {
        if (!active) return;
        if (useProfileStore.getState().profile.id === session.profile.id) {
          useProfileStore.getState().applyProfile(session.profile);
        }
        setStatus("done");
      })
      .catch((error) => {
        if (!active) return;
        trackAuthFailed("email_confirm", "email", error);
        setStatus("failed");
      });
    return () => {
      active = false;
    };
  }, [code, setPasswordRecoveryInProgress]);

  useEffect(() => () => setPasswordRecoveryInProgress(false), [setPasswordRecoveryInProgress]);

  const handleContinue = () => {
    setPasswordRecoveryInProgress(false);
    // A signed-in user is routed onward by RootNavigator once the hold lifts.
    if (!isAuthenticated) navigation.navigate("Login");
  };

  const copy =
    status === "checking"
      ? { title: "Confirming your new email", body: "One moment…" }
      : status === "done"
        ? {
            title: "Email change confirmed",
            body: "If you haven't yet, also open the link we sent to your other address. Your new email takes effect once both are confirmed.",
          }
        : {
            title: "We couldn't confirm that here",
            body: "Open the link on the phone where you asked for the change, or request the change again from Edit profile.",
          };

  return (
    <FeedErrorBoundary
      title="Email change unavailable"
      body="Couldn't load this page right now. Please retry."
    >
      <AuthScreenShell title={copy.title}>
        <View style={{ gap: spacing[4] }}>
          <View
            style={{
              alignItems: "center",
              alignSelf: "center",
              backgroundColor: palette.orangeLight,
              borderRadius: radii.pill,
              height: 80,
              justifyContent: "center",
              width: 80,
            }}
          >
            {status === "failed" ? (
              <CircleAlert color={palette.orange} size={30} />
            ) : (
              <CheckCircle2 color={palette.orange} size={30} />
            )}
          </View>
          <AppText
            tone="secondary"
            accessibilityLiveRegion="polite"
            style={{ lineHeight: 24, textAlign: "center" }}
          >
            {copy.body}
          </AppText>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={status === "checking"}
            style={{ minHeight: 56 }}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
