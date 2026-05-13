import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantClaimExplainer">;

const steps = [
  "Submit claim interest from the stall page.",
  "We verify business ownership via UEN or licence records.",
  "If needed, we request a short video walkaround for final proof.",
  "Once approved, the stall is marked verified for merchant tools.",
];

export function MerchantClaimExplainerScreen({}: Props) {
  const { spacing } = useHungryTheme();

  return (
    <Screen
      title="Claim Verification"
      subtitle="How stall ownership verification works in Singapore"
    >
      <ScrollView contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}>
        <Card>
          <View style={{ gap: spacing[3] }}>
            <AppText variant="bodyBold">What happens after you tap “Claim this stall”</AppText>
            {steps.map((step, index) => (
              <AppText key={step} variant="bodySmall">
                {index + 1}. {step}
              </AppText>
            ))}
          </View>
        </Card>
        <Card>
          <View style={{ gap: spacing[2] }}>
            <AppText variant="bodyBold">Accepted verification inputs</AppText>
            <AppText variant="bodySmall">
              - UEN and registered business details (fastest path)
            </AppText>
            <AppText variant="bodySmall">- NEA/SFA licence details for stall operators</AppText>
            <AppText variant="bodySmall">
              - Contact name + contact email/phone for follow-up
            </AppText>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
