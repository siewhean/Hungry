import { View } from "react-native";

import { AppText, Chip } from "@/components/ui";
import type { SingaporeArea } from "@/app/screens/onboarding/singaporeAreas";
import { useHungryTheme } from "@/theme";

type Props = {
  areas: readonly SingaporeArea[];
  onPick: (area: SingaporeArea) => void;
};

/**
 * Home with location off: the areas the diner told us they eat around, one tap each, so their
 * answer in onboarding is the shortest way to food near them. Renders nothing without areas.
 */
export function UsualAreaChips({ areas, onPick }: Props) {
  const { spacing } = useHungryTheme();
  if (areas.length === 0) return null;
  return (
    <View style={{ gap: spacing[1], paddingBottom: spacing[1] }} testID="usual-area-chips">
      <AppText variant="micro" tone="secondary">
        Your usual areas
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {areas.map((area) => (
          <Chip
            key={area.id}
            label={area.name}
            accessibilityLabel={`Show food in ${area.name}`}
            onPress={() => onPick(area)}
          />
        ))}
      </View>
    </View>
  );
}
