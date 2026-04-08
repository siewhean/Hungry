import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { View } from "react-native";

import { Button, Card, InlineBanner, Input, AppText } from "@/components/ui";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { OnboardingScreenShell } from "./OnboardingScreenShell";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "LocationPermission">;

export function LocationPermissionScreen({ navigation }: Props) {
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const denyLocation = useLocationStore((state) => state.denyLocation);
  const setManualLocation = useLocationStore((state) => state.setManualLocation);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const [manualLocation, setManualLocationValue] = useState("CBD");

  const finish = () => {
    completeOnboarding(hasSkippedTasteQuiz);
  };

  return (
    <OnboardingScreenShell
      title="Location permission"
      subtitle="We use your location to rank nearby dishes and show the right map area."
      stepLabel="SCR-008"
    >
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">Why Hungry asks for location</AppText>
          <AppText tone="secondary">
            So the app can prioritize the nearest hawker centres, show distance, and keep result ordering relevant.
          </AppText>
          <InlineBanner tone="info" message="If you skip, manual location keeps the flow usable." />
        </View>
      </Card>
      <Input
        label="Manual location"
        value={manualLocation}
        onChangeText={setManualLocationValue}
        placeholder="CBD, Chinatown, Tampines"
      />
      <Button
        label="Allow location"
        onPress={() => {
          grantLocation();
          finish();
        }}
      />
      <Button
        label="Use manual location"
        variant="secondary"
        onPress={() => {
          denyLocation();
          setManualLocation(manualLocation);
          finish();
        }}
      />
      <Button
        label="Finish setup"
        variant="ghost"
        onPress={() => {
          denyLocation();
          finish();
        }}
      />
      <Button label="Back" variant="ghost" onPress={() => navigation.navigate("DietaryPreferences")} />
    </OnboardingScreenShell>
  );
}
