import type { NavigationProp } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { flushPendingDishSave, rememberPendingDishSave } from "@/features/auth/pendingDishSave";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { DishDetail, SearchFilters } from "@/types/domain";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { describeTaste, matchesAllDietaryFlags, noDietaryPicksMessage } from "./resultPicks";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

const RESULT_COUNT = 4;

// Local catalog search only (mock, or a cached catalog): no radius limit.
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

// Server picks start near the user and widen until there are enough dishes.
const TASTE_PICK_RADII_METERS = [3000, 10000, undefined];

/** Dishes ranked by the quiz taste vector on the server (get_taste_recommendations). */
async function loadTastePicks(): Promise<DishDetail[]> {
  const { tasteVector, dietaryPreferences } = useProfileStore.getState().profile;
  const { coordinate, isApproximate } = getEffectiveLocation(useLocationStore.getState());
  const location = isApproximate ? undefined : coordinate;
  let picks: DishDetail[] = [];
  for (const radiusMeters of location ? TASTE_PICK_RADII_METERS : [undefined]) {
    const slate = await getHungryService().recommendations.getSlate({
      surface: "home",
      tasteProfile: tasteVector,
      dietaryFlags: dietaryPreferences,
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusMeters,
      limit: RESULT_COUNT,
    });
    picks = slate.items.map((item) => item.dish);
    if (picks.length >= RESULT_COUNT) break;
  }
  return picks;
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
  const [initialPicks] = useState(() => {
    const { tasteVector, dietaryPreferences } = useProfileStore.getState().profile;
    const repository = getDataRepository();
    const ranked = repository.searchDishes(getResultFilters(), tasteVector);
    // The popular fallback must respect the diet too: a halal user never sees a non-halal dish here.
    return ranked.length > 0
      ? { dishes: ranked.slice(0, RESULT_COUNT), tasteRanked: true }
      : {
          dishes: repository
            .listPopularNearby()
            .filter((dish) => matchesAllDietaryFlags(dish, dietaryPreferences))
            .slice(0, RESULT_COUNT),
          tasteRanked: false,
        };
  });
  const [dishes, setDishes] = useState(initialPicks.dishes);
  // "Picked to match your taste" only when the list really is taste-ranked.
  const [tasteRanked, setTasteRanked] = useState(initialPicks.tasteRanked);
  // True when the diet left nothing to show, so the screen says so instead of looking broken.
  const [noDietaryMatch, setNoDietaryMatch] = useState(false);

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
    const { dietaryPreferences } = useProfileStore.getState().profile;
    void loadTastePicks()
      .then(async (picks) =>
        picks.length > 0
          ? { results: picks, ranked: true }
          : {
              results: (await getHungryService().discovery.listPopularNearby()).filter((dish) =>
                matchesAllDietaryFlags(dish, dietaryPreferences),
              ),
              ranked: false,
            },
      )
      .then(({ results, ranked }) => {
        if (!active) return;
        setDishes(results.slice(0, RESULT_COUNT));
        setTasteRanked(ranked);
        setNoDietaryMatch(results.length === 0 && dietaryPreferences.length > 0);
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

  // A guest's save tap opens sign-in. The dish is kept on the device and saved once
  // sign-in or email verification finishes, even after this screen unmounts:
  // applySignedInProfile does that on Supabase; mock sign-in does not run it.
  useEffect(() => {
    if (isAuthenticated && getServiceProvider().mode === "mock") void flushPendingDishSave();
  }, [isAuthenticated]);

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
              : dishes.length > 0 && tasteRanked
                ? "Picked to match your taste. We'll keep ranking Home the same way."
                : dishes.length > 0
                  ? "Popular dishes to start with. We'll use your taste to rank Home."
                  : noDietaryMatch
                    ? noDietaryPicksMessage(useProfileStore.getState().profile.dietaryPreferences)
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
                  onPress={() => {
                    navigation
                      .getParent<NavigationProp<RootStackParamList>>()
                      ?.navigate("DishDetail", { dishId: dish.id });
                    // Opening a dish is leaving the flow: if the app is closed while the user
                    // browses, the next launch must not start onboarding again. Done after
                    // navigating, so the root navigator sees DishDetail on top and stays put.
                    completeOnboarding(hasSkippedTasteQuiz);
                  }}
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
                        rememberPendingDishSave(dish);
                        navigation.navigate("OnboardingAuth", { dishName: dish.name });
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
