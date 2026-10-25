import { Pressable, View } from "react-native";
import { Check, Square } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export const REGISTRATION_CONSENT_ERROR =
  "Confirm that you are 18 or older and agree to the terms before creating an account.";

export function hasRegistrationConsent(adult: boolean, terms: boolean): boolean {
  return adult === true && terms === true;
}

export function RegistrationConsent({
  adult,
  terms,
  onAdultChange,
  onTermsChange,
}: {
  adult: boolean;
  terms: boolean;
  onAdultChange: (value: boolean) => void;
  onTermsChange: (value: boolean) => void;
}) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      {[
        { label: "I am 18 or older.", checked: adult, change: onAdultChange },
        {
          label: "I agree to the Terms of service and have read the Privacy policy.",
          checked: terms,
          change: onTermsChange,
        },
      ].map(({ label, checked, change }) => (
        <Pressable
          key={label}
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked }}
          onPress={() => change(!checked)}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing[2] }}
        >
          {checked ? (
            <Check size={20} color={palette.text} />
          ) : (
            <Square size={20} color={palette.text} />
          )}
          <AppText variant="bodySmall" style={{ flex: 1 }}>
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
