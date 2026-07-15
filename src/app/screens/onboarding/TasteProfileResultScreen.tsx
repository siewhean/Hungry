import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";

import { AccessibleImage, AppText, Button, Card, EmptyState } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { getOnboardingDishImageSource } from "./onboardingFoodImages";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

export function TasteProfileResultScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const showToast = useUIStore((state) => state.showToast);
  const profile = useProfileStore((state) => state.profile);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const service = getHungryService();
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    void service.discovery
      .searchDishes(
        {
          query: "",
          categories: [],
          dietaryFlags: profile.dietaryPreferences,
          tasteValues: profile.tasteVector,
          radius: 5000,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        profile.tasteVector,
      )
      .then((results) => {
        if (active) setDishes(results.slice(0, 4).map((result) => result.dish));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDishes([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Taste recommendations are temporarily unavailable.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    currentLocation.latitude,
    currentLocation.longitude,
    loadAttempt,
    profile.dietaryPreferences,
    profile.tasteVector,
    service,
  ]);

  return (
    <View style={{ backgroundColor: palette.bg, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ gap: spacing[4], padding: spacing[4], paddingBottom: spacing[12] }}
      >
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h1">Your taste profile is ready</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Here are dishes aligned with your current preferences.
          </AppText>
        </View>

        {isLoading ? (
          <View accessibilityLabel="Loading taste recommendations" accessibilityRole="progressbar">
            <ActivityIndicator color={palette.orange} />
          </View>
        ) : loadError ? (
          <EmptyState
            title="Recommendations unavailable"
            body={loadError}
            ctaLabel="Try again"
            onPress={() => setLoadAttempt((attempt) => attempt + 1)}
          />
        ) : (
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
                  style={{ height: 120, width: "100%" }}
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
        )}
      </ScrollView>

      <View style={{ padding: spacing[4], paddingBottom: spacing[6] }}>
        <Button
          label="Continue"
          onPress={() => {
            completeOnboarding(hasSkippedTasteQuiz);
            navigation.navigate("LocationPermission");
          }}
        />
      </View>
    </View>
  );
}
