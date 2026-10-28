import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppState, Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Compass, Star, UtensilsCrossed } from "lucide-react-native";
import { useEffect, useState } from "react";

import { AppText, Button, Card } from "@/components/ui";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";

type Props = NativeStackScreenProps<OnboardingStackParamList, "LocationPermission">;

const locationPermissionsGraphic = require("../../../../assets/images/location-permissions-graphic.png");

const FEATURE_ROWS = [
  {
    key: "nearby",
    title: "Nearby dish discovery",
    description: "Find trending laksa or hidden gem pastries just steps away.",
    icon: UtensilsCrossed,
    iconTone: "orange",
    iconBgTone: "orangeLight",
  },
  {
    key: "navigation",
    title: "Directions",
    description: "Open directions to a stall's centre or mall in your maps app.",
    icon: Compass,
    iconTone: "warning",
    iconBgTone: "amberLight",
  },
  {
    key: "favourites",
    title: "Local favourites",
    description: "See what diners near you rate highly right now.",
    icon: Star,
    iconTone: "textSecondary",
    iconBgTone: "bgSoft",
  },
] as const;

// The short primer keeps the two benefits that sell location; Directions works without it.
const COMPACT_ROW_TITLES: Record<string, string> = {
  nearby: "Dishes and stalls near you",
  favourites: "What diners nearby rate highly",
};

