import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import {
  SETUP_MIN_DISHES,
  buildSetupChecklist,
  type SetupAction,
} from "@/features/merchant/setupChecklist";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useHungryTheme } from "@/theme";
import type { MerchantOutlet } from "@/types/domain";

/** "Get your stall ready": the four things a new merchant does before diners see the stall. */
export function SetupChecklist({
  outlet,
  onAction,
  showVerifyAction = true,
}: {
  outlet: MerchantOutlet;
  onAction: (action: SetupAction) => void;
  /** False on the Verification Centre itself, where the verify step is the screen below. */
  showVerifyAction?: boolean;
}) {
  const { palette, spacing, componentRadii, radii } = useHungryTheme();
  // Drafts count: an unverified merchant's dishes are all drafts.
  const [dishCount, setDishCount] = useState(0);
  const outletId = outlet.id;

  useEffect(() => {
    let active = true;
    getHungryService()
      .merchant.getMenu(outletId)
      .then((menu) => {
        if (active) setDishCount(menu.length);
      })
      .catch((error) =>
        reportError(error, { screen: "VerificationCentre", action: "load_setup_menu" }),
      );
    return () => {
      active = false;
    };
  }, [outletId]);

  const { items, doneCount } = buildSetupChecklist(outlet, dishCount);

  return (
    <View
      accessibilityLabel={`Get your stall ready, ${doneCount} of ${items.length} done`}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[4],
      }}
    >
      <AppText variant="bodyBold">Get your stall ready</AppText>
      <View style={{ backgroundColor: palette.bgSoft, borderRadius: radii.pill, height: 6 }}>
        <View
          style={{
            backgroundColor: palette.success,
            borderRadius: radii.pill,
            height: 6,
            width: `${Math.round((doneCount / items.length) * 100)}%`,
          }}
        />
      </View>
      <AppText variant="bodySmall" tone="muted">
        {doneCount} of {items.length} done. Add at least {SETUP_MIN_DISHES} dishes so diners have
        something to order.
      </AppText>
      {items.map((item) => (
        <View key={item.id} style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: item.done ? palette.success : palette.bgSoft,
              borderRadius: radii.pill,
              height: 24,
              justifyContent: "center",
              width: 24,
            }}
          >
            {item.done ? <Check size={14} color={palette.white} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">{item.label}</AppText>
            <AppText variant="bodySmall" tone="muted">
              {item.detail}
            </AppText>
          </View>
          {item.done || (item.action === "verification" && !showVerifyAction) ? null : (
            <Button
              label={
                item.action === "verification"
                  ? "Verify"
                  : item.action === "menu"
                    ? "Add"
                    : "Set up"
              }
              accessibilityLabel={item.label}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => onAction(item.action)}
            />
          )}
        </View>
      ))}
    </View>
  );
}
