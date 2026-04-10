import { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const showToast = useUIStore((state) => state.showToast);
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
    showToast({ message: `Verification code resent to ${email}.`, tone: "success" });
    setResendSeconds(54);
  };

  const minuteText = Math.floor(resendSeconds / 60);
  const secondText = String(resendSeconds % 60).padStart(2, "0");

  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ backgroundColor: "#EFE7DE", borderRadius: 20, height: 40, width: 40, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft color="#1E1B16" size={18} />
        </Pressable>
        <AppText variant="h1">Hungry</AppText>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <View style={{ backgroundColor: "#D1430B", borderRadius: 20, width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
          <MailCheck color="#FFFFFF" size={30} />
        </View>
        <AppText variant="display" style={{ marginTop: 12 }}>Verify Your Email</AppText>
        <AppText tone="secondary" style={{ marginTop: 8, lineHeight: 26 }}>
          We've sent a 6-digit verification code to <AppText style={{ fontFamily: "Nunito_700Bold" }}>{email}</AppText>. Please enter it below to confirm your account.
        </AppText>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 28 }}>
          {["4", "9", "2", "•", "•", "•"].map((digit, index) => (
            <View key={`${digit}-${index}`} style={{ backgroundColor: "#F4EDE4", borderRadius: 24, flex: 1, height: 50, alignItems: "center", justifyContent: "center" }}>
              <AppText variant="h2" style={{ color: digit === "•" ? "#6B7280" : "#1E1B16" }}>{digit}</AppText>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: resendSeconds > 0 }}
          disabled={resendSeconds > 0}
          onPress={handleResend}
          style={{ marginTop: 20, opacity: resendSeconds > 0 ? 0.8 : 1 }}
        >
          <AppText style={{ color: "#835500", textAlign: "center" }}>
            Didn't receive the code?{" "}
            <AppText style={{ color: "#A93100", fontFamily: "Nunito_700Bold" }}>
              {resendSeconds > 0 ? `Resend in ${minuteText}:${secondText}` : "Resend now"}
            </AppText>
          </AppText>
        </Pressable>

        <View style={{ gap: 16, marginTop: 28 }}>
          <Button label="Verify Account" onPress={() => { completeAuth(); showToast({ message: "Email verified. Continue onboarding.", tone: "success" }); }} style={{ borderRadius: 24, minHeight: 56 }} />
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
            style={{ borderRadius: 24, minHeight: 56 }}
          />
        </View>

        <View style={{ backgroundColor: "rgba(250,242,233,0.5)", borderRadius: 16, flexDirection: "row", gap: 12, marginTop: 28, padding: 16 }}>
          <CircleAlert color="#A93100" size={18} />
          <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
            Hungry uses encrypted verification to ensure your culinary journey is safe.
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}
