import { View } from "react-native";
import { CheckCircle2, Circle } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { getPasswordRuleStatuses } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";

type Props = {
  password: string;
  testID?: string;
};

/**
 * Upfront new-password checklist. Driven by the same rule list as
 * validatePassword, so the visible requirements never drift from the
 * submit-time check. Met state is conveyed by icon + text, not colour alone.
 */
export function PasswordRequirements({ password, testID = "password-requirements" }: Props) {
  const { palette, spacing } = useHungryTheme();
  const statuses = getPasswordRuleStatuses(password ?? "");
  const metCount = statuses.filter((status) => status.met).length;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Password requirements, ${metCount} of ${statuses.length} met. ${statuses
        .map((status) => `${status.label}: ${status.met ? "met" : "not met"}`)
        .join(". ")}.`}
      style={{ gap: spacing[1] }}
    >
      {statuses.map((status) => (
        <View
          key={status.id}
          testID={`${testID}-${status.id}`}
          style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
        >
          {status.met ? (
            <CheckCircle2 color={palette.successText} size={14} />
          ) : (
            <Circle color={palette.textMuted} size={14} />
          )}
          <AppText variant="bodySmall" tone={status.met ? "default" : "muted"}>
            {status.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
