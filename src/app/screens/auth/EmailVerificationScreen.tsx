import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary } from "@/components/ui";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import {
  rememberPendingEmailVerification,
  takePendingEmailVerificationCompletesOnboarding,
} from "@/features/auth/pendingEmailVerification";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

const RESEND_COOLDOWN_SECONDS = 60;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  const email = route.params?.email;
  const confirmationCode = route.params?.code;
  // Supabase redirects with ?error= when the link expired or was already used.
  const confirmationError = route.params?.error;
  const completedOnboarding = route.params?.completedOnboarding ?? false;
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const exchangedCode = useRef<string | null>(null);

  useEffect(() => {
    trackAuthScreenViewed("email_verification");
  }, []);

  // The confirmation link reopens this screen with only `?code=` (often after a
  // cold start), so each sign-up that opens it records whether it had already
  // finished onboarding. A plain SignUp passes no flag and resets it to false.
  useEffect(() => {
    if (email) rememberPendingEmailVerification(completedOnboarding);
  }, [completedOnboarding, email]);

  useEffect(() => {
    if (!confirmationError) return;
    showToast({
      message:
        confirmationError === "expired"
          ? "That verification link has expired. Resend a new one or sign in."
          : "That verification link is invalid. Resend a new one or sign in.",
      tone: "error",
    });
  }, [confirmationError, showToast]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  // Exchanges the confirmation code (or, in mock mode, simulates the link) and
  // signs the new account in. RootNavigator then routes to onboarding or Home.
  const confirm = useCallback(
    async (code: string) => {
      setIsConfirming(true);
      try {
        const session = await getHungryService().auth.confirmEmail(code);
        const shouldCompleteOnboarding = await takePendingEmailVerificationCompletesOnboarding();
        const migration = await applySignedInProfile(session.profile, {
          profileReady: session.profileReady,
          onSyncWarning: () => {
            showToast({
              message:
                "Email verified, but your taste profile could not sync. Try updating it again later.",
              tone: "warning",
            });
            if (migration.status === "failed") return;
          },
        });
        completeAuth({
          authProvider: "email",
          completedOnboarding: shouldCompleteOnboarding,
          isNewUser: true,
        });
        if (shouldCompleteOnboarding) {
          completeOnboarding();
        }
        showToast({ message: "Email verified. Welcome to Hungry.", tone: "success" });
      } catch (error) {
        trackAuthFailed("email_confirm", "email", error);
        showToast({
          message:
            "We couldn't finish verifying on this device. If you opened the link, sign in to continue.",
          tone: "warning",
        });
        navigation.navigate("Login");
      } finally {
        setIsConfirming(false);
      }
    },
    [completeAuth, completeOnboarding, navigation, showToast],
  );

  useEffect(() => {
    if (!confirmationCode || exchangedCode.current === confirmationCode) return;
    exchangedCode.current = confirmationCode;
    void confirm(confirmationCode);
  }, [confirm, confirmationCode]);

  const handleResend = async () => {
    if (resendSeconds > 0 || isResending || !email) {
      return;
    }
    setIsResending(true);
    try {
      await getHungryService().auth.resendVerificationEmail(email);
      showToast({
        message: `Verification email resent to ${email}.`,
        tone: "success",
      });
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch {
      showToast({
        message: "Could not resend verification email. Please try again shortly.",
        tone: "error",
      });
    } finally {
      setIsResending(false);
    }
  };

  // A confirmation opened on another device or browser cannot be detected here,
  // so the honest next step is to sign in. Mock mode simulates tapping the link.
  const handleConfirmed = () => {
    if (!isSupabaseMode) {
      void confirm("mock-confirmation");
      return;
    }
    showToast({
      message: "Once you've tapped the link in the email, sign in to continue.",
      tone: "info",
    });
    navigation.navigate("Login");
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
        subtitle="Tap the link in the email we sent you on this phone to finish signing up."
        footer={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign up"
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
            {isConfirming ? (
              "Confirming your email…"
            ) : email ? (
              <>
                We sent a verification email to{" "}
                <AppText style={{ fontWeight: "700" }}>{email}</AppText>.
              </>
            ) : (
              "Check your inbox for the verification email."
            )}
          </AppText>

          {email ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                resendSeconds > 0
                  ? `Resend verification email available in ${minuteText}:${secondText}`
                  : "Resend verification email"
              }
              accessibilityHint="Requests a new verification email"
              accessibilityState={{ disabled: resendSeconds > 0 || isResending }}
              disabled={resendSeconds > 0 || isResending}
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
          ) : null}

          <View style={{ gap: spacing[3] }}>
            <Button
              label="I've confirmed my email"
              onPress={handleConfirmed}
              loading={isConfirming}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
            />
            <Button
              label="Change Email Address"
              variant="secondary"
              disabled={isConfirming}
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
              Opened the link on a computer? Your email is still confirmed. Just sign in here.
            </AppText>
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
