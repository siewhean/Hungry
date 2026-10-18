import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Clock3, Compass, UtensilsCrossed } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, Card } from "@/components/ui";
import { WordmarkLogoV2 } from "@/components/icons/brand/WordmarkLogoV2";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
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
    title: "Food Navigation",
    description: "Get precise directions to the exact stall in busy food streets.",
    icon: Compass,
    iconTone: "warning",
    iconBgTone: "amberLight",
  },
  {
    key: "wait",
    title: "Local Favorites",
    description: "Use timing cues to plan around busier nearby stalls and dishes.",
    icon: Clock3,
    iconTone: "error",
    iconBgTone: "errorSoft",
  },
] as const;

export function LocationPermissionScreen({ navigation }: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const [isContinuing, setIsContinuing] = useState(false);

  // Last onboarding step: guests and signed-in users both land on Home.
  // Sign-in is asked for later, when someone saves, reviews or posts.
  const finish = () => {
    completeOnboarding(hasSkippedTasteQuiz);
    const rootNav = navigation.getParent();
    if (rootNav && typeof (rootNav as { reset?: (state: object) => void }).reset === "function") {
      (rootNav as { reset: (state: object) => void }).reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }
  };

  const allowDeviceLocation = async () => {
    try {
      const granted = await grantLocation();
      if (!granted) {
        navigation.navigate("ManualLocationPicker");
        return;
      }
      finish();
    } catch {
      navigation.navigate("ManualLocationPicker");
    }
  };

  const onContinue = async () => {
    if (isContinuing) {
      return;
    }

    setIsContinuing(true);
    if (manualLocation) {
      finish();
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
            accessibilityLabel="Back to taste quiz"
            accessibilityHint="Returns to the taste preference questions"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("TasteQuiz");
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
            label="Continue"
            onPress={onContinue}
            loading={isContinuing}
            style={shadows.floating}
          />
          {manualLocation ? (
            <Button
              label={`Selected Location: ${manualLocation}`}
              variant="secondary"
              onPress={() => navigation.navigate("ManualLocationPicker")}
              accessibilityLabel={`Edit selected location, currently ${manualLocation}`}
            />
          ) : (
            <Button
              label="Enter Manually"
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
