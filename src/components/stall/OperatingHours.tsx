import { View } from "react-native";

import { AppText } from "../ui";

interface OperatingHoursProps {
  hours: string;
  isOpen: boolean;
  closureNotice?: string;
}

export function OperatingHours({ hours, isOpen, closureNotice }: OperatingHoursProps) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="bodySmall" tone="secondary">
        {isOpen ? `Open now · ${hours}` : `Closed now · ${hours}`}
      </AppText>
      {closureNotice ? <AppText variant="bodySmall" tone="accent">{closureNotice}</AppText> : null}
    </View>
  );
}

