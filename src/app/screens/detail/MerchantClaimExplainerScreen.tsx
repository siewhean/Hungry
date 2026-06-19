import { Pressable, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { X } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantClaimExplainer">;

const steps = [
  "Submit claim interest from the stall page.",
  "We verify business ownership via UEN or licence records.",
  "If needed, we request a short video walkaround for final proof.",
  "Once approved, the stall is marked verified for merchant tools.",
];

export function MerchantClaimExplainerScreen({ navigation }: Props) {
  const { spacing, palette, shadows, componentRadii } = useHungryTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "transparent",
        padding: spacing[3],
        justifyContent: "center",
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: palette.overlay,
        }}
        accessibilityRole="button"
        accessibilityLabel="Close claim verification details"
        accessibilityHint="Dismisses this popup"
      />

      <Card
        style={{
          gap: spacing[3],
          padding: spacing[4],
          backgroundColor: palette.surface,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          borderColor: palette.border,
          ...shadows.floating,
        }}
      >
        <View style={{ alignItems: "flex-end" }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close claim verification"
          >
            <X size={18} color={palette.text} />
          </Pressable>
        </View>
        <View style={{ gap: spacing[2], paddingBottom: spacing[1] }}>
          <AppText variant="h2">Claim Verification</AppText>
          <AppText variant="bodySmall" tone="secondary">
            How stall ownership verification works in Singapore.
          </AppText>
        </View>

        <View style={{ gap: spacing[3] }}>
          <AppText variant="bodyBold">What happens after you tap “Claim this stall”</AppText>
          {steps.map((step, index) => (
            <AppText key={step} variant="bodySmall">
              {index + 1}. {step}
            </AppText>
          ))}
        </View>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="bodyBold">Accepted verification inputs</AppText>
          <AppText variant="bodySmall">
            - UEN and registered business details (fastest path)
          </AppText>
          <AppText variant="bodySmall">- NEA/SFA licence details for stall operators</AppText>
          <AppText variant="bodySmall">- Contact name + contact email/phone for follow-up</AppText>
        </View>
      </Card>
    </View>
  );
}
