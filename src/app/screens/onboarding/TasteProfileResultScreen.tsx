import type { NavigationProp } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button } from "@/components/ui";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  flushPendingDishSave,
  forgetPendingDishSave,
  getPendingDishSaveIds,
  rememberPendingDishSave,
} from "@/features/auth/pendingDishSave";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
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
import {
  OnboardingProgress,
  trackOnboardingPicksShown,
  trackOnboardingStepViewed,
} from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { DishPreviewSheet } from "./DishPreviewSheet";
import { ResultDishCard } from "./ResultDishCard";
import { resultDistanceLabel } from "./resultDistance";
import { buildResultPicks, fewDietaryPicksMessage, type ResultPick } from "./fillResultPicks";
import { loadTastePicks } from "./tastePicks";
import { describeTaste, noDietaryPicksMessage } from "./resultPicks";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

// The first-picks grid: four plain cards (control) or six with stall, price and distance (test).
const RESULT_COUNT_CONTROL = 4;
const RESULT_COUNT_DETAILED = 6;
// Local catalog search only (mock, or a cached catalog): no radius limit.
function getResultFilters(): SearchFilters {
  const { tasteVector, dietaryPreferences, maxDishBudget } = useProfileStore.getState().profile;
  return {
    query: "",
    categories: [],
    dietaryFlags: dietaryPreferences,
    tasteValues: tasteVector,
    radius: Number.MAX_SAFE_INTEGER,
    maxPrice: maxDishBudget,
  };
}

