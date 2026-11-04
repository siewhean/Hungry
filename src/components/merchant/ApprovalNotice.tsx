import React, { useEffect, useState } from "react";
import { View } from "react-native";

import { AppText, Button } from "@/components/ui";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantClaimSummary } from "@/lib/services/types";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";

/**
 * "You're approved", shown once per approved claim on the Merchant Centre Home. Ops approve
 * claims by hand, so this is where the merchant finds out if they missed the email.
 */
export function ApprovalNotice() {
  const { palette, spacing, componentRadii } = useHungryTheme();
  const dismissed = useMerchantStore((state) => state.dismissedApprovalClaimIds);
  const dismiss = useMerchantStore((state) => state.dismissApprovalNotice);
  const [claims, setClaims] = useState<MerchantClaimSummary[]>([]);

  useEffect(() => {
    let active = true;
    getHungryService()
      .supply.getMyMerchantClaims()
      .then((rows) => {
        if (active) setClaims(rows);
      })
      .catch((error) => {
        reportError(error, { screen: "MerchantDashboard", action: "load_approval_notice" });
      });
    return () => {
      active = false;
    };
  }, []);

  const approved = claims.find(
    (claim) => claim.status === "approved" && !dismissed.includes(claim.claimId),
  );
  if (!approved) return null;

  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: palette.successSoft,
        borderRadius: componentRadii.card,
        gap: spacing[2],
        padding: spacing[4],
      }}
    >
      <AppText variant="bodyBold">You&apos;re approved</AppText>
      <AppText variant="bodySmall" tone="secondary">
        {approved.venueName} is yours on Hungry. Add your menu and photos, then submit your licence
        so diners can see your dishes.
      </AppText>
      <Button
        label="Got it"
        variant="secondary"
        fullWidth={false}
        onPress={() => dismiss(approved.claimId)}
      />
    </View>
  );
}
