import React from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** From a claim to a live stall: the order a new merchant moves through. */
export const CLAIM_STEPS = ["Claim sent", "Approved", "Verified", "Live"] as const;

/**
 * Four steps in a row. `current` is the step the merchant is on (0 to 3); earlier steps are done.
 * Read as one sentence by a screen reader, not as four separate items.
 */
export function ClaimStepper({ current }: { current: number }) {
  const { palette, spacing, radii } = useHungryTheme();
  const index = Math.min(Math.max(Math.round(current), 0), CLAIM_STEPS.length - 1);
  return (
    <View
      accessible
      accessibilityLabel={`Step ${index + 1} of ${CLAIM_STEPS.length}: ${CLAIM_STEPS[index]}`}
      style={{ flexDirection: "row", gap: spacing[1] }}
    >
      {CLAIM_STEPS.map((label, step) => {
        const done = step < index;
        const active = step === index;
        return (
          <View key={label} style={{ alignItems: "center", flex: 1, gap: spacing[1] }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: done ? palette.success : active ? palette.orange : palette.bgSoft,
                borderRadius: radii.pill,
                height: 24,
                justifyContent: "center",
                width: 24,
              }}
            >
              {done ? (
                <Check size={14} color={palette.white} />
              ) : (
                <AppText
                  variant="micro"
                  style={{ color: active ? palette.textOnOrange : palette.textMuted }}
                >
                  {step + 1}
                </AppText>
              )}
            </View>
            <AppText variant="micro" tone={active ? "secondary" : "muted"} numberOfLines={1}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
