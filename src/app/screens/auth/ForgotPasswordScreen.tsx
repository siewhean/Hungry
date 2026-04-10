import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react-native";

import { AppText, Button, Input } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { validateEmail } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;
type FormValues = { email: string };

export function ForgotPasswordScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({ defaultValues: { email: "" } });

  const handleSend = handleSubmit(() => {
    showToast({ message: "If the email exists, a reset link was sent.", tone: "info" });
    navigation.navigate("ResetPassword");
  });

  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing[5], paddingVertical: spacing[3] }}>
        <Pressable onPress={() => navigation.goBack()}><ArrowLeft color={palette.orange} size={18} /></Pressable>
        <AppText variant="h1" style={{ color: "#A93100" }}>Hungry</AppText>
        <View style={{ width: 18 }} />
      </View>

      <View style={{ flex: 1, justifyContent: "space-between", paddingHorizontal: spacing[6], paddingTop: spacing[8] }}>
        <View style={{ alignItems: "center", gap: spacing[3] }}>
          <View style={{ alignItems: "center", backgroundColor: "#EFE7DE", borderRadius: 40, height: 80, justifyContent: "center", width: 80 }}>
            <LockKeyhole color={palette.orange} size={30} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>Forgot password</AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }}>
            Enter your email address and we'll send you a link to reset your password and get you back to your table.
          </AppText>
        </View>

        <View style={{ gap: spacing[4], paddingBottom: spacing[8] }}>
          <Controller
            control={control}
            name="email"
            rules={{ validate: validateEmail }}
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 4 }}>
                <Input
                  label="EMAIL ADDRESS"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="chef@restaurant.com"
                  value={value}
                  onChangeText={onChange}
                  leftIcon={<Mail color="#B79D8F" size={16} />}
                />
                {errors.email ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.email.message}</AppText> : null}
              </View>
            )}
          />
          <Button label="Send reset link" onPress={handleSend} style={{ borderRadius: 24, minHeight: 56 }} />
          <Pressable onPress={() => navigation.navigate("Login")} style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], justifyContent: "center" }}>
            <ArrowLeft color="#A93100" size={14} />
            <AppText tone="accent" style={{ fontFamily: "Nunito_700Bold" }}>Back to login</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
