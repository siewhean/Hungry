import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { ArrowLeft, Clock3, Compass, MapPin, UtensilsCrossed } from "lucide-react-native";

import { AppText, Button, Card } from "@/components/ui";
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

const HERO_ILLUSTRATION = "https://www.figma.com/api/mcp/asset/c29e48d7-30d6-42f9-a46e-9d8c5419d602";

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
    title: "Hawker Navigation",
    description: "Get precise directions to that specific stall in complex centers.",
    icon: Compass,
    iconTone: "warning",
    iconBgTone: "amberLight",
  },
  {
    key: "wait",
    title: "Stall Wait Times",
    description: "Check real-time queues before you head out for lunch.",
    icon: Clock3,
    iconTone: "error",
    iconBgTone: "errorSoft",
  },
] as const;

export function LocationPermissionScreen({ navigation }: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);

  const finish = () => {
    completeOnboarding(hasSkippedTasteQuiz);
  };

  const allowDeviceLocation = async () => {
    const granted = await grantLocation();
    if (!granted) {
      navigation.navigate("ManualLocationPicker");
      return;
    }
    finish();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right", "bottom"]}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
          flexDirection: "row",
          justifyContent: "space-between",
          minHeight: 64,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("TasteQuiz")}
          style={{
            alignItems: "center",
            borderRadius: radii.pill,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <ArrowLeft color={palette.orange} size={22} />
        </Pressable>
        <AppText variant="h2" style={{ color: palette.orange, fontFamily: "Nunito_700Bold" }}>
          Hungry
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <View
        style={{
          flex: 1,
          gap: spacing[3],
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={[
              shadows.floating,
              {
                backgroundColor: palette.navy,
                borderRadius: radii.lg,
                height: 152,
                maxWidth: 188,
                overflow: "hidden",
                width: "100%",
              },
            ]}
          >
            <Image source={{ uri: HERO_ILLUSTRATION }} contentFit="cover" style={{ height: "100%", width: "100%" }} />
            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.92)",
                borderRadius: radii.pill,
                bottom: spacing[4],
                flexDirection: "row",
                gap: spacing[2],
                left: spacing[4],
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                position: "absolute",
                right: spacing[4],
              }}
            >
              <MapPin color={palette.orangeDark} size={14} />
              <AppText variant="micro" style={{ fontFamily: "Nunito_700Bold", textAlign: "center" }}>
                Singapore Food Trail
              </AppText>
            </View>
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
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
          paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING,
          paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
        }}
      >
        <Button
          label="Continue"
          onPress={allowDeviceLocation}
          style={shadows.floating}
        />
        <Button
          label="Enter Manually"
          variant="secondary"
          onPress={() => navigation.navigate("ManualLocationPicker")}
        />
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
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Card
      style={{
        backgroundColor: palette.surface,
        borderColor: "transparent",
        borderRadius: radii.lg,
        flexDirection: "row",
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
        <AppText variant="bodyBold">
          {title}
        </AppText>
        <AppText variant="micro" tone="secondary">
          {description}
        </AppText>
      </View>
    </Card>
  );
}
