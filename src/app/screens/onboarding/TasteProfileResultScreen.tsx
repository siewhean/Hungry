import type { NavigationProp } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import { getSearchResultsAsync } from "@/features/search/search";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { SearchFilters, TasteVector } from "@/types/domain";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

const RESULT_COUNT = 4;

/** "You lean spicy and rich": the strongest answers above neutral, or null. */
function describeTaste(vector: TasteVector): string | null {
  const leaning = TASTE_DIMENSIONS.filter(
    (dimension) => vector[dimension.key] > NEUTRAL_TASTE_VECTOR[dimension.key],
  )
    .sort((left, right) => vector[right.key] - vector[left.key])
    .slice(0, 2)
    .map((dimension) => dimension.label.toLowerCase());
  if (leaning.length === 0) return "You like your flavours balanced.";
  return `You lean ${leaning.join(" and ")}.`;
}

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
  const savedTasteVector = useProfileStore((state) => state.profile.tasteVector);
  const tasteSummary = hasSkippedTasteQuiz ? null : describeTaste(savedTasteVector);

  useEffect(() => {
    trackOnboardingStepViewed("done");
  }, []);
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
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(() =>
    dishes.length > 0 ? "idle" : "loading",
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retry = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  useEffect(() => {
    if (dishes.length > 0) return;
    let active = true;
    setLoadState("loading");
    const { tasteVector } = useProfileStore.getState().profile;
    void getSearchResultsAsync(getResultFilters(), tasteVector)
      .then((ranked) =>
        ranked.length > 0 ? ranked : getHungryService().discovery.listPopularNearby(),
      )
      .then((results) => {
        if (!active) return;
        setDishes(results.slice(0, RESULT_COUNT));
        setLoadState("idle");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
    // Re-runs only on Retry; a loaded grid is not refetched.
  }, [loadAttempt]);

  // A guest's save tap opens sign-in; the dish is saved once they return signed in.
  const [pendingSaveDish, setPendingSaveDish] = useState<(typeof dishes)[number] | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !pendingSaveDish) return;
    setPendingSaveDish(null);
    if (!useProfileStore.getState().profile.favouriteDishIds.includes(pendingSaveDish.id)) {
      toggleFavourite(pendingSaveDish);
    }
  }, [isAuthenticated, pendingSaveDish, toggleFavourite]);

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
          <AppText variant="h1" accessibilityRole="header">
            {"You're all set"}
          </AppText>
          {tasteSummary ? <AppText variant="bodyBold">{tasteSummary}</AppText> : null}
          <AppText variant="bodySmall" tone="secondary">
            {hasSkippedTasteQuiz
              ? "Here are a few dishes to start with. Take the taste quiz anytime from Profile."
              : dishes.length > 0
                ? "Picked to match your taste. We'll keep ranking Home the same way."
                : "We'll use your taste to rank dishes for you on Home."}
          </AppText>
        </View>

        {loadState === "loading" && dishes.length === 0 ? (
          <View
            accessible
            accessibilityLabel="Loading dishes for you"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[3],
              justifyContent: "space-between",
            }}
          >
            {Array.from({ length: RESULT_COUNT }, (_, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: palette.surfaceRaised,
                  borderRadius: radii.md,
                  height: 180,
                  width: "48%",
                }}
              />
            ))}
          </View>
        ) : null}
        {loadState === "error" && dishes.length === 0 ? (
          <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
            <AppText variant="bodySmall" tone="secondary">
              {"We couldn't load dishes right now. You'll still see picks on Home."}
            </AppText>
            <Button label="Try again" variant="secondary" fullWidth={false} onPress={retry} />
          </View>
        ) : null}

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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${dish.name}`}
                  onPress={() =>
                    navigation
                      .getParent<NavigationProp<RootStackParamList>>()
                      ?.navigate("DishDetail", { dishId: dish.id })
                  }
                >
                  {/* The dish's own photo, or the shared no-photo tile; never a stand-in dish. */}
                  {dish.imageUrl ? (
                    <AccessibleImage
                      source={{ uri: dish.imageUrl }}
                      contentFit="cover"
                      style={{ height: 120, width: "100%" }}
                      accessibilityLabel={`Photo of ${dish.name}`}
                    />
                  ) : (
                    <NoDishPhoto dishName={dish.name} style={{ height: 120, width: "100%" }} />
                  )}
                </Pressable>
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
                        // Sign-in is asked for only when an action needs an account.
                        showToast({
                          message: "Create or sign in to an account before saving dishes.",
                          tone: "warning",
                        });
                        setPendingSaveDish(dish);
                        navigation.navigate("OnboardingAuth");
                      }}
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 44,
                        minWidth: 44,
                      }}
                    >
                      <Heart
                        color={palette.orange}
                        fill={isSaved ? palette.orange : "transparent"}
                        size={18}
                      />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ padding: spacing[4], paddingBottom: insets.bottom + spacing[4] }}>
        <Button
          label="Start exploring"
          onPress={() => {
            // Last step: the only place first-run onboarding completes. RootNavigator
            // then routes Home (or to a pending return route) once, by itself.
            const alreadyCompleted = useSessionStore.getState().hasCompletedOnboarding;
            completeOnboarding(hasSkippedTasteQuiz);
            if (alreadyCompleted) {
              navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
                index: 0,
                routes: [{ name: "MainTabs", params: { screen: "Home" } }],
              });
            }
          }}
        />
      </View>
    </View>
  );
}
