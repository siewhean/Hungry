import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

export function ReviewHistoryScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const history = profile.reviewedDishIds
    .map((dishId) => mockRepository.getDishById(dishId))
    .filter(isDishDetail);

  const openReviewFlow = () => {
    const rootNavigation = (navigation.getParent?.()?.getParent?.() ?? navigation) as any;
    rootNavigation.navigate("ReviewStack", { screen: "ReviewHub" });
  };

  return (
    <ProfileScreenShell title="Review history" subtitle="Submitted reviews stay visible in the mock profile.">
      {history.length ? (
        history.map((dish) => (
          <Card key={dish.id}>
            <View style={{ gap: 12 }}>
              <AppText variant="h3">{dish.name}</AppText>
              <AppText tone="secondary">{dish.reviewCount} public reviews on the dish page</AppText>
              <Button label="Write another review" variant="secondary" onPress={openReviewFlow} />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No reviews yet"
          body="Dishes you review will appear here. Head to any dish page to leave your first review."
          ctaLabel="Back to profile"
          onPress={() => navigation.goBack()}
        />
      )}
    </ProfileScreenShell>
  );
}
