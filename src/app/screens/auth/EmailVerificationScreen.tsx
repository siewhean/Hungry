import {
  VERIFICATION_CODE_LENGTH,
  isVerificationCode,
  remainingCooldownSeconds,
} from "@/features/auth/verificationCode";
import { useAuthOperation } from "@/features/auth/useAuthOperation";
import { useOnboardingDraftStore } from "@/features/onboarding/useOnboardingDraftStore";
import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, TextInput, View } from "react-native";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import {
  applySignedInProfile,
  captureGuestProfileSnapshot,
} from "@/features/auth/applySignedInProfile";
import { clearShareAttribution, getShareAttribution } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

// Matches config.toml [auth.email] max_frequency = "60s"
const RESEND_COOLDOWN_SECONDS = 60;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const { busy, run } = useAuthOperation();
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getServiceProvider().mode === "supabase";
  const email = route.params?.email ?? "";
  const shouldCompleteOnboarding = route.params?.completedOnboarding ?? false;
  const resendAvailableAt = useRef(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<TextInput>(null);

  // Redirect to SignUp if no email was passed (defensive guard against H1 edge case)
  useEffect(() => {
    if (!email) {
      navigation.replace("SignUp");
    }
  }, [email, navigation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendSeconds(remainingCooldownSeconds(resendAvailableAt.current));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResend = async () =>
    run(async () => {
      if (resendSeconds > 0) return;
      try {
        await getHungryService().auth.resendVerificationEmail(email);
        resendAvailableAt.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        showToast({ message: `Verification email resent to ${email}.`, tone: "success" });
        setResendSeconds(RESEND_COOLDOWN_SECONDS);
        setOtp("");
      } catch {
        showToast({
          message: "Could not resend verification email. Please try again shortly.",
          tone: "error",
        });
      }
    });

  const handleVerify = async () =>
    run(async () => {
      const guestSnapshot = captureGuestProfileSnapshot();
      const trimmed = otp.trim();
      if (!isVerificationCode(trimmed)) {
        showToast({ message: "Enter the full code from your email.", tone: "warning" });
        return;
      }
      try {
        let session = null;
        if (isSupabaseMode) {
          // verifyOtp works regardless of whether enable_confirmations is true,
          // because it does not require a pre-existing session (unlike refreshSession).
          session = await getHungryService().auth.verifyEmailOtp(email, trimmed);
          if (
            !(await applySignedInProfile(session.profile, {
              profileReady: session.profileReady,
              guestSnapshot,
              onSyncWarning: () => {
                showToast({
                  message:
                    "Email verified, but your taste profile could not sync. Try updating it again later.",
                  tone: "warning",
                });
              },
            }))
          )
            return;
        }
        const shareAttribution = getShareAttribution();
        trackAnalyticsEvent("sign_up_completed", {
          method: "email",
          ...(shareAttribution
            ? { share_source: shareAttribution.source, share_route: shareAttribution.route }
            : {}),
        });
        if (shareAttribution) clearShareAttribution();
        completeAuth({
          authProvider: "email",
          completedOnboarding: shouldCompleteOnboarding,
          trackSignInEvent: false,
        });
        if (session)
          useOnboardingDraftStore
            .getState()
            .setAccountScope(session.profile.id, { adoptGuest: true });
        if (route.params?.resumeOnboarding) {
          navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
            index: 0,
            routes: [{ name: "OnboardingStack", params: { screen: "LocationPermission" } }],
          });
        }
        if (shouldCompleteOnboarding) {
          completeOnboarding();
        }
        showToast({
          message: shouldCompleteOnboarding
            ? "Email verified. Welcome to Hungry."
            : "Email verified. Continue onboarding.",
          tone: "success",
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.message.toLowerCase().includes("invalid")
            ? "That code is incorrect or has expired. Try resending."
            : "Could not verify. Please try again.";
        showToast({ message, tone: "error" });
      }
    });

  const minuteText = Math.floor(resendSeconds / 60);
  const secondText = String(resendSeconds % 60).padStart(2, "0");

  return (
    <FeedErrorBoundary
      title="Verification unavailable"
      body="Couldn't load email verification right now. Please retry."
    >
      <AuthScreenShell
        title="Check your email"
        subtitle={`Enter the 8-digit code for ${email || "your email address"}. You can request a new code below.`}
        footer={
          <Pressable
            accessibilityRole="button"
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
            We sent a verification code to{" "}
            <AppText style={{ fontWeight: "700" }}>{email || "your email"}</AppText>.
          </AppText>

          {/* OTP input */}
          <Input
            ref={otpInputRef}
            label="Verification code"
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ""))}
            placeholder="12345678"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={VERIFICATION_CODE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              resendSeconds > 0
                ? `Resend verification email available in ${minuteText}:${secondText}`
                : "Resend verification email"
            }
            accessibilityHint="Requests a new verification email"
            accessibilityState={{ disabled: resendSeconds > 0 || busy, busy }}
            disabled={resendSeconds > 0 || busy}
            onPress={() => void handleResend()}
            style={{
              minHeight: 44,
              justifyContent: "center",
              opacity: resendSeconds > 0 ? 0.8 : 1,
            }}
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
              label="Verify Email"
              loading={busy}
              onPress={handleVerify}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
            />
            <Button
              label="Change Email Address"
              variant="secondary"
              disabled={busy}
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
              Enter the 8-digit code from your email. The code expires after 60 minutes.
            </AppText>
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
