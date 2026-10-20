import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Linking, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Clock3, Compass, UtensilsCrossed } from "lucide-react-native";
import { useEffect, useState } from "react";

import { AppText, Button, Card } from "@/components/ui";
import { WordmarkLogoV2 } from "@/components/icons/brand/WordmarkLogoV2";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";
import { useLocationStore } from "@/store/useLocationStore";
import { useUIStore } from "@/store/useUIStore";
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
    title: "Nearby Dish Discovery",
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
    key: "wait",
    title: "Local Favourites",
    description: "See what diners near you rate highly right now.",
    icon: Clock3,
    iconTone: "error",
    iconBgTone: "errorSoft",
  },
] as const;

export function LocationPermissionScreen({ navigation }: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const showToast = useUIStore((state) => state.showToast);
  const [isContinuing, setIsContinuing] = useState(false);
  // The OS no longer shows the prompt after a permanent denial; offer Settings.
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  useEffect(() => {
    trackOnboardingStepViewed("location");
  }, []);

  // Step 2 of onboarding; the optional taste quiz comes next.
  const next = () => {
    navigation.navigate("TasteQuiz");
  };

  const pickAreaInstead = (message: string) => {
    showToast({ message, tone: "warning" });
    navigation.navigate("ManualLocationPicker");
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
      if (permission.canAskAgain === false) setPermissionBlocked(true);
      pickAreaInstead("No problem. Pick your area instead; you can turn location on anytime.");
    } catch {
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
            justifyContent: "space-between",
            minHeight: 64,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
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
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <ArrowLeft color={palette.text} size={22} />
          </Pressable>
          <WordmarkLogoV2 size={HUNGRY_LOGO_STANDARD_WORDMARK_SIZE} />
          <View style={{ width: 40 }} />
        </View>

        <View
          style={{
            flex: 1,
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
              accessibilityLabel="Location permission illustration"
              style={{
                alignSelf: "center",
                height: 96,
                width: "100%",
                maxWidth: 230,
              }}
            />
            <AppText variant="h2" style={{ textAlign: "center" }}>
              Discover the best bites{"\n"}around you.
            </AppText>
            <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
              Allowing location helps Hungry curate{"\n"}the perfect experience for your palate.
            </AppText>
          </View>

          <View style={{ gap: spacing[2] }}>
            {FEATURE_ROWS.map(({ key, ...row }) => (
              <FeatureCard key={key} {...row} />
            ))}
          </View>
        </View>

        <View
          style={{
            backgroundColor: palette.bg,
            gap: ONBOARDING_ACTIONS_GAP,
            paddingTop: spacing[3],
            paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING,
            paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
          }}
        >
          <Button
            label={manualLocation ? "Continue" : "Allow location"}
            accessibilityHint={
              manualLocation ? undefined : "Shows your phone's location permission prompt"
            }
            onPress={onContinue}
            loading={isContinuing}
            style={shadows.floating}
          />
          {permissionBlocked && !manualLocation ? (
            <Button
              label="Open Settings"
              variant="ghost"
              accessibilityHint="Opens Settings to turn on location for Hungry"
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          ) : null}
          {manualLocation ? (
            <Button
              label={`Selected location: ${manualLocation}`}
              variant="secondary"
              onPress={() => navigation.navigate("ManualLocationPicker")}
              accessibilityLabel={`Edit selected location, currently ${manualLocation}`}
            />
          ) : (
            <Button
              label="Pick my area instead"
              variant="secondary"
              onPress={() => navigation.navigate("ManualLocationPicker")}
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
  iconTone: "orange" | "warning" | "error";
  iconBgTone: "orangeLight" | "amberLight" | "errorSoft";
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
        minHeight: 78,
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
        <AppText variant="micro" tone="secondary">
          {description}
        </AppText>
      </View>
    </Card>
  );
}