export function TasteProfileResultScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  // The CTA is on screen from first render, so a signed-out user is exposed on mount.
  const framing = useExperimentVariant("onboarding_account_framing_v1", {
    enabled: !isAuthenticated,
  });
  const payoff = useExperimentVariant("onboarding_result_payoff_v1", {
    enabled: !isAuthenticated,
  });
  const detailed = payoff === "test";
  const resultCount = detailed ? RESULT_COUNT_DETAILED : RESULT_COUNT_CONTROL;
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const savedTasteVector = useProfileStore((state) => state.profile.tasteVector);
  const dietaryPreferences = useProfileStore((state) => state.profile.dietaryPreferences);
  const tasteSummary = hasSkippedTasteQuiz ? null : describeTaste(savedTasteVector);

  useEffect(() => {
    trackOnboardingStepViewed("done");
  }, []);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);

  // Rank the catalog by the quiz taste vector (and dietary picks) instead of a fixed popular list,
  // then top up with popular dishes nearby so the grid is never a lone card.
  // Fetched once so saving a dish (which nudges the vector) does not reshuffle the grid.
  // Supabase has no cached catalog during onboarding: searching it would only start a
  // full catalog download, so go straight to the server picks below.
  const [initialPicks] = useState(() => {
    if (getServiceProvider().mode === "supabase") {
      return { picks: [] as ResultPick<DishDetail>[] };
    }
    const { tasteVector, dietaryPreferences, maxDishBudget } = useProfileStore.getState().profile;
    const repository = getDataRepository();
    return {
      picks: buildResultPicks({
        ranked: repository.searchDishes(getResultFilters(), tasteVector),
        // The popular top-up must respect the diet and budget too (buildResultPicks checks both).
        popular: repository.listPopularNearby(),
        count: resultCount,
        dietaryFlags: dietaryPreferences,
        maxDishBudget,
      }),
    };
  });
  const [picks, setPicks] = useState(initialPicks.picks);
  const dishes = picks.map((pick) => pick.dish);
  // "Picked to match your taste" only when the list really has taste-ranked dishes.
  const tasteRanked = picks.some((pick) => !pick.popular);
  // True when the diet left nothing to show, so the screen says so instead of looking broken.
  const [noDietaryMatch, setNoDietaryMatch] = useState(false);
  // A guest's hearts: kept on the device and saved after sign-up, shown filled meanwhile.
  const [pendingSaveIds, setPendingSaveIds] = useState(getPendingDishSaveIds);
  const [previewDish, setPreviewDish] = useState<DishDetail | null>(null);

  // How far each stall is from the user, from the stall's own pin (never the stored column).
  const distanceLabelFor = useCallback((dish: DishDetail) => {
    const { coordinate, isApproximate } = getEffectiveLocation(useLocationStore.getState());
    if (isApproximate) return undefined;
    return resultDistanceLabel(coordinate, dish, (venueId) =>
      getDataRepository().getVenueById(venueId),
    );
  }, []);

  // What the grid showed, once per screen: lets the funnel see taste-ranked vs fallback picks.
  const picksTrackedRef = useRef(false);
  const trackPicksOnce = useCallback((tracked: Parameters<typeof trackOnboardingPicksShown>[0]) => {
    if (picksTrackedRef.current) return;
    picksTrackedRef.current = true;
    trackOnboardingPicksShown(tracked);
  }, []);
  useEffect(() => {
    if (initialPicks.picks.length === 0) return;
    const ranked = initialPicks.picks.some((pick) => !pick.popular);
    trackPicksOnce({
      ranked,
      count: initialPicks.picks.length,
      source: ranked ? "local" : "popular",
    });
  }, [initialPicks, trackPicksOnce]);

  // The Supabase repository has no cached catalog during onboarding, so ask the server.
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(() =>
    initialPicks.picks.length > 0 ? "idle" : "loading",
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retry = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  useEffect(() => {
    if (initialPicks.picks.length > 0 && loadAttempt === 0) return;
    let active = true;
    setLoadState("loading");
    const { dietaryPreferences, maxDishBudget } = useProfileStore.getState().profile;
    void loadTastePicks(resultCount)
      .then(async (ranked) => {
        const matches = buildResultPicks({
          ranked,
          popular: [],
          count: resultCount,
          dietaryFlags: dietaryPreferences,
          maxDishBudget,
        });
        if (matches.length >= resultCount) return matches;
        // Too few taste matches (or none): fill the rest with popular dishes nearby.
        const popular = await getHungryService().discovery.listPopularNearby();
        return buildResultPicks({
          ranked,
          popular,
          count: resultCount,
          dietaryFlags: dietaryPreferences,
          maxDishBudget,
        });
      })
      .then((results) => {
        if (!active) return;
        setPicks(results);
        setNoDietaryMatch(results.length === 0 && dietaryPreferences.length > 0);
        setLoadState("idle");
        const ranked = results.some((pick) => !pick.popular);
        trackPicksOnce({
          ranked,
          count: results.length,
          source: ranked ? "server" : "popular",
        });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "TasteProfileResult", action: "load_picks" });
        if (!active) return;
        setLoadState("error");
        trackPicksOnce({ ranked: false, count: 0, source: "error" });
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

  const toggleSave = (dish: DishDetail) => {
    const isSaved = isAuthenticated
      ? favouriteDishIds.includes(dish.id)
      : pendingSaveIds.includes(dish.id);
    if (isAuthenticated) {
      void toggleFavourite(dish).then((result) => {
        if (result.status === "failed") {
          showToast({ message: result.message, tone: "error" });
        }
      });
      return;
    }
    // Account creation is the step after this one. The dishes are kept
    // on the device and saved once sign-in finishes (main H6).
    if (isSaved) {
      forgetPendingDishSave(dish.id);
      setPendingSaveIds(getPendingDishSaveIds());
      return;
    }
    rememberPendingDishSave(dish);
    setPendingSaveIds(getPendingDishSaveIds());
    showToast({
      message: `We'll save ${dish.name} once you create your account.`,
      tone: "info",
    });
  };

  const openDish = (dish: DishDetail) => {
    navigation.getParent<NavigationProp<RootStackParamList>>()?.navigate("DishDetail", {
      dishId: dish.id,
    });
    // Opening a dish is leaving the flow: if the app is closed while the user
    // browses, the next launch must not start onboarding again. Done after
    // navigating, so the root navigator sees DishDetail on top and stays put.
    completeOnboarding(hasSkippedTasteQuiz);
  };

  return (
    <View style={{ backgroundColor: palette.bg, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          gap: spacing[4],
          padding: spacing[4],
          paddingBottom: spacing[12],
          paddingTop: insets.top + spacing[2],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityHint="Goes back to change an answer"
          onPress={() => navigation.goBack()}
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            borderRadius: radii.pill,
            height: 44,
            justifyContent: "center",
            marginLeft: -spacing[2],
            width: 44,
          }}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
        <OnboardingProgress step="done" />
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h1" accessibilityRole="header">
            {/* Setup is not done until the account exists, so a guest sees "first picks". */}
            {isAuthenticated ? "You're all set" : "Your first picks"}
          </AppText>
          {tasteSummary ? <AppText variant="bodyBold">{tasteSummary}</AppText> : null}
          <AppText variant="bodySmall" tone="secondary">
            {hasSkippedTasteQuiz
              ? "Here are a few dishes to start with. Take the taste quiz anytime from Profile."
              : dishes.length > 0 && tasteRanked
                ? "Picked to match your taste."
                : dishes.length > 0
                  ? "Popular dishes to start with."
                  : noDietaryMatch
                    ? noDietaryPicksMessage(dietaryPreferences)
                    : "Dishes that match your taste will show up here."}
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
            {Array.from({ length: resultCount }, (_, index) => (
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
          {picks.map(({ dish, popular }) => {
            const isSaved = isAuthenticated
              ? favouriteDishIds.includes(dish.id)
              : pendingSaveIds.includes(dish.id);
            // Signed in, a card opens the dish. Signed out, the pre-auth navigator has no
            // DishDetail, so the payoff design opens a read-only preview instead.
            const onOpen = isAuthenticated
              ? () => openDish(dish)
              : detailed
                ? () => setPreviewDish(dish)
                : undefined;
            return (
              <ResultDishCard
                key={dish.id}
                dish={dish}
                details={detailed}
                distanceLabel={detailed ? distanceLabelFor(dish) : undefined}
                popular={popular}
                isSaved={isSaved}
                saveHint={
                  isAuthenticated
                    ? undefined
                    : "Saved once you create your account at the end of setup"
                }
                onOpen={onOpen}
                openLabel={isAuthenticated ? `Open ${dish.name}` : `Preview ${dish.name}`}
                onToggleSave={() => toggleSave(dish)}
              />
            );
          })}
        </View>
        {dietaryPreferences.length > 0 && dishes.length > 0 && dishes.length < resultCount ? (
          <AppText variant="bodySmall" tone="muted">
            {fewDietaryPicksMessage(dietaryPreferences, dishes.length)}
          </AppText>
        ) : null}
      </ScrollView>

      <DishPreviewSheet
        dish={previewDish}
        distanceLabel={previewDish ? distanceLabelFor(previewDish) : undefined}
        isSaved={previewDish ? pendingSaveIds.includes(previewDish.id) : false}
        onToggleSave={() => previewDish && toggleSave(previewDish)}
        onClose={() => setPreviewDish(null)}
      />

      <View style={{ padding: spacing[4], paddingBottom: insets.bottom + spacing[4] }}>
        <Button
          // With no picks on screen (load error, nothing fits the diet) there is nothing to save.
          label={
            !isAuthenticated && framing === "test" && dishes.length > 0
              ? "Save my picks"
              : "Start exploring"
          }
          onPress={() => {
            // Sign-in is required: a signed-out user finishes on the account step,
            // which completes onboarding (with this quiz-skip choice) before auth.
            if (!isAuthenticated) {
              navigation.navigate("OnboardingAuth");
              return;
            }
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
