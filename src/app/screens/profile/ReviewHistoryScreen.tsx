import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

export function ReviewHistoryScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const history = profile.reviewedDishIds
    .map((dishId) => mockRepository.getDishById(dishId))
    .filter(isDishDetail);

  const openReviewFlow = () => {
    const rootNavigation = getRootNavigation(navigation as any);
    rootNavigation.navigate("ReviewStack", { screen: "ReviewHub" });
  };

  return (
    <ProfileScreenShell title="Review history" subtitle="Submitted reviews stay visible in the mock profile.">
      {history.length ? (
        history.map((dish) => {
          const entry = reviewEntries[dish.id];
          const tagSummary = entry?.tags.length ? entry.tags.join(" · ") : "No tags selected";

          return (
            <Card key={dish.id}>
              <View style={{ gap: 12 }}>
                <AppText variant="h3">{dish.name}</AppText>
                <AppText tone="secondary">
                  {entry?.text || "You submitted a quick review for this dish."}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Rated {entry?.rating ?? dish.rating}/5 · {tagSummary}
                </AppText>
                <Button label="Write another review" variant="secondary" onPress={openReviewFlow} />
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState
          title="No reviews yet"
          body="Dishes you review will appear here with your own rating and notes."
          ctaLabel="Write a review"
          onPress={openReviewFlow}
        />
      )}
    </ProfileScreenShell>
  );
}
