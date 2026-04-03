import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const dishes = profile.favouriteDishIds.map((dishId) => mockRepository.getDishById(dishId)).filter(isDishDetail);

  return (
    <ProfileScreenShell title="Favourites" subtitle="Saved dishes that shape your taste profile.">
      {dishes.length ? (
        dishes.map((dish) => (
          <Card key={dish.id}>
            <View style={{ gap: 12 }}>
              <AppText variant="h3">{dish.name}</AppText>
              <AppText tone="secondary">{dish.priceRange}</AppText>
              <AppText tone="secondary">{dish.tasteTags.join(" • ")}</AppText>
              <Button label="Remove favourite" variant="secondary" onPress={() => toggleFavourite(dish)} />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No favourites yet"
          body="The list fills up once the detail flow is wired in. This screen already keeps the profile layout ready."
          ctaLabel="Back to profile"
          onPress={() => navigation.goBack()}
        />
      )}
    </ProfileScreenShell>
  );
}
