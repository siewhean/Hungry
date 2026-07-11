import { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary } from "@/components/ui";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  const email = route.params?.email ?? "james.cook@chef.com";
  const shouldCompleteOnboarding = route.params?.completedOnboarding ?? false;
  const [resendSeconds, setResendSeconds] = useState(54);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleResend = async () => {
    if (resendSeconds > 0) {
      return;
    }
    try {
      if (isSupabaseMode) {
        await getHungryService().auth.resendVerificationEmail(email);
      } else {
        showToast({
          message: "Verification email resend is currently unavailable. Please try again shortly.",
          tone: "warning",
        });
        setResendSeconds(54);
        return;
      }
      showToast({
        message: `Verification email resent to ${email}.`,
        tone: "success",
      });
      setResendSeconds(54);
    } catch {
      showToast({
        message: "Could not resend verification email. Please try again shortly.",
        tone: "error",
      });
    }
  };

  const minuteText = Math.floor(resendSeconds / 60);
  const secondText = String(resendSeconds % 60).padStart(2, "0");

  return (
    <FeedErrorBoundary
      title="Verification unavailable"
      body="Couldn't load email verification right now. Please retry."
    >
      <AuthScreenShell
        title="Verify your email"
        subtitle="Open the verification link in your inbox, then continue onboarding."
        footer={
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={14} />
            <AppText tone="accent" style={{ fontWeight: "700" }}>
              Back to sign up
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.orangeLight,
              borderRadius: radii.pill,
              width: 64,
              height: 64,
              justifyContent: "center",
              alignSelf: "center",
            }}
          >
            <MailCheck color={palette.orange} size={30} />
          </View>
          <AppText tone="secondary" style={{ lineHeight: 24, textAlign: "center" }}>
            We sent a verification email to <AppText style={{ fontWeight: "700" }}>{email}</AppText>
            .
          </AppText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              resendSeconds > 0
                ? `Resend verification email available in ${minuteText}:${secondText}`
                : "Resend verification email"
            }
            accessibilityHint="Requests a new verification email"
            accessibilityState={{ disabled: resendSeconds > 0 }}
            disabled={resendSeconds > 0}
            onPress={() => {
              void handleResend();
            }}
            style={{ opacity: resendSeconds > 0 ? 0.8 : 1 }}
          >
            <AppText style={{ color: palette.textSecondary, textAlign: "center" }}>
              Didn&apos;t receive the email?{" "}
              <AppText style={{ color: palette.orange, fontWeight: "700" }}>
                {resendSeconds > 0 ? `Resend in ${minuteText}:${secondText}` : "Resend now"}
              </AppText>
            </AppText>
          </Pressable>

          <View style={{ gap: spacing[3] }}>
            <Button
              label="I Verified My Email"
              onPress={async () => {
                try {
                  if (isSupabaseMode) {
                    const session = await getHungryService().auth.refreshSession();
                    if (!session) {
                      showToast({
                        message: "We still can’t confirm verification yet. Check your inbox link.",
                        tone: "warning",
                      });
                      return;
                    }
                    await applySignedInProfile(session.profile, {
                      onSyncWarning: () => {
                        showToast({
                          message:
                            "Email verified, but your taste profile could not sync. Try updating it again later.",
                          tone: "warning",
                        });
                      },
                    });
                  }
                  trackAnalyticsEvent("sign_up_completed", {
                    method: "email",
                  });
                  completeAuth({
                    authProvider: "email",
                    completedOnboarding: shouldCompleteOnboarding,
                    trackSignInEvent: false,
                  });
                  if (shouldCompleteOnboarding) {
                    completeOnboarding();
                  }
                  showToast({
                    message: shouldCompleteOnboarding
                      ? "Email verified. Welcome to Hungry."
                      : "Email verified. Continue onboarding.",
                    tone: "success",
                  });
                } catch {
                  showToast({
                    message: "Could not confirm verification yet. Please try again.",
                    tone: "warning",
                  });
                }
              }}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
            />
            <Button
              label="Change Email Address"
              variant="secondary"
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }
                navigation.navigate("SignUp");
              }}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
            />
          </View>

          <View
            style={{
              backgroundColor: palette.infoSoft,
              borderRadius: componentRadii.card,
              flexDirection: "row",
              gap: spacing[3],
              padding: spacing[3],
            }}
          >
            <CircleAlert color={palette.orange} size={18} />
            <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
              Hungry checks this email before saving protected account actions.
            </AppText>
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
