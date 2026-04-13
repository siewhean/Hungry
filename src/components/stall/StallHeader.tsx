import { View } from "react-native";

import { AppText, Badge } from "../ui";
import { useHungryTheme } from "@/theme";
import { HygieneGradeBadge } from "./HygieneGradeBadge";
import { OperatingHours } from "./OperatingHours";
import type { VenueSummary } from "@/types/domain";

interface StallHeaderProps {
  venue: VenueSummary;
}

export function StallHeader({ venue }: StallHeaderProps) {
  const { spacing } = useHungryTheme();

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h2">{venue.name}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {venue.unitNumber} · {venue.floor}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        <HygieneGradeBadge grade={venue.hygieneGrade} />
        <Badge label={venue.isOpen ? "Open" : "Closed"} tone={venue.isOpen ? "success" : "warning"} />
      </View>
      <OperatingHours hours={venue.operatingHours} isOpen={venue.isOpen} closureNotice={venue.closureNotice} />
    </View>
  );
}

