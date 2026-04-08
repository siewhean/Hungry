import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bookmark, Clock3, MapPinned, Share2, Star } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { mockRepository } from "@/lib/services/mock/repositories";
import { AppText, Badge, Button, Card, EmptyState, InlineBanner } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
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
  const venue = mockRepository.getVenueById(route.params?.venueId ?? "");
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showSoftGate = useUIStore((state) => state.showSoftGate);
  const { palette, spacing, radii, shadows } = useHungryTheme();

  if (!venue) {
    return (
      <EmptyState
        title="Stall not found"
        body="This stall could not be found in the current fixture set."
      />
    );
  }

  const dishes = mockRepository.listDishesByVenue(venue.id);
  const building = mockRepository.listBuildings().find((item) => item.id === venue.buildingId);
  const leadDish = dishes[0];
  const deliveryAvailable = venue.deliveryLinks.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 132 }}
        showsVerticalScrollIndicator={false}
      >
        {leadDish?.imageUrl ? (
          <View style={{ position: "relative" }}>
            <Image
              source={{ uri: leadDish.imageUrl }}
              style={{ width: "100%", height: 332 }}
              contentFit="cover"
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(17,24,39,0.24)",
              }}
            />
            <View
              style={{
                position: "absolute",
                top: spacing[4],
                left: spacing[4],
                right: spacing[4],
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <IconButton icon={<ArrowLeft color="#FFFFFF" size={18} />} onPress={() => navigation.goBack()} />
                <IconButton icon={<Bookmark color="#FFFFFF" size={18} />} onPress={() => {}} />
              </View>
              <IconButton icon={<Share2 color="#FFFFFF" size={18} />} onPress={() => {}} />
            </View>
            <View
              style={{
                position: "absolute",
                left: spacing[5],
                right: spacing[5],
                bottom: spacing[5],
                gap: spacing[2],
              }}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                <Badge label={`NEA ${venue.hygieneGrade}`} tone={venue.hygieneGrade === "A" ? "success" : "amber"} />
                <Badge label={venue.isOpen ? "Open now" : "Closed"} tone={venue.isOpen ? "success" : "warning"} />
              </View>
              <AppText variant="h1" tone="inverse">
                {venue.name}
              </AppText>
              <AppText variant="bodySmall" tone="inverse">
                {building?.name ?? "Nearby centre"} · {venue.floor} {venue.unitNumber}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], gap: spacing[5] }}>
          <Card style={[shadows.card, { gap: spacing[3] }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="h3">Before you queue</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {venue.operatingHours}
                </AppText>
              </View>
              <AppText variant="h2" style={{ color: palette.amber }}>
                {leadDish?.priceRange ?? "$$"}
              </AppText>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              <MetaPill icon={<Clock3 color={palette.orange} size={15} />} label={venue.operatingHours} />
              <MetaPill icon={<MapPinned color={palette.orange} size={15} />} label={`${venue.floor} ${venue.unitNumber}`} />
              <MetaPill icon={<Star color={palette.amber} size={15} fill={palette.amber} />} label={`${leadDish?.rating.toFixed(1) ?? "4.8"} rating`} />
            </View>

            {deliveryAvailable ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {venue.deliveryLinks.map((link) => (
                  <Button
                    key={link.platform}
                    label={link.platform === "grabfood" ? "GrabFood" : "foodpanda"}
                    variant="secondary"
                    fullWidth={false}
                    onPress={() =>
                      navigation.navigate("NotFound", {
                        title: "Delivery handoff mocked",
                        body: `This build would open ${link.platform} through native app or web fallback.`,
                      })
                    }
                  />
                ))}
              </View>
            ) : (
              <AppText variant="bodySmall" tone="secondary">
                No verified delivery link yet. This stall is best treated as a dine-in or takeaway stop.
              </AppText>
            )}
          </Card>

          {venue.closureNotice ? <InlineBanner message={venue.closureNotice} tone="warning" /> : null}

          <View style={{ gap: spacing[3] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="micro" tone="accent" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                TASTE PROFILE
              </AppText>
              <AppText variant="h2">What regulars come here for</AppText>
            </View>

            <Card style={{ gap: spacing[3] }}>
              <AppText variant="bodySmall" tone="secondary">
                {leadDish?.name ?? "This stall"} leans into {leadDish?.tasteTags.slice(0, 2).join(" and ") ?? "comfort food"} with a finish that regulars keep saving for repeat visits.
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {(leadDish?.tasteTags ?? []).map((tag) => (
                  <Badge key={tag} label={tag} tone="orange" />
                ))}
              </View>
            </Card>
          </View>

          <View style={{ gap: spacing[3] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="micro" tone="accent" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                SIGNATURE DISHES
              </AppText>
              <AppText variant="h2">Start here</AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3] }}>
              {dishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={{ width: 212 }}
                >
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={{ width: "100%", height: 148 }}
                      contentFit="cover"
                    />
                    <View style={{ padding: spacing[3], gap: spacing[1] }}>
                      <AppText variant="h3" numberOfLines={1}>
                        {dish.name}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                        {dish.tasteTags.slice(0, 2).join(" · ")}
                      </AppText>
                      <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={{ gap: spacing[3] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="micro" tone="accent" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                FROM THE COMMUNITY
              </AppText>
              <AppText variant="h2">What people are saying</AppText>
            </View>

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
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderTopColor: palette.border,
          borderTopWidth: 1,
          bottom: 0,
          flexDirection: "row",
          gap: spacing[2],
          left: 0,
          paddingHorizontal: spacing[5],
          paddingVertical: spacing[3],
          position: "absolute",
          right: 0,
        }}
      >
        <Button
          label="Directions"
          variant="secondary"
          fullWidth={false}
          style={{ flex: 1 }}
          onPress={() =>
            navigation.navigate("NotFound", {
              title: "Directions mocked",
              body: "This action will open Apple Maps or Google Maps in the final build.",
            })
          }
        />
        <Button
          label={deliveryAvailable ? "Order now" : "Write review"}
          fullWidth={false}
          style={{ flex: 1.2 }}
          onPress={() => {
            if (deliveryAvailable) {
              navigation.navigate("NotFound", {
                title: "Delivery handoff mocked",
                body: "This action will open the best delivery or pickup route.",
              });
              return;
            }

            if (!isAuthenticated) {
              setReturnRoute("Review");
              showSoftGate();
              return;
            }

            navigation.navigate("ReviewStack", {
              screen: "ReviewRating",
              params: { venueId: venue.id, dishId: leadDish?.id },
            });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function IconButton({
  icon,
  onPress,
}: {
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(17,24,39,0.38)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </Pressable>
  );
}

function MetaPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#FFF7EE",
      }}
    >
      {icon}
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}