export function LocationPermissionScreen({ navigation }: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const [isContinuing, setIsContinuing] = useState(false);
  // The OS no longer shows the prompt after a permanent denial; offer Settings.
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  // Why the phone cannot ask again; shown next to the buttons, never as a toast over them.
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const primer = useExperimentVariant("onboarding_location_primer_v1");
  const compact = primer === "test";

  useEffect(() => {
    trackOnboardingStepViewed("location");
  }, []);

  // Step 2 of onboarding; the optional taste quiz comes next.
  const next = () => {
    navigation.navigate(nextOnboardingRoute("LocationPermission"));
  };

  const pickAreaInstead = (message: string) => {
    navigation.navigate("ManualLocationPicker", { mode: "onboarding", notice: message });
  };

  const readPermission = async (): Promise<{ status?: string; canAskAgain?: boolean }> => {
    try {
      const Location = require("expo-location") as {
        getForegroundPermissionsAsync?: () => Promise<{ status: string; canAskAgain?: boolean }>;
      };
      return (await Location.getForegroundPermissionsAsync?.()) ?? {};
    } catch {
      return {};
    }
  };

  // Back from Settings: if location is now allowed, the blocked state ends.
  useEffect(() => {
    if (!permissionBlocked) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void readPermission().then((permission) => {
        if (permission.status === "granted") setPermissionBlocked(false);
      });
    });
    return () => subscription.remove();
  }, [permissionBlocked]);

  const openSettings = () => void Linking.openSettings().catch(() => undefined);
  // Blocked by the phone, "Allow location" can do nothing; Settings is the way forward.
  const showSettingsPrimary = permissionBlocked && !manualLocation;

  const allowDeviceLocation = async () => {
    try {
      const granted = await grantLocation();
      if (granted) {
        next();
        return;
      }
      const permission = await readPermission();
      if (permission.status === "granted") {
        pickAreaInstead("We couldn't get a GPS fix. Pick your area instead.");
        return;
      }
      if (permission.canAskAgain === false) {
        // The phone will not ask again: stay here and offer Settings or an area, side by side.
        setPermissionBlocked(true);
        setBlockedNotice("Location is off for Hungry. Turn it on in Settings, or pick your area.");
        return;
      }
      pickAreaInstead("No problem. Pick your area instead; you can turn location on anytime.");
    } catch (error) {
      reportError(error, { screen: "LocationPermission", action: "allow_location" });
      pickAreaInstead("We couldn't get your location. Pick your area instead.");
    }
  };

  const onContinue = async () => {
    if (isContinuing) {
      return;
    }

    setIsContinuing(true);
    if (manualLocation) {
      next();
      setIsContinuing(false);
      return;
    }

    await allowDeviceLocation();
    setIsContinuing(false);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.bg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.bg,
            flexDirection: "row",
            minHeight: 56,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to welcome"
            accessibilityHint="Returns to the welcome screen"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("OnboardingWelcome");
              }
            }}
            style={{
              alignItems: "center",
              borderRadius: radii.pill,
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <ArrowLeft color={palette.text} size={22} />
          </Pressable>
        </View>

        {/* The content scrolls (large text sizes); the buttons stay pinned below it. */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing[3],
            paddingHorizontal: spacing[3],
            paddingTop: spacing[3],
            paddingBottom: 16,
          }}
        >
          <OnboardingProgress step="location" />
          <View style={{ gap: spacing[2] }}>
            <AccessibleImage
              source={locationPermissionsGraphic}
              contentFit="contain"
              decorative
              style={{
                alignSelf: "center",
                height: compact ? 72 : 96,
                width: "100%",
                maxWidth: 230,
              }}
            />
            <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
              Discover the best bites{"\n"}around you.
            </AppText>
            <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
              We use your location to show stalls near you. You can change it anytime.
            </AppText>
          </View>

          <View style={{ gap: spacing[2] }}>
            {compact
              ? FEATURE_ROWS.filter((row) => row.key in COMPACT_ROW_TITLES).map(
                  ({ key, ...row }) => (
                    <FeatureCard
                      key={key}
                      {...row}
                      title={COMPACT_ROW_TITLES[key] ?? row.title}
                      description=""
                    />
                  ),
                )
              : FEATURE_ROWS.map(({ key, ...row }) => <FeatureCard key={key} {...row} />)}
          </View>
        </ScrollView>

        <View
          style={{
            backgroundColor: palette.bg,
            gap: ONBOARDING_ACTIONS_GAP,
            paddingTop: spacing[3],
            paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING,
            paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
          }}
        >
          {blockedNotice && permissionBlocked ? (
            <AppText
              variant="bodySmall"
              tone="secondary"
              accessibilityRole="alert"
              style={{ textAlign: "center" }}
            >
              {blockedNotice}
            </AppText>
          ) : null}
          {showSettingsPrimary ? (
            <Button
              label="Open settings"
              accessibilityHint="Opens Settings to turn on location for Hungry"
              onPress={openSettings}
              style={shadows.floating}
            />
          ) : (
            <Button
              label={manualLocation ? "Continue" : "Allow location"}
              accessibilityHint={
                manualLocation ? undefined : "Shows your phone's location permission prompt"
              }
              onPress={onContinue}
              loading={isContinuing}
              style={shadows.floating}
            />
          )}
          {/* An area is picked, so Continue leads; Settings stays one tap away. */}
          {permissionBlocked && manualLocation ? (
            <Button
              label="Open settings"
              variant="ghost"
              accessibilityHint="Opens Settings to turn on location for Hungry"
              onPress={openSettings}
            />
          ) : null}
          {manualLocation ? (
            <Button
              label={`Selected location: ${manualLocation}`}
              variant="secondary"
              onPress={() => navigation.navigate("ManualLocationPicker", { mode: "onboarding" })}
              accessibilityLabel={`Edit selected location, currently ${manualLocation}`}
            />
          ) : (
            <Button
              label={showSettingsPrimary ? "Pick my area" : "Pick my area instead"}
              variant="secondary"
              onPress={() => navigation.navigate("ManualLocationPicker", { mode: "onboarding" })}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function FeatureCard({
  icon: Icon,
  iconTone,
  iconBgTone,
  title,
  description,
}: {
  icon: typeof UtensilsCrossed;
  iconTone: "orange" | "warning" | "textSecondary";
  iconBgTone: "orangeLight" | "amberLight" | "bgSoft";
  title: string;
  description: string;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();

  return (
    <Card
      style={{
        backgroundColor: palette.surface,
        borderColor: "transparent",
        borderRadius: componentRadii.card,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[3],
        minHeight: description ? 78 : 56,
        padding: spacing[3],
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette[iconBgTone],
          borderRadius: radii.pill,
          height: 44,
          justifyContent: "center",
          width: 44,
        }}
      >
        <Icon color={palette[iconTone]} size={20} />
      </View>
      <View style={{ flex: 1, gap: spacing[1] }}>
        <AppText variant="bodyBold">{title}</AppText>
        {description ? (
          <AppText variant="micro" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}
