import React, { useState } from "react";
import { View } from "react-native";

import { PromotionDateField } from "@/components/merchant/PromotionDateField";
import { AppText, Button } from "@/components/ui";
import {
  endOfSingaporeDay,
  getClosureLabel,
  resolveClosedUntil,
  singaporeDateOnly,
} from "@/features/merchant/closure";
import { useHungryTheme } from "@/theme";
import type { MerchantOutlet } from "@/types/domain";

export type ClosureChoice =
  | { kind: "open" }
  | { kind: "today"; closedUntil: string }
  | { kind: "until"; closedUntil: string };

/**
 * The "pause store" control: open as usual, closed today, or closed until a reopen date. The
 * parent saves the choice (and says so to the merchant); this only builds it.
 */
export function ClosurePanel({
  outlet,
  isSaving,
  onChoose,
}: {
  outlet: Pick<MerchantOutlet, "closedUntil" | "temporaryClosure">;
  isSaving: boolean;
  onChoose: (choice: ClosureChoice) => void;
}) {
  const { palette, spacing, componentRadii } = useHungryTheme();
  const [date, setDate] = useState(() => singaporeDateOnly(new Date(), 2));
  const [dateError, setDateError] = useState<string | null>(null);
  const current = getClosureLabel(outlet.closedUntil) ?? (outlet.temporaryClosure || undefined);

  const chooseDate = () => {
    const result = resolveClosedUntil(date);
    if ("error" in result) {
      setDateError(result.error);
      return;
    }
    setDateError(null);
    onChoose({ kind: "until", closedUntil: result.closedUntil });
  };

  return (
    <View
      accessibilityLabel="Stall status"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[4],
      }}
    >
      <AppText variant="bodyBold">Pause your stall</AppText>
      <AppText variant="bodySmall" tone="muted">
        {current
          ? `Diners see "${current}" on your stall page.`
          : "Tell diners you are closed. They see it on your stall and dish pages."}
      </AppText>
      {current ? (
        <Button
          label="Open as usual"
          variant="primary"
          loading={isSaving}
          disabled={isSaving}
          onPress={() => onChoose({ kind: "open" })}
        />
      ) : null}
      <Button
        label="Closed today"
        variant="secondary"
        disabled={isSaving}
        onPress={() =>
          onChoose({ kind: "today", closedUntil: endOfSingaporeDay(new Date()).toISOString() })
        }
      />
      <PromotionDateField
        label="Reopen on"
        value={date}
        onChange={(value) => {
          setDate(value);
          setDateError(null);
        }}
        minimumDate={singaporeDateOnly(new Date(), 1)}
        error={Boolean(dateError)}
      />
      {dateError ? (
        <AppText variant="bodySmall" style={{ color: palette.error }} accessibilityRole="alert">
          {dateError}
        </AppText>
      ) : null}
      <Button
        label="Close until this date"
        variant="secondary"
        disabled={isSaving}
        onPress={chooseDate}
      />
    </View>
  );
}
