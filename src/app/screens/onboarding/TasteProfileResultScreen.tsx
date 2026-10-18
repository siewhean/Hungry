import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";

import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { getOnboardingDishImageSource } from "./onboardingFoodImages";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

const RESULT_COUNT = 4;

export function TasteProfileResultScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const showToast = useUIStore((state) => state.showToast);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);

  // Rank the catalog by the quiz taste vector (and dietary picks) instead of a fixed popular list.
  // Computed once so saving a dish (which nudges the vector) does not reshuffle the grid.
  const [dishes] = useState(() => {
    const { tasteVector, dietaryPreferences } = useProfileStore.getState().profile;
    const repository = getDataRepository();
    const ranked = repository.searchDishes(
      {
        query: "",
        categories: [],
        dietaryFlags: dietaryPreferences,
        tasteValues: tasteVector,
        radius: Number.MAX_SAFE_INTEGER,
      },
      tasteVector,
    );
    return (ranked.length > 0 ? ranked : repository.listPopularNearby()).slice(0, RESULT_COUNT);
  });

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

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing[3],
            justifyContent: "space-between",
          }}
        >
          {dishes.map((dish) => {
            const isSaved = favouriteDishIds.includes(dish.id);
            return (
              <Card
                key={dish.id}
                style={{ borderRadius: radii.md, overflow: "hidden", padding: 0, width: "48%" }}
              >
                <AccessibleImage
                  source={getOnboardingDishImageSource(dish.id)}
                  contentFit="cover"
                  style={{ height: 120, width: "100%" }}
                  accessibilityLabel={`Photo of ${dish.name}`}
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
                      accessibilityLabel={`${isSaved ? "Unsave" : "Save"} ${dish.name}`}
                      accessibilityState={{ selected: isSaved }}
                      accessibilityHint={
                        isAuthenticated
                          ? undefined
                          : "Create or sign in to an account before saving this dish"
                      }
                      onPress={() => {
                        if (isAuthenticated) {
                          toggleFavourite(dish);
                          return;
                        }
                        showToast({
                          message: "Create or sign in to an account before saving dishes.",
                          tone: "warning",
                        });
                        navigation.navigate("OnboardingAuth");
                      }}
                      hitSlop={8}
                      style={{ padding: spacing[1] }}
                    >
                      <Heart
                        color={palette.orange}
                        fill={isSaved ? palette.orange : "transparent"}
                        size={15}
                      />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ padding: spacing[4], paddingBottom: spacing[6] }}>
        <Button
          label="Continue"
          onPress={() => {
            // Location finishes onboarding; completing here would skip it.
            navigation.navigate("LocationPermission");
          }}
        />
      </View>
    </View>
  );
}
