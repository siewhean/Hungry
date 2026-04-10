import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MailCheck } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPasswordSuccess">;

export function ResetPasswordSuccessScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ alignItems: "center", gap: 16 }}>
          <View style={{ alignItems: "center", backgroundColor: "#D1430B", borderRadius: 24, height: 128, justifyContent: "center", width: 128 }}>
            <MailCheck color="#FFFFFF" size={48} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>Check your inbox</AppText>
          <AppText tone="secondary" style={{ fontSize: 18, lineHeight: 28, textAlign: "center" }}>
            We've sent password reset instructions to your email.
          </AppText>
        </View>

        <View style={{ gap: 16, marginTop: 36 }}>
          <Button label="Open email client" onPress={() => {}} style={{ borderRadius: 24, minHeight: 56 }} />
          <Button label="I'll do it later" variant="secondary" onPress={() => navigation.navigate("Login")} style={{ borderRadius: 24, minHeight: 56 }} />
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 44 }}>
          <AppText tone="secondary">Didn't receive an email? </AppText>
          <Pressable>
            <AppText tone="accent" style={{ fontFamily: "Nunito_700Bold", textDecorationLine: "underline" }}>Resend link</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
