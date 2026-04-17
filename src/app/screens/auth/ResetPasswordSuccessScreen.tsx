import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { MailCheck } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPasswordSuccess">;

export function ResetPasswordSuccessScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);

  return (
    <AuthScreenShell
      title="Check your inbox"
      subtitle="We sent password reset instructions to your email."
      footer={
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
          <AppText tone="secondary">Didn't receive an email? </AppText>
          <Pressable onPress={() => showToast({ message: "Reset link resent.", tone: "success" })}>
            <AppText tone="accent" style={{ fontWeight: "700", textDecorationLine: "underline" }}>
              Resend link
            </AppText>
          </Pressable>
        </View>
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
          <MailCheck color={palette.orange} size={40} />
        </View>

        <View style={{ gap: spacing[3] }}>
          <Button
            label="Open email client"
            onPress={() => showToast({ message: "Open your email app to continue.", tone: "info" })}
            style={{ minHeight: 56 }}
          />
          <Button
            label="I'll do it later"
            variant="secondary"
            onPress={() => navigation.navigate("Login")}
            style={{ minHeight: 56 }}
          />
        </View>

        <View style={{ backgroundColor: palette.infoSoft, borderRadius: 16, padding: spacing[3] }}>
          <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
            Your account stays secure until the reset link is used.
          </AppText>
        </View>
      </View>
    </AuthScreenShell>
  );
}
