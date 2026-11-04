import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button, Chip, Input } from "@/components/ui";
import { matchAreas } from "@/features/location/areaSearch";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { tapHaptic } from "@/lib/haptics";
import { MAX_USUAL_AREAS, useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { SORTED_SINGAPORE_AREAS, type SingaporeArea } from "./singaporeAreas";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingAreas">;

/** The areas offered before the person types anything. */
const POPULAR_AREA_IDS = [
  "tampines",
  "jurong-east",
  "orchard",
  "central-area",
  "woodlands",
  "punggol",
  "bishan",
  "ang-mo-kio",
];

/** Screen 4: up to three areas the person eats around most. Optional; Continue is always on. */
export function OnboardingAreasScreen({ navigation }: Props) {
  useOnboardingScreenViewed("areas");
  const { spacing } = useHungryTheme();
  const selected = useOnboardingAnswersStore((state) => state.usualAreaIds);
  const toggleUsualArea = useOnboardingAnswersStore((state) => state.toggleUsualArea);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const areas = SORTED_SINGAPORE_AREAS;
  const byId = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);

  const popular = POPULAR_AREA_IDS.map((id) => byId.get(id)).filter((area): area is SingaporeArea =>
    Boolean(area),
  );
  const searching = query.trim().length > 0;
  const shown = searching ? matchAreas(query, areas) : popular;
  // An area picked earlier stays on screen even when it is not in the list being shown.
  const picked = selected
    .map((id) => byId.get(id))
    .filter(
      (area): area is SingaporeArea => Boolean(area) && !shown.some((s) => s.id === area!.id),
    );

  const toggle = (area: SingaporeArea) => {
    const accepted = toggleUsualArea(area.id);
    setNotice(accepted ? null : `Pick up to ${MAX_USUAL_AREAS}. Tap one to swap it.`);
  };

  return (
    <OnboardingFrame
      screen="areas"
      onBack={() => navigation.goBack()}
      footer={
        <Button
          label="Continue"
          onPress={() => {
            tapHaptic();
            navigation.navigate(nextOnboardingRoute("OnboardingAreas", true));
          }}
        />
      }
    >
      <MascotLine pose="clipboard" lineId="areas" text="Which areas do you eat around most?" />
      <AppText variant="bodySmall" tone="secondary">
        Pick up to {MAX_USUAL_AREAS}. This helps when location is off, or you are at work.
      </AppText>
      <Input
        label="Search an area"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setNotice(null);
        }}
        placeholder="Tampines, Jurong East..."
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {[...picked, ...shown].map((area) => (
          <Chip
            key={area.id}
            label={area.name}
            accessibilityLabel={`Area ${area.name}`}
            selected={selected.includes(area.id)}
            onPress={() => toggle(area)}
          />
        ))}
      </View>
      {searching && shown.length === 0 ? (
        <AppText variant="bodySmall" tone="secondary">
          No area matches that. Try another word.
        </AppText>
      ) : null}
      {notice ? (
        <AppText variant="bodySmall" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}
    </OnboardingFrame>
  );
}
