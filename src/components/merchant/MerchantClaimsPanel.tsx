import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { ClaimStepper } from "@/components/merchant/ClaimStepper";
import { AppText, Button, Skeleton } from "@/components/ui";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantClaimSummary } from "@/lib/services/types";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";

function describe(claim: MerchantClaimSummary): string {
  switch (claim.status) {
    case "submitted":
      return "We have your claim. Hungry usually replies within 2 working days.";
    case "in_review":
      return "Hungry is checking your claim. We may email you for more details.";
    case "approved":
      return "Approved. Open the Merchant Centre to verify your stall.";
    case "rejected":
      return "We could not approve this claim. Email usehungrysingapore@gmail.com and we will help.";
  }
}

/** The signed-in user's stall claims, each with where it stands on the way to a live stall. */
export function MerchantClaimsPanel() {
  const { palette, spacing, componentRadii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const [claims, setClaims] = useState<MerchantClaimSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      setClaims(await getHungryService().supply.getMyMerchantClaims());
      setFailed(false);
    } catch (error) {
      reportError(error, { screen: "MerchantGate", action: "load_claims" });
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Approval creates the merchant account on the server; fetching it opens the Merchant Centre.
  const checkAgain = async () => {
    setIsChecking(true);
    try {
      const account = await getHungryService().merchant.getMerchantAccount();
      if (account) setAccount(account);
      else await load();
    } catch (error) {
      reportError(error, { screen: "MerchantGate", action: "check_claim" });
      setFailed(true);
    } finally {
      setIsChecking(false);
    }
  };

  if (claims === null && !failed)
    return <Skeleton height={96} borderRadius={componentRadii.card} />;
  if (failed && !claims) {
    return (
      <View style={{ gap: spacing[2] }}>
        <AppText variant="bodySmall" tone="muted">
          Could not load your claims. Check your connection and try again.
        </AppText>
        <Button label="Try again" variant="secondary" fullWidth={false} onPress={load} />
      </View>
    );
  }
  if (!claims || claims.length === 0) return null;

  return (
    <View style={{ gap: spacing[3], width: "100%" }}>
      <AppText variant="bodyBold">Your claims</AppText>
      {claims.map((claim) => (
        <View
          key={claim.claimId}
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            gap: spacing[3],
            padding: spacing[4],
          }}
        >
          <AppText variant="bodyBold">{claim.venueName}</AppText>
          <ClaimStepper current={claim.status === "approved" ? 1 : 0} />
          <AppText variant="bodySmall" tone="muted">
            {describe(claim)}
          </AppText>
          {claim.status === "approved" || claim.status === "in_review" ? (
            <Button
              label={claim.status === "approved" ? "Open Merchant Centre" : "Check again"}
              variant={claim.status === "approved" ? "primary" : "secondary"}
              fullWidth={false}
              loading={isChecking}
              disabled={isChecking}
              onPress={checkAgain}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
