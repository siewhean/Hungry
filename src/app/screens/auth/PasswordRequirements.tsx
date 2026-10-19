import { View } from "react-native";
import { CheckCircle2, Circle } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { getPasswordRuleStatuses } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";

type Props = {
  password: string;
  /** Show the checklist even while the password is empty (pass the field's focus state). */
  revealed?: boolean;
  testID?: string;
};

/**
 * Compact new-password checklist. Driven by the same rule list as
 * validatePassword, so the visible requirements never drift from the
 * submit-time check. Hidden until the field is focused or has content, shown
 * as a two-column micro list while typing, and collapsed to one "Strong
 * password" line once every rule is met. Met state is icon shape + text (and a
 * "N of M requirements met" summary for screen readers), not colour alone.
 */
export function PasswordRequirements({
  password,
  revealed = false,
  testID = "password-requirements",
}: Props) {
  const { palette, spacing } = useHungryTheme();
  const value = password ?? "";
  if (!revealed && value.length === 0) return null;

  const statuses = getPasswordRuleStatuses(value);
  const metCount = statuses.filter((status) => status.met).length;
  const allMet = metCount === statuses.length;
  const summary = `${metCount} of ${statuses.length} requirements met`;

  if (allMet) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={`Password requirements: ${summary}. Strong password.`}
        style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
      >
        <CheckCircle2 color={palette.successText} size={12} />
        <AppText testID={`${testID}-strong`} variant="micro" style={{ color: palette.successText }}>
          Strong password
        </AppText>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Password requirements: ${summary}. ${statuses
        .map((status) => `${status.label}: ${status.met ? "met" : "not met"}`)
        .join(". ")}.`}
      style={{ columnGap: spacing[3], flexDirection: "row", flexWrap: "wrap", rowGap: 2 }}
    >
      {statuses.map((status) => (
        <View
          key={status.id}
          testID={`${testID}-${status.id}`}
          style={{
            alignItems: "center",
            flexBasis: "45%",
            flexDirection: "row",
            flexGrow: 1,
            gap: spacing[1],
          }}
        >
          {status.met ? (
            <CheckCircle2 color={palette.successText} size={12} />
          ) : (
            <Circle color={palette.textMuted} size={12} />
          )}
          <AppText
            variant="micro"
            tone={status.met ? "default" : "muted"}
            style={{ flexShrink: 1 }}
          >
            {status.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
