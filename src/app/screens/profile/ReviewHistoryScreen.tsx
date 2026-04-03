import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, Card } from "@/components/ui";
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
    <ProfileScreenShell title="Review history" subtitle="Submitted reviews stay visible in the mock profile.">
      {history.map((dish) => (
        <Card key={dish.id}>
          <View style={{ gap: 12 }}>
            <AppText variant="h3">{dish.name}</AppText>
            <AppText tone="secondary">{dish.reviewCount} public reviews on the dish page</AppText>
            <Button label="Write another review" variant="secondary" onPress={() => navigation.navigate("ReviewFlow")} />
          </View>
        </Card>
      ))}
      {!history.length ? <AppText tone="secondary">No review history yet.</AppText> : null}
    </ProfileScreenShell>
  );
}
