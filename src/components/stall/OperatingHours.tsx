import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { isVenueOpenFromHours } from "@/utils/stallStatus";
import { AppText } from "../ui";

interface OperatingHoursProps {
  hours: string;
  isOpen: boolean;
  closureNotice?: string;
}

export function OperatingHours({ hours, isOpen, closureNotice }: OperatingHoursProps) {
  const { palette, spacing } = useHungryTheme();
  const isOpenNow = isVenueOpenFromHours(hours, isOpen);

  return (
    <View style={{ gap: spacing[1] }}>
      <AppText variant="bodySmall" style={{ color: isOpenNow ? palette.success : palette.error }}>
        {isOpenNow ? `Open now · Listed hours: ${hours}` : `Closed now · Listed hours: ${hours}`}
      </AppText>
      {closureNotice ? (
        <AppText variant="bodySmall" tone="accent">
          {closureNotice}
        </AppText>
      ) : null}
    </View>
  );
}
