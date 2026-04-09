import { useEffect } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { Image } from "expo-image";

import { AppText, Button, Card } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useHungryTheme } from "@/theme";
import { ReviewScreenShell } from "./ReviewScreenShell";
import { ReviewStars } from "./ReviewStars";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewRating">;

export function ReviewRatingScreen({ navigation, route }: Props) {
  const { spacing } = useHungryTheme();
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
    if (routeDishId) {
      selectDish(routeVenueId ?? dish.venueId, routeDishId);
    }
  }, [dish.venueId, routeDishId, routeVenueId, selectDish]);

  return (
    <ReviewScreenShell
      title="Rate the dish"
      subtitle="Start with the overall score before you add the taste notes."
      step={2}
      total={5}
    >
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {dish.imageUrl ? (
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ width: "100%", height: 188 }}
            contentFit="cover"
          />
        ) : null}
        <View style={{ gap: 12, padding: spacing[4] }}>
          <AppText variant="h3">{dish.name}</AppText>
          <AppText tone="secondary">{venue?.name}</AppText>
          <AppText tone="secondary">
            Your rating stays attached to this dish as you move through the rest of the review flow.
          </AppText>
          <ReviewStars value={rating} onChange={setRating} />
          <AppText tone="muted">{rating ? `${rating} / 5 selected` : "Tap a star to continue."}</AppText>
        </View>
      </Card>
      <Button label="Next: taste notes" onPress={() => navigation.navigate("ReviewTags")} disabled={!rating} />
    </ReviewScreenShell>
  );
}
