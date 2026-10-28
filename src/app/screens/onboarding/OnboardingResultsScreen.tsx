import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button, Card } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { dishReasonChips } from "@/features/onboarding/dishFit";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { resultDishes } from "@/features/onboarding/onboardingDeck";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { tapHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { ResultDishPhoto } from "./ResultDishCard";
import { resultDistanceLabel } from "./resultDistance";
import { loadOnboardingDishPool } from "./tastePicks";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingResults">;
type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; dishes: DishDetail[] };

/** Screen 20: the three best fits, each with the reason it was picked. */
export function OnboardingResultsScreen({ navigation }: Props) {
  useOnboardingScreenViewed("results");
  const { palette, radii, spacing } = useHungryTheme();
  const tasteVector = useProfileStore((state) => state.profile.tasteVector);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadOnboardingDishPool()
      .then((pool) => {
        if (!active) return;
        const { likedDishIds, passedDishIds } = useOnboardingAnswersStore.getState();
        setState({
          status: "ready",
          dishes: resultDishes(pool, { liked: likedDishIds, passed: passedDishIds }),
        });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "OnboardingResults", action: "load_dishes" });
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const dishes = state.status === "ready" ? state.dishes : [];
  const distanceFor = (dish: DishDetail) => {
    const { coordinate, isApproximate } = getEffectiveLocation(useLocationStore.getState());
    if (isApproximate) return undefined;
    return resultDistanceLabel(coordinate, dish, (venueId) =>
      getDataRepository().getVenueById(venueId),
    );
  };

  return (
    <OnboardingFrame
      screen="results"
      onBack={() => navigation.goBack()}
      footer={
        <Button
          label="Continue"
          onPress={() => {
            tapHaptic();
            navigation.navigate(nextOnboardingRoute("OnboardingResults", true));
          }}
        />
      }
    >
      <MascotLine
        pose="celebrate"
        lineId="results"
        text={
          dishes.length > 0 ? "Here is what I would eat first." : "Your picks will show up on Home."
        }
      />
      {state.status === "loading" ? (
        <View
          accessible
          accessibilityLabel="Loading your picks"
          style={{ alignItems: "center", padding: spacing[6] }}
        >
          <ActivityIndicator color={palette.orange} />
        </View>
      ) : null}
      {state.status === "error" ? (
        <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary">
            {"We couldn't load dishes right now. You'll still see picks on Home."}
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
          Nothing fits your diet and budget near you yet. More appear on Home as stalls add them.
        </AppText>
      ) : null}

      {dishes.map((dish) => {
        const reasons = dishReasonChips(dish.tasteVector, tasteVector);
        const price = formatDishPrice(dish);
        const detail = [
          dish.venueName,
          price === "Price not listed" ? undefined : price,
          distanceFor(dish),
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Card key={dish.id} style={{ borderRadius: radii.lg, overflow: "hidden", padding: 0 }}>
            <ResultDishPhoto dish={dish} height={150} />
            <View style={{ gap: spacing[1], padding: spacing[3] }}>
              <AppText variant="h2" numberOfLines={2}>
                {dish.name}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                {detail}
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
                {(reasons.length > 0 ? reasons : ["Popular near you"]).map((reason) => (
                  <View
                    key={reason}
                    style={{
                      backgroundColor: palette.orangeLight,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="micro">{reason}</AppText>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        );
      })}
    </OnboardingFrame>
  );
}
