import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LocateFixed } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";

/**
 * Asked before anything that needs "near you": the device location first, a place search when
 * the diner would rather not share it. Once either lands in the location store, the screen that
 * shows this re-renders with a real position and the gate goes away by itself.
 */
export function LocationGate({
  title,
  body,
  source,
  compact = false,
}: {
  title: string;
  body: string;
  /** Which screen asked, for analytics. */
  source: "decide" | "map";
  /** A card that sits over a screen's content (the map), instead of the whole screen. */
  compact?: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette, radii, spacing } = useHungryTheme();
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const [isAsking, setIsAsking] = useState(false);
  const [failed, setFailed] = useState(false);

  const askForLocation = async () => {
    setIsAsking(true);
    setFailed(false);
    trackAnalyticsEvent("location_gate_choice", { source, choice: "use_my_location" });
    try {
      const granted = await grantLocation();
      if (!granted) setFailed(true);
    } catch (error) {
      reportError(error, { screen: "LocationGate", action: "grant_location" });
      setFailed(true);
    } finally {
      setIsAsking(false);
    }
  };

  const searchPlace = () => {
    trackAnalyticsEvent("location_gate_choice", { source, choice: "search_place" });
    navigation.navigate("OnboardingStack", { screen: "ManualLocationPicker" });
  };

  if (compact) {
    return (
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing[2],
          padding: spacing[3],
        }}
        testID="location-gate"
      >
        <AppText variant="bodySmallBold">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {failed ? "We couldn't get your location. Try a place instead." : body}
        </AppText>
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Button
            label="Use my location"
            size="sm"
            fullWidth={false}
            loading={isAsking}
            onPress={() => void askForLocation()}
          />
          <Button
            label="Search for a place"
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={searchPlace}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[4] }} testID="location-gate">
      <View
        style={{
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: palette.orangeLight,
          borderRadius: radii.pill,
          height: 56,
          justifyContent: "center",
          width: 56,
        }}
      >
        <LocateFixed color={palette.orange} size={28} />
      </View>
      <View style={{ gap: spacing[2] }} accessible accessibilityRole="header">
        <AppText variant="h1">{title}</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
      {failed ? (
        <AppText accessibilityRole="alert" tone="accent" variant="bodySmall">
          We couldn&apos;t get your location. Search for a place instead, or turn location on in
          Settings.
        </AppText>
      ) : null}
      <Button label="Use my location" loading={isAsking} onPress={() => void askForLocation()} />
      <Button label="Search for a place" variant="secondary" onPress={searchPlace} />
    </View>
  );
}
