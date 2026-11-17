import React from "react";
import { AppText, Screen } from "@/components/ui";
export function OrdersComingSoonScreen() {
  return (
    <Screen title="Ordering unavailable">
      <AppText>
        Hungry does not currently provide ordering, payments, or QR menu ordering. Continue managing
        your menu and business profile in Merchant Centre.
      </AppText>
    </Screen>
  );
}
