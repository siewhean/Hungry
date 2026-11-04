import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { StallVisitedSheet, type VisitedSheetDish } from "@/components/stall/StallVisitedSheet";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { toDisplayName } from "@/features/detail/stallDisplayName";
import { pickVisitedSheetDishes } from "@/features/detail/stallVisited";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";

type Props = NativeStackScreenProps<RootStackParamList, "StallVisited">;

/**
 * "Visited. What did you have?", presented as a system form sheet over the stall page (grabber,
 * swipe down to dismiss, half and full height). Dismissing any way leaves the visit saved.
 * Only the stall id arrives as a param; the sheet reads the stall's name and menu itself.
 */
export function StallVisitedScreen({ navigation, route }: Props) {
  const { venueId } = route.params;
  const reviewedDishIds = useProfileStore((state) => state.profile.reviewedDishIds);
  const [loaded, setLoaded] = useState<{ stallName: string; dishes: VisitedSheetDish[] }>();

  useEffect(() => {
    let active = true;
    const discovery = getHungryService().discovery;
    // One venue read and one menu read, side by side; a failed read shows the sheet with no dishes.
    void Promise.all([discovery.getVenue(venueId), discovery.listDishesByVenue(venueId)])
      .then(([venue, menu]) => {
        if (!active) return;
        setLoaded({
          stallName: toDisplayName(venue?.name ?? "this stall"),
          dishes: pickVisitedSheetDishes(menu, reviewedDishIds).map((dish) => ({
            id: dish.id,
            name: dish.name,
            priceLabel: formatDishPrice(dish),
          })),
        });
      })
      .catch((error) => {
        reportError(error, { screen: "StallVisited", action: "load_dishes" });
        if (active) setLoaded({ stallName: "this stall", dishes: [] });
      });
    return () => {
      active = false;
    };
  }, [reviewedDishIds, venueId]);

  // Replace, not push: closing the review lands back on the stall, not on this sheet.
  const startReview = (dishId?: string) =>
    navigation.replace("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId, ...(dishId ? { dishId } : {}) },
    });

  return (
    <StallVisitedSheet
      loading={!loaded}
      stallName={loaded?.stallName ?? ""}
      dishes={loaded?.dishes ?? []}
      onPickDish={(dish) => {
        trackAnalyticsEvent("stall_visited_dish_picked", { stall_id: venueId, dish_id: dish.id });
        startReview(dish.id);
      }}
      onWriteReview={() => startReview()}
      onSkip={() => navigation.goBack()}
    />
  );
}
