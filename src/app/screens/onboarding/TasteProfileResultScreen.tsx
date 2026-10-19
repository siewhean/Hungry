import type { NavigationProp } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getSearchResultsAsync } from "@/features/search/search";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { SearchFilters } from "@/types/domain";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

const RESULT_COUNT = 4;

function getResultFilters(): SearchFilters {
  const { tasteVector, dietaryPreferences } = useProfileStore.getState().profile;
  return {
    query: "",
    categories: [],
    dietaryFlags: dietaryPreferences,
    tasteValues: tasteVector,
    radius: Number.MAX_SAFE_INTEGER,
  };
}

export function TasteProfileResultScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);

  // Rank the catalog by the quiz taste vector (and dietary picks) instead of a fixed popular list.
  // Fetched once so saving a dish (which nudges the vector) does not reshuffle the grid.
  const [dishes, setDishes] = useState(() => {
    const { tasteVector } = useProfileStore.getState().profile;
    const repository = getDataRepository();
    const ranked = repository.searchDishes(getResultFilters(), tasteVector);
    return (ranked.length > 0 ? ranked : repository.listPopularNearby()).slice(0, RESULT_COUNT);
  });

  // The Supabase repository has no cached catalog during onboarding, so ask the server.
  useEffect(() => {
    if (dishes.length > 0) return;
    let active = true;
    const { tasteVector } = useProfileStore.getState().profile;
    void getSearchResultsAsync(getResultFilters(), tasteVector)
      .then((ranked) =>
        ranked.length > 0 ? ranked : getHungryService().discovery.listPopularNearby(),
      )
      .then((results) => {
        if (active) setDishes(results.slice(0, RESULT_COUNT));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Never fake recommendations: with no catalog dishes the grid section is hidden.
  const hasDishes = dishes.length > 0;

  return (
    <View style={{ backgroundColor: palette.bg, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          gap: spacing[4],
          padding: spacing[4],
          paddingBottom: spacing[12],
          paddingTop: insets.top + spacing[4],
        }}
      >
        <OnboardingProgress step="done" />
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h1">{"You're all set"}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {hasSkippedTasteQuiz
              ? "Here are a few dishes to start with. Take the taste quiz anytime from Profile."
              : dishes.length > 0
                ? "Here are dishes aligned with your taste."
                : "We'll use your taste to rank dishes for you on Home."}
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
            {dishes.map((dish) => {
              const isSaved = favouriteDishIds.includes(dish.id);
              return (
                <Card
                  key={dish.id}
                  style={{ borderRadius: radii.md, overflow: "hidden", padding: 0, width: "48%" }}
                >
                  {/* The dish's own photo, or the shared no-photo tile; never a stand-in dish. */}
                  {dish.imageUrl ? (
                    <AccessibleImage
                      source={{ uri: dish.imageUrl }}
                      contentFit="cover"
                      transition={150}
                      style={{ backgroundColor: palette.surfaceRaised, height: 120, width: "100%" }}
                      accessibilityLabel={`Photo of ${dish.name}`}
                    />
                  ) : (
                    <NoDishPhoto dishName={dish.name} style={{ height: 120, width: "100%" }} />
                  )}
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
                            : "Create your account at the end of setup to save this dish"
                        }
                        onPress={() => {
                          if (isAuthenticated) {
                            void toggleFavourite(dish).then((result) => {
                              if (result.status === "failed") {
                                showToast({ message: result.message, tone: "error" });
                              }
                            });
                            return;
                          }
                          // Account creation is the final onboarding step; opening it here
                          // would finish onboarding early and skip the location step.
                          showToast({
                            message: "Create your account at the end of setup to save dishes.",
                            tone: "info",
                          });
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
        ) : null}
      </ScrollView>

      <View style={{ padding: spacing[4], paddingBottom: insets.bottom + spacing[3] }}>
        <Button
          label="Start exploring"
          onPress={() => {
            // Sign-in is required: a signed-out user finishes on the account step,
            // which completes onboarding (with this quiz-skip choice) before auth.
            if (!isAuthenticated) {
              navigation.navigate("OnboardingAuth");
              return;
            }
            // Last step: the only place first-run onboarding completes.
            completeOnboarding(hasSkippedTasteQuiz);
            navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
              index: 0,
              routes: [{ name: "MainTabs", params: { screen: "Home" } }],
            });
          }}
        />
      </View>
    </View>
  );
}
