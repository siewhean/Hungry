import { Linking, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { mockRepository, similarityScore } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { findBuildingById } from "@/features/discovery/discovery";

export function DecideForMeResultScreen() {
  const navigation = useNavigation<any>();
  const { spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const selectedDish = useDiscoveryStore((state) => state.decideForMe);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);

  const dish = selectedDish ?? mockRepository.getDecideForMe(profile.tasteVector);

  if (!dish) {
    return (
      <Screen title="Decide for me" subtitle="A single dish picked from nearby options.">
        <EmptyState title="No match found" body="There are no nearby dishes right now." />
      </Screen>
    );
  }

  const venue = mockRepository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);
  const match = Math.max(0, Math.round(similarityScore(profile.tasteVector, dish.tasteVector) * 100));

  return (
    <Screen title="Decide for me" subtitle="One dish picked from nearby options.">
      <View style={{ gap: spacing[4] }}>
        <Card style={{ gap: spacing[3] }}>
          <Image source={{ uri: dish.imageUrl }} style={{ borderRadius: 16, height: 220, width: "100%" }} contentFit="cover" />
          <Badge label={`${match}% match`} tone="orange" />
          <AppText variant="h2">{dish.name}</AppText>
          <AppText tone="secondary">{venue?.name}</AppText>
          <AppText tone="secondary">
            {building?.name}
            {venue ? ` • ${venue.floor} ${venue.unitNumber}` : ""}
          </AppText>
          <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {dish.tasteTags.slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag} tone="amber" />
            ))}
          </View>
        </Card>

        <Button
          label="Order now"
          onPress={() => {
            const link = venue?.deliveryLinks[0];
            if (link) {
              void Linking.openURL(link.nativeUrl || link.webUrl);
            }
          }}
        />
        <Button
          label="Get directions"
          variant="secondary"
          onPress={() => {
            // no backend route in this workstream
          }}
        />
        <Button
          label="Try another"
          variant="ghost"
          onPress={() => {
            const next = mockRepository.getDecideForMe(profile.tasteVector);
            setDecideForMe(next);
          }}
        />
        <Button label="Dismiss" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}

