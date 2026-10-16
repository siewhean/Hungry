import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import { dataRepository } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { getOnboardingDishImageSource } from "./onboardingFoodImages";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

export function TasteProfileResultScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const showToast = useUIStore((state) => state.showToast);
  const dishes = dataRepository.listPopularNearby().slice(0, 4);
  // Never fake recommendations: with no catalog dishes the grid section is hidden.
  const hasDishes = dishes.length > 0;

  return (
    <SafeAreaView
      style={{ backgroundColor: palette.bg, flex: 1 }}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ gap: spacing[4], padding: spacing[4], paddingBottom: spacing[12] }}
      >
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h1">Your taste profile is ready</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {hasDishes
              ? "Here are dishes aligned with your current preferences."
              : "We'll use your picks to rank dishes for you once you set your location."}
          </AppText>
        </View>

        {hasDishes ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[3],
              justifyContent: "space-between",
            }}
          >
            {dishes.map((dish) => (
              <Card
                key={dish.id}
                style={{ borderRadius: radii.md, overflow: "hidden", padding: 0, width: "48%" }}
              >
                <AccessibleImage
                  source={getOnboardingDishImageSource(dish.id)}
                  contentFit="cover"
                  transition={150}
                  style={{ backgroundColor: palette.surfaceRaised, height: 120, width: "100%" }}
                  accessibilityLabel={`${dish.name} generated food photo`}
                />
                <View style={{ gap: spacing[1], padding: spacing[2] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <AppText variant="micro" tone="secondary" numberOfLines={1}>
                      {dish.tasteTags.slice(0, 2).join(" · ")}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${dish.name}`}
                      accessibilityHint="Create or sign in to an account before saving this dish"
                      onPress={() => {
                        showToast({
                          message: "Create or sign in to an account before saving dishes.",
                          tone: "warning",
                        });
                        navigation.navigate("OnboardingAuth");
                      }}
                      style={{ padding: spacing[1] }}
                    >
                      <Heart color={palette.orange} size={15} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ padding: spacing[4], paddingBottom: spacing[3] }}>
        <Button
          label="Continue"
          onPress={() => {
            completeOnboarding(hasSkippedTasteQuiz);
            navigation.navigate("LocationPermission");
          }}
        />
      </View>
    </SafeAreaView>
  );
}
