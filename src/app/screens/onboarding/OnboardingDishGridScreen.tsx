import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Heart } from "lucide-react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button, Card } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { MIN_GRID_LIKES, gridDishes } from "@/features/onboarding/onboardingDeck";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { confirmHaptic, selectHaptic, tapHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { ResultDishPhoto } from "./ResultDishCard";
import { loadOnboardingDishPool } from "./tastePicks";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingDishGrid">;
type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; dishes: DishDetail[] };

/** Screen 14: heart at least three dishes that look good. They are sent as likes after sign-in. */
export function OnboardingDishGridScreen({ navigation }: Props) {
  useOnboardingScreenViewed("dish-grid");
  const { palette, radii, spacing } = useHungryTheme();
  const likedIds = useOnboardingAnswersStore((state) => state.likedDishIds);
  const toggleLikedDish = useOnboardingAnswersStore((state) => state.toggleLikedDish);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadOnboardingDishPool()
      .then((pool) => {
        if (active) setState({ status: "ready", dishes: gridDishes(pool) });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "OnboardingDishGrid", action: "load_dishes" });
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const dishes = state.status === "ready" ? state.dishes : [];
  const likedHere = dishes.filter((dish) => likedIds.includes(dish.id)).length;
  // A short grid (a strict diet) can never reach three hearts, so it must not block the person.
  const needed = Math.min(MIN_GRID_LIKES, dishes.length);
  const canContinue = state.status === "ready" && likedHere >= needed;

  const toggle = (dish: DishDetail) => {
    const adding = !likedIds.includes(dish.id);
    if (adding && likedHere + 1 === needed) confirmHaptic();
    else selectHaptic();
    toggleLikedDish(dish.id);
  };
  const next = () => navigation.navigate(nextOnboardingRoute("OnboardingDishGrid", true));

  return (
    <OnboardingFrame
      screen="dish-grid"
      onBack={() => navigation.goBack()}
      footer={
        <>
          <Button
            label="Continue"
            disabled={!canContinue}
            onPress={() => {
              tapHaptic();
              next();
            }}
          />
          <Button label="Skip for now" variant="ghost" onPress={next} />
        </>
      }
    >
      <MascotLine
        small
        pose="clipboard"
        lineId="dish-grid"
        text="Tap the dishes that make you hungry."
      />
      {state.status === "ready" && needed > 0 ? (
        <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
          {likedHere >= needed ? "Nice picks." : `Pick ${needed - likedHere} more.`}
        </AppText>
      ) : null}

      {state.status === "loading" ? (
        <View
          accessible
          accessibilityLabel="Loading dishes for you"
          style={{ alignItems: "center", padding: spacing[6] }}
        >
          <ActivityIndicator color={palette.orange} />
        </View>
      ) : null}
      {state.status === "error" ? (
        <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary">
            {"We couldn't load dishes right now. You can skip this and still get picks later."}
          </AppText>
          <Button
            label="Try again"
            variant="secondary"
            fullWidth={false}
            onPress={() => setAttempt((count) => count + 1)}
          />
        </View>
      ) : null}
      {state.status === "ready" && dishes.length === 0 ? (
        <AppText variant="bodySmall" tone="secondary">
          No dishes to show yet. More appear on Home as stalls add them.
        </AppText>
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
          const liked = likedIds.includes(dish.id);
          return (
            <Card
              key={dish.id}
              style={{
                borderColor: liked ? palette.orange : "transparent",
                borderRadius: radii.md,
                borderWidth: 2,
                overflow: "hidden",
                padding: 0,
                width: "48%",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${dish.name}${liked ? ", liked" : ""}`}
                accessibilityHint={liked ? "Double tap to remove your like" : "Double tap to like"}
                accessibilityState={{ selected: liked }}
                onPress={() => toggle(dish)}
              >
                <ResultDishPhoto dish={dish} height={110} />
                <View style={{ gap: spacing[1], padding: spacing[2] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.venueName}
                  </AppText>
                </View>
                <View
                  pointerEvents="none"
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.surface,
                    borderRadius: radii.pill,
                    height: 36,
                    justifyContent: "center",
                    position: "absolute",
                    right: spacing[1],
                    top: spacing[1],
                    width: 36,
                  }}
                >
                  <Heart
                    color={palette.orange}
                    fill={liked ? palette.orange : "transparent"}
                    size={18}
                  />
                </View>
              </Pressable>
            </Card>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}
