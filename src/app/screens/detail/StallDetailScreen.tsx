import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { mockRepository } from "@/lib/services/mock/repositories";
import { AppText, Badge, Button, Card, EmptyState, InlineBanner, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

const MOCK_REVIEWS = [
  {
    id: "review-stall-1",
    name: "Priya Lakshmi",
    role: "Top Contributor",
    avatar: "PL",
    rating: 5,
    text: "One of the most consistent stalls in the hawker centre. The flavours are always spot on and the queue moves quickly.",
  },
  {
    id: "review-stall-2",
    name: "Marcus Tan",
    role: "Local Guide",
    avatar: "MT",
    rating: 4,
    text: "Solid option for a quick lunch. Portions are generous and the uncle running the stall is always friendly.",
  },
] as const;

export function StallDetailScreen({ navigation, route }: Props) {
  const venue = mockRepository.getVenueById(route.params.venueId);
  const { palette, spacing, radii } = useHungryTheme();

  if (!venue) {
    return (
      <EmptyState
        title="Stall not found"
        body="This stall could not be found in the current fixture set."
      />
    );
  }

  const dishes = mockRepository.listDishesByVenue(venue.id);

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Image ── */}
        {dishes[0]?.imageUrl && (
          <Image
            source={{ uri: dishes[0].imageUrl }}
            style={{ width: "100%", height: 280 }}
            contentFit="cover"
          />
        )}

        <View style={{ paddingHorizontal: spacing[5], gap: spacing[5], marginTop: spacing[5] }}>
          {/* ── Header Section ── */}
          <View style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="display" style={{ fontWeight: "bold", flex: 1 }}>
                {venue.name}
              </AppText>
              <AppText variant="h2" style={{ color: palette.amber }}>
                $$
              </AppText>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
              <AppText variant="body" tone="accent">
                {dishes[0]?.rating ?? "4.8"} {"★"}
              </AppText>
              <AppText variant="bodySmall" tone="accent">
                (Michelin Bib Gourmand)
              </AppText>
            </View>
          </View>

          {/* ── Description Quote ── */}
          <AppText
            variant="bodyLarge"
            tone="secondary"
            style={{ fontStyle: "italic" }}
          >
            A hawker stall that has earned its reputation through decades of consistency, drawing
            queues that speak louder than any accolade.
          </AppText>

          {/* ── Closure Notice ── */}
          {venue.closureNotice ? (
            <InlineBanner message={venue.closureNotice} tone="warning" />
          ) : null}

          {/* ── Info Pills Grid ── */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            {[
              { label: "UMAMI INTENSITY", value: "High" },
              { label: "TEXTURE PROFILE", value: "Springy & Crisp" },
              { label: "KEY NOTE", value: "Smoky Truffle" },
              { label: "WAIT TIME", value: "25\u201340 min" },
            ].map((info) => (
              <Card
                key={info.label}
                style={{
                  width: "47%",
                  padding: spacing[3],
                }}
              >
                <AppText variant="micro" tone="secondary" style={{ textTransform: "uppercase" }}>
                  {info.label}
                </AppText>
                <AppText variant="body">{info.value}</AppText>
              </Card>
            ))}
          </View>

          {/* ── View Taste Profile Button ── */}
          <Button
            label="VIEW TASTE PROFILE"
            onPress={() =>
              navigation.navigate("NotFound", {
                title: "Taste Profile",
                body: "The full taste radar chart will render here.",
              })
            }
          />

          {/* ── Opening Hours ── */}
          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Opening Hours</AppText>
            <View style={{ gap: spacing[1] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="body" tone="secondary">
                  Mon {"\u2013"} Fri
                </AppText>
                <AppText variant="body">{venue.operatingHours}</AppText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="body" tone="secondary">
                  Sat {"\u2013"} Sun
                </AppText>
                <AppText variant="body">{venue.operatingHours}</AppText>
              </View>
            </View>
          </View>

          {/* ── Signature Dishes ── */}
          <View style={{ gap: spacing[3] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <AppText variant="h3">Signature Dishes</AppText>
              <AppText variant="bodySmall" tone="accent">
                VIEW FULL MENU
              </AppText>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {dishes.map((dish) => (
                <Card
                  key={dish.id}
                  style={{ width: "47%", padding: 0, overflow: "hidden" }}
                >
                  <Image
                    source={{ uri: dish.imageUrl }}
                    style={{
                      width: "100%",
                      height: 110,
                      borderTopLeftRadius: radii.md,
                      borderTopRightRadius: radii.md,
                    }}
                    contentFit="cover"
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="bodySmall" numberOfLines={1}>
                      {dish.name}
                    </AppText>
                    <AppText variant="price" tone="accent">
                      SGD {dish.price.toFixed(2)}
                    </AppText>
                  </View>
                </Card>
              ))}
            </View>
          </View>

          {/* ── From the Community ── */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">From the Community</AppText>

            {MOCK_REVIEWS.map((review) => (
              <Card key={review.id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: palette.orangeLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <AppText variant="bodySmall" tone="accent">
                      {review.avatar}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{review.name}</AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                      <Badge label={review.role} tone="neutral" />
                      <AppText variant="bodySmall" tone="accent">
                        {"★".repeat(review.rating)}
                      </AppText>
                    </View>
                  </View>
                </View>
                <AppText variant="bodySmall" tone="secondary">
                  {review.text}
                </AppText>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
