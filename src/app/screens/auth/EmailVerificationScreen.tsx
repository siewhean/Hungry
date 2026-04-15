import { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing } = useHungryTheme();
  const email = route.params?.email ?? "james.cook@chef.com";
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

  const handleResend = () => {
    if (resendSeconds > 0) {
      return;
    }
    showToast({
      message: `Verification code resent to ${email}.`,
      tone: "success",
    });
    setResendSeconds(54);
  };

  const minuteText = Math.floor(resendSeconds / 60);
  const secondText = String(resendSeconds % 60).padStart(2, "0");

  return (
    <AuthScreenShell
      title="Verify your email"
      subtitle="Enter the verification code we sent to continue onboarding."
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
          <ArrowLeft color={palette.orange} size={14} />
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
        <AppText
          tone="secondary"
          style={{ lineHeight: 24, textAlign: "center" }}
        >
          We sent a 6-digit verification code to{" "}
          <AppText style={{ fontWeight: "700" }}>{email}</AppText>.
        </AppText>

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          {["4", "9", "2", "•", "•", "•"].map((digit, index) => (
            <View
              key={`${digit}-${index}`}
              style={{
                backgroundColor: palette.surfaceRaised,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                flex: 1,
                height: 50,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText variant="h2" tone={digit === "•" ? "muted" : "default"}>
                {digit}
              </AppText>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: resendSeconds > 0 }}
          disabled={resendSeconds > 0}
          onPress={handleResend}
          style={{ opacity: resendSeconds > 0 ? 0.8 : 1 }}
        >
          <AppText
            style={{ color: palette.textSecondary, textAlign: "center" }}
          >
            Didn't receive the code?{" "}
            <AppText style={{ color: palette.orange, fontWeight: "700" }}>
              {resendSeconds > 0
                ? `Resend in ${minuteText}:${secondText}`
                : "Resend now"}
            </AppText>
          </AppText>
        </Pressable>

        <View style={{ gap: spacing[3] }}>
          <Button
            label="Verify Account"
            onPress={() => {
              completeAuth();
              showToast({
                message: "Email verified. Continue onboarding.",
                tone: "success",
              });
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
            borderRadius: radii.lg,
            flexDirection: "row",
            gap: spacing[3],
            padding: spacing[3],
          }}
        >
          <CircleAlert color={palette.orange} size={18} />
          <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
            Hungry uses encrypted verification to ensure your culinary journey
            is safe.
          </AppText>
        </View>
      </View>
    </AuthScreenShell>
  );
}
