import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bookmark,
  Clock3,
  MapPinned,
  Share2,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { mockRepository } from "@/lib/services/mock/repositories";
import { AppText, Button, EmptyState } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

const MOCK_REVIEWS = [
  {
    id: "review-stall-1",
    name: "Priya Lakshmi",
    role: "Top Contributor",
    rating: 5,
    text: "One of the most consistent stalls in the centre. The queue moves quickly and the flavour stays reliable.",
  },
  {
    id: "review-stall-2",
    name: "Marcus Tan",
    role: "Local Guide",
    rating: 4,
    text: "A good lunch option when you want something filling without spending too much time deciding.",
  },
] as const;

export function StallDetailScreen({ navigation, route }: Props) {
  const venue = mockRepository.getVenueById(route.params?.venueId ?? "");
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

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

  const descriptor = leadDish?.tasteTags.slice(0, 2).join(" and ").toLowerCase() ?? "local comfort food";
  const contentWidth = Math.min(screenWidth - spacing[5] * 2, 420);
  const useSingleColumnMeta = contentWidth < 360;
  const twoColumnWidth = (contentWidth - spacing[3]) / 2;
  const infoBlockWidth = useSingleColumnMeta ? contentWidth : twoColumnWidth;
  const infoBlocks = [
    {
      icon: <ShieldCheck color={palette.navy} size={18} />,
      label: "Hygiene grade",
      value: `NEA ${venue.hygieneGrade}`,
    },
    {
      icon: (
        <View
          style={{
            alignItems: "center",
            borderRadius: radii.pill,
            height: 18,
            justifyContent: "center",
            width: 18,
          }}
        >
          <View
            style={{
              backgroundColor: venue.isOpen ? palette.success : palette.error,
              borderRadius: radii.pill,
              height: 8,
              width: 8,
            }}
          />
        </View>
      ),
      label: "Status",
      value: venue.isOpen ? "Open now" : "Closed",
    },
    {
      icon: <MapPinned color={palette.navy} size={18} />,
      label: "Location",
      value: `${venue.floor} ${venue.unitNumber}`,
    },
    {
      icon: <Truck color={palette.navy} size={18} />,
      label: "Ordering",
      value: deliveryAvailable ? "Delivery available" : "Dine-in only",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        <View>
          <Image
            source={{ uri: leadDish?.imageUrl }}
            style={{ height: 304, width: "100%" }}
            contentFit="cover"
          />
          <View
            style={{
              backgroundColor: "rgba(17,24,39,0.18)",
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              left: spacing[4],
              position: "absolute",
              right: spacing[4],
              top: spacing[4],
            }}
          >
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <IconButton
                icon={<ArrowLeft color="#FFFFFF" size={18} />}
                onPress={() => navigation.goBack()}
              />
              <IconButton
                icon={<Bookmark color="#FFFFFF" size={18} />}
                onPress={() =>
                  showToast({ message: "Saving stalls will be added to profile soon.", tone: "info" })
                }
              />
            </View>
            <IconButton
              icon={<Share2 color="#FFFFFF" size={18} />}
              onPress={() =>
                showToast({ message: "Sharing is mocked in this build.", tone: "info" })
              }
            />
          </View>
        </View>

        <View
          style={{
            alignSelf: "center",
            gap: spacing[5],
            maxWidth: 460,
            paddingHorizontal: spacing[5],
            paddingTop: spacing[5],
            width: "100%",
          }}
        >
          <View style={{ gap: spacing[2] }}>
            <View
              style={{
                alignItems: "flex-start",
                gap: spacing[2],
              }}
            >
              <View style={{ gap: spacing[1] }}>
                <AppText variant="h1" numberOfLines={2}>
                  {venue.name}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {building?.name ?? "Nearby food centre"}
                </AppText>
              </View>
              <AppText variant="price">{leadDish?.priceRange ?? "S$4.50 - S$7.00"}</AppText>
            </View>

            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <Star color={palette.amber} fill={palette.amber} size={15} />
              <AppText variant="bodySmall">
                {(leadDish?.rating ?? 4.7).toFixed(1)} · {leadDish?.reviewCount ?? 312} reviews
              </AppText>
            </View>

            <AppText
              variant="body"
              tone="secondary"
              style={{ fontStyle: "italic" }}
            >
              Known for {descriptor}, with a queue that moves fast enough to stay worth the walk.
            </AppText>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            {infoBlocks.map((item) => (
              <View
                key={item.label}
                style={{
                  backgroundColor: palette.bgSoft,
                  borderRadius: radii.lg,
                  gap: spacing[2],
                  minHeight: 112,
                  padding: spacing[4],
                  width: infoBlockWidth,
                }}
              >
                {item.icon}
                <AppText variant="bodySmall" tone="muted">
                  {item.label}
                </AppText>
                <AppText variant="body">{item.value}</AppText>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              gap: spacing[2],
              padding: spacing[4],
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <Clock3 color={palette.navy} size={18} />
              <AppText variant="h3">Opening hours</AppText>
            </View>
            <AppText variant="body">{venue.operatingHours}</AppText>
            {venue.closureNotice ? (
              <AppText variant="bodySmall" tone="secondary">
                {venue.closureNotice}
              </AppText>
            ) : null}
          </View>

          <View style={{ gap: spacing[3] }}>
            <AppText variant="h2">Signature dishes</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {dishes.slice(0, 4).map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={{
                    backgroundColor: palette.surface,
                    borderRadius: radii.lg,
                    overflow: "hidden",
                    width: twoColumnWidth,
                  }}
                >
                  <Image
                    source={{ uri: dish.imageUrl }}
                    style={{ height: 132, width: "100%" }}
                    contentFit="cover"
                  />
                  <View style={{ gap: spacing[1], padding: spacing[3] }}>
                    <AppText variant="body" numberOfLines={1}>
                      {dish.name}
                    </AppText>
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                      {dish.tasteTags.slice(0, 2).join(" · ")}
                    </AppText>
                    <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[3] }}>
            <AppText variant="h2">From the community</AppText>
            {MOCK_REVIEWS.map((review) => (
              <View
                key={review.id}
                style={[
                  shadows.card,
                  {
                    backgroundColor: palette.surface,
                    borderRadius: radii.lg,
                    gap: spacing[3],
                    padding: spacing[4],
                  },
                ]}
              >
                <View
                  style={{
                    alignItems: "flex-start",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing[3],
                  }}
                >
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <AppText variant="body">{review.name}</AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      {review.role}
                    </AppText>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <Star color={palette.amber} fill={palette.amber} size={13} />
                    <AppText variant="bodySmall">{review.rating}.0</AppText>
                  </View>
                </View>
                <AppText variant="bodySmall" tone="secondary">
                  {review.text}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          left: 0,
          paddingBottom: Math.max(insets.bottom, spacing[4]),
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
          position: "absolute",
          right: 0,
          bottom: 0,
        }}
      >
        <View style={{ alignSelf: "center", flexDirection: "row", gap: spacing[2], maxWidth: 460, width: "100%" }}>
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
                setReturnRoute({
                  name: "ReviewStack",
                  params: {
                    screen: "ReviewRating",
                    params: { venueId: venue.id, dishId: leadDish?.id },
                  },
                });
                navigation.navigate("AuthStack", { screen: "Login" });
                return;
              }

              navigation.navigate("ReviewStack", {
                screen: "ReviewRating",
                params: { venueId: venue.id, dishId: leadDish?.id },
              });
            }}
          />
        </View>
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
        alignItems: "center",
        backgroundColor: "rgba(17,24,39,0.34)",
        borderRadius: 22,
        height: 44,
        justifyContent: "center",
        width: 44,
      }}
    >
      {icon}
    </Pressable>
  );
}
