import { View } from "react-native";

import { AppText, Badge } from "../ui";
import { useHungryTheme } from "@/theme";
import { OperatingHours } from "./OperatingHours";
import type { VenueSummary } from "@/types/domain";
import { isVenueOpenFromHours } from "@/utils/stallStatus";

interface StallHeaderProps {
  venue: VenueSummary;
}

export function StallHeader({ venue }: StallHeaderProps) {
  const { spacing } = useHungryTheme();
  const isOpenNow = isVenueOpenFromHours(venue.operatingHours, venue.isOpen);

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h2">{venue.name}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {venue.unitNumber} · {venue.floor}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        <Badge label={isOpenNow ? "Open" : "Closed"} tone={isOpenNow ? "success" : "warning"} />
      </View>
      <OperatingHours
        hours={venue.operatingHours}
        isOpen={isOpenNow}
        closureNotice={venue.closureNotice}
      />
    </View>
  );
}
