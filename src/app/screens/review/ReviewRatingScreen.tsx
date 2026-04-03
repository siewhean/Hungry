import { useEffect } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, Card } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { ReviewScreenShell } from "./ReviewScreenShell";
import { ReviewStars } from "./ReviewStars";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewRating">;

export function ReviewRatingScreen({ navigation, route }: Props) {
  const rating = useReviewDraftStore((state) => state.draft.rating);
  const selectedVenueId = useReviewDraftStore((state) => state.draft.selectedVenueId);
  const selectedDishId = useReviewDraftStore((state) => state.draft.selectedDishId);
  const selectDish = useReviewDraftStore((state) => state.selectDish);
  const setRating = useReviewDraftStore((state) => state.setRating);
  const routeDishId = route.params?.dishId;
  const routeVenueId = route.params?.venueId;
  const dish = mockRepository.getDishById(routeDishId ?? selectedDishId ?? "") ?? mockRepository.listPopularNearby()[0];
  const venue = mockRepository.getVenueById(routeVenueId ?? selectedVenueId ?? dish.venueId);

  useEffect(() => {
    if (routeVenueId && routeDishId) {
      selectDish(routeVenueId, routeDishId);
    }
  }, [routeDishId, routeVenueId, selectDish]);

  return (
    <ReviewScreenShell
      title="Rate the dish"
      subtitle="Start with the overall score."
      stepLabel="SCR-070"
    >
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">{dish.name}</AppText>
          <AppText tone="secondary">{venue?.name}</AppText>
          <AppText tone="secondary">Your rating is preserved as you move through the review flow.</AppText>
          <ReviewStars value={rating} onChange={setRating} />
          <AppText tone="muted">{rating ? `${rating} / 5 selected` : "Tap a star to continue."}</AppText>
        </View>
      </Card>
      <Button label="Next" onPress={() => navigation.navigate("ReviewTags")} disabled={!rating} />
      <Button label="Choose another stall" variant="ghost" onPress={() => navigation.navigate("ReviewHub")} />
    </ReviewScreenShell>
  );
}
