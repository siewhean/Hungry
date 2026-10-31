import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { StallVisitedSheet } from "@/components/stall/StallVisitedSheet";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = NativeStackScreenProps<RootStackParamList, "StallVisited">;

/**
 * "Visited. What did you have?", presented as a system form sheet over the stall page (grabber,
 * swipe down to dismiss, half and full height). Dismissing any way leaves the visit saved.
 */
export function StallVisitedScreen({ navigation, route }: Props) {
  const { venueId, stallName, dishes } = route.params;
  // Replace, not push: closing the review lands back on the stall, not on this sheet.
  const startReview = (dishId?: string) =>
    navigation.replace("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId, ...(dishId ? { dishId } : {}) },
    });

  return (
    <StallVisitedSheet
      stallName={stallName}
      dishes={dishes}
      onPickDish={(dish) => {
        trackAnalyticsEvent("stall_visited_dish_picked", { stall_id: venueId, dish_id: dish.id });
        startReview(dish.id);
      }}
      onWriteReview={() => startReview()}
      onSkip={() => navigation.goBack()}
    />
  );
}
