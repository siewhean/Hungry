import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { mockRepository } from "@/lib/services/mock/repositories";
import { AppText, Badge, Button, Card, EmptyState, InlineBanner, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

export function StallDetailScreen({ navigation, route }: Props) {
  const venue = mockRepository.getVenueById(route.params.venueId);
  const { spacing } = useHungryTheme();

  if (!venue) {
    return <EmptyState title="Stall not found" body="This stall could not be found in the current fixture set." />;
  }

  const dishes = mockRepository.listDishesByVenue(venue.id);
  const building = mockRepository.listBuildings().find((item) => item.id === venue.buildingId);

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[8] }}>
        <View style={{ gap: spacing[3] }}>
          <Badge label={`NEA grade ${venue.hygieneGrade}`} tone={venue.hygieneGrade === "A" ? "success" : "warning"} />
          <AppText variant="h1">{venue.name}</AppText>
          <AppText tone="secondary">
            {building?.name} · {venue.floor} · {venue.unitNumber}
          </AppText>
          <AppText tone="secondary">{venue.operatingHours}</AppText>
        </View>

        {venue.closureNotice ? <InlineBanner message={venue.closureNotice} tone="warning" /> : null}

        <Card>
          <AppText variant="h3">Delivery and directions</AppText>
          {venue.deliveryLinks.length ? (
            <View style={{ gap: spacing[3] }}>
              {venue.deliveryLinks.map((link) => (
                <Button
                  key={link.platform}
                  label={link.platform === "grabfood" ? "Order on GrabFood" : "Order on Foodpanda"}
                  onPress={() =>
                    navigation.navigate("NotFound", {
                      title: "Delivery handoff mocked",
                      body: `This build would open ${link.platform} from here.`,
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="Dine-in only"
              body="No verified delivery link is available for this stall yet."
              ctaLabel="Get directions"
              onPress={() =>
                navigation.navigate("NotFound", {
                  title: "Directions handoff mocked",
                  body: "The final app will open Apple Maps or Google Maps here.",
                })
              }
            />
          )}
        </Card>

        <Card>
          <AppText variant="h3">Dishes sold here</AppText>
          <View style={{ gap: spacing[3] }}>
            {dishes.map((dish) => (
              <Button
                key={dish.id}
                label={`${dish.name} · ${dish.priceRange}`}
                onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                variant="secondary"
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

