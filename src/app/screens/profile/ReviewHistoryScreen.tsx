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

  return (
    <ProfileScreenShell title="Review history" subtitle="Dishes you've reviewed.">
      {history.length ? (
        history.map((dish) => (
          <Card key={dish.id}>
            <View style={{ gap: 12 }}>
              <AppText variant="h3">{dish.name}</AppText>
              <AppText tone="secondary">{dish.reviewCount} public reviews on the dish page</AppText>
              <Button
                label="Write another review"
                variant="secondary"
                onPress={() => navigation.navigate("ReviewFlow")}
              />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No reviews yet"
          body="Dishes you review will appear here. Head to any dish page to leave your first review."
          ctaLabel="Explore dishes"
          onPress={() => navigation.goBack()}
        />
      )}
    </ProfileScreenShell>
  );
}
