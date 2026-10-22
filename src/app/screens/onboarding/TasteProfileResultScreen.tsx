import { selectOnboardingRecommendations } from "@/features/onboarding/recommendationPreview";
import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import { getSearchResultsAsync } from "@/features/search/search";
import type { DishDetail, SearchFilters } from "@/types/domain";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { useOnboardingDraftStore } from "@/features/onboarding/useOnboardingDraftStore";
import { fulfillPendingOnboardingSave } from "@/features/onboarding/fulfillPendingSave";

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
  const showToast = useUIStore((state) => state.showToast);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);

  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const draft = useOnboardingDraftStore((state) => state.draft);
  const preferenceKey = JSON.stringify([
    draft?.values,
    draft?.dietaryPreferences,
    draft?.maxDishBudget,
  ]);
  const pendingDishId = useOnboardingDraftStore((state) => state.draft?.pendingSaveDishId);
  useEffect(() => {
    let active = true;
    setLoadState("loading");
    const profile = useProfileStore.getState().profile;
    void getSearchResultsAsync(getResultFilters(), profile.tasteVector)
      .then((results) => {
        const matches = selectOnboardingRecommendations(results, profile, RESULT_COUNT);
        if (active) {
          setDishes(matches.slice(0, RESULT_COUNT));
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [attempt, preferenceKey]);

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
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h1">Your taste profile is ready</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {dishes.length > 0
              ? "Here are dishes aligned with your current preferences."
              : "We'll use it to rank dishes for you on Home."}
          </AppText>
        </View>

        {loadState === "loading" ? (
          <AppText accessibilityLiveRegion="polite">Finding dishes for your preferences…</AppText>
        ) : null}
        {loadState === "error" ? (
          <View style={{ gap: spacing[2] }}>
            <AppText>Couldn&apos;t load recommendations. Your preferences are saved.</AppText>
            <Button
              label="Retry recommendations"
              onPress={() => setAttempt((value) => value + 1)}
            />
          </View>
        ) : null}
        {loadState === "ready" && dishes.length === 0 ? (
          <AppText>
            No dishes currently match all your dietary and budget preferences. You can continue and
            adjust your preferences later.
          </AppText>
        ) : null}
        {isAuthenticated && pendingDishId ? (
          <Button
            label="Retry saving selected dish"
            onPress={() => {
              void fulfillPendingOnboardingSave().catch(() =>
                showToast({ message: "Couldn't save this dish. Try again.", tone: "error" }),
              );
            }}
          />
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
                <AccessibleImage
                  source={{ uri: dish.imageUrl }}
                  contentFit="cover"
                  style={{ height: 120, width: "100%" }}
                  accessibilityLabel={`Photo of ${dish.name}`}
                />
                <View style={{ gap: spacing[1], padding: spacing[2] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {dish.venueName}
                  </AppText>
                  <AppText variant="bodySmall">
                    {dish.price > 0 ? `$${dish.price.toFixed(2)}` : "Price unavailable"}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${dish.name} details`}
                    onPress={() =>
                      navigation
                        .getParent<NavigationProp<RootStackParamList>>()
                        ?.navigate("DishDetail", { dishId: dish.id })
                    }
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <AppText tone="accent">View dish</AppText>
                  </Pressable>
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
                        useOnboardingDraftStore.getState().update({ pendingSaveDishId: dish.id });
                        showToast({
                          message: "Create or sign in to an account before saving dishes.",
                          tone: "warning",
                        });
                        navigation.navigate("OnboardingAuth");
                      }}
                      hitSlop={8}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
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
