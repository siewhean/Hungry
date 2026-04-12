import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Heart, MapPin, Share2, Star, Truck, ChevronLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState, InlineBanner, Screen, FAB, Button, Card } from "@/components/ui";
import { deriveStallCommunityReviews } from "@/features/detail/detailTransforms";
import { mockRepository } from "@/lib/services/mock/repositories";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "../profile/profileGuards";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

export function StallDetailScreen({ navigation, route }: Props) {
  const venueId = route.params?.venueId ?? "";
  const venue = mockRepository.getVenueById(venueId);
  const building = venue ? getBuildingById(venue.buildingId) : undefined;
  const dishes = venue ? mockRepository.listDishesByVenue(venue.id) : [];
  const leadDish = dishes[0];

  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
        <EmptyState title="Stall not found" body="The stall you are looking for does not exist in our current directory." />
      </SafeAreaView>
    );
  }

  const distanceLabel = leadDish
    ? leadDish.distanceMeters > 1000 
      ? `${(leadDish.distanceMeters / 1000).toFixed(1)}km away`
      : `${leadDish.distanceMeters}m away`
    : "Check Map";

  const communityReviews = deriveStallCommunityReviews(dishes);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${venue.name} at ${building?.name ?? "Hungry"}!`,
        url: `https://hungry.sg/stall/${venue.id}`,
      });
    } catch (error) {
      console.error("Sharing failed", error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["left", "right"]}>
      <View style={{ flex: 1 }}>
        <View
          style={[
            styles.topNav,
            {
              backgroundColor: "transparent",
              height: insets.top + 56,
              paddingTop: insets.top,
              paddingHorizontal: spacing[4],
              borderBottomWidth: 0,
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.3)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: 100 }]}
          />
          <Pressable 
            onPress={() => navigation.goBack()}
            style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", ...shadows.floating }]}
          >
            <ChevronLeft color={palette.text} size={24} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable 
            onPress={handleShare}
            style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", ...shadows.floating }]}
          >
            <Share2 color={palette.text} size={20} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* Hero image - 4:3 Ratio */}
          <View style={{ width: screenWidth, height: screenWidth * 0.75, position: "relative" }}>
            <Image
              source={{ uri: leadDish?.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
              colors={["transparent", palette.bg]}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80 }}
            />
            {/* Rating Pill - Floating */}
            <View style={{ position: "absolute", bottom: -spacing[2], right: spacing[4] }}>
              <View style={[{ backgroundColor: palette.amber, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4, ...shadows.floating }]}>
                <Star color="#FFFFFF" fill="#FFFFFF" size={14} />
                <AppText style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{(leadDish?.rating ?? 4.8).toFixed(1)}</AppText>
              </View>
            </View>
          </View>

          <View style={{ gap: spacing[6], paddingHorizontal: spacing[5], paddingTop: spacing[5] }}>
            {/* Header Content */}
            <View style={{ gap: spacing[1] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <MapPin color={palette.orange} size={14} />
                <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700", textTransform: "uppercase" }}>
                  {building?.name ?? "Food Centre"}
                </AppText>
              </View>
              <AppText variant="h1" style={{ fontSize: 28 }}>{venue.name}</AppText>
              <AppText variant="bodyLarge" tone="secondary">{venue.unitNumber} · {distanceLabel}</AppText>
            </View>

            {/* Attributes */}
            <View style={{ flexDirection: "row", gap: spacing[3] }}>
              <Card style={{ flex: 1, padding: spacing[4], gap: 4 }}>
                <AppText variant="micro" tone="secondary" style={{ letterSpacing: 0.5 }}>OPERATING</AppText>
                <AppText variant="bodyLarge" style={{ fontWeight: "700" }}>Open Now</AppText>
                <AppText variant="micro" tone="secondary">{venue.operatingHours.split(" – ")[0]}</AppText>
              </Card>
              <Card style={{ flex: 1, padding: spacing[4], gap: 4 }}>
                <AppText variant="micro" tone="secondary" style={{ letterSpacing: 0.5 }}>HYGIENE</AppText>
                <AppText variant="bodyLarge" style={{ fontWeight: "700" }}>Grade {venue.hygieneGrade}</AppText>
                <AppText variant="micro" tone="secondary">NEA Certified</AppText>
              </Card>
            </View>

            {/* Dishes Grid */}
            <View style={{ gap: spacing[4] }}>
              <AppText variant="h2">Signature Dishes</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                {dishes.map((dish) => (
                  <Pressable
                    key={dish.id}
                    onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                    style={{ width: (screenWidth - spacing[5] * 2 - spacing[3]) / 2 }}
                  >
                    <View style={{ gap: spacing[2] }}>
                      <Image
                        source={{ uri: dish.imageUrl }}
                        style={{ width: "100%", height: 120, borderRadius: radii.lg }}
                        contentFit="cover"
                      />
                      <View style={{ gap: 2 }}>
                        <AppText variant="body" style={{ fontWeight: "700" }} numberOfLines={1}>
                          {dish.name}
                        </AppText>
                        <AppText variant="price" style={{ color: palette.orange }}>
                          {dish.priceRange}
                        </AppText>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Community Reviews */}
            <View style={{ gap: spacing[4] }}>
              <AppText variant="h2">Recent Reviews</AppText>
              {communityReviews.length > 0 ? (
                communityReviews.map((review) => (
                  <View key={review.id} style={styles.communityReview}>
                    <View style={styles.communityUser}>
                      <Image
                        source={{ uri: review.avatarUrl }}
                        style={styles.avatar}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
                        <View style={styles.communityStars}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              color={i < review.rating ? palette.amber : palette.border}
                              fill={i < review.rating ? palette.amber : "transparent"}
                            />
                          ))}
                        </View>
                      </View>
                      <AppText variant="micro" tone="muted">{review.createdAt}</AppText>
                    </View>
                    <AppText variant="bodySmall" tone="secondary" style={{ marginTop: 8 }}>
                      {review.text}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText tone="secondary">No community reviews yet.</AppText>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Floating Save Button */}
        <FAB>
          <Pressable
            onPress={() => {
              if (leadDish) {
                toggleFavourite(leadDish);
              }
            }}
            style={({ pressed }) => [
              { 
                width: 56, 
                height: 56, 
                borderRadius: 28, 
                backgroundColor: palette.orange, 
                alignItems: "center", 
                justifyContent: "center",
                opacity: pressed ? 0.9 : 1,
                ...shadows.floating,
              }
            ]}
          >
            <Heart color="#FFFFFF" fill={profile.favouriteDishIds.includes(leadDish?.id ?? "") ? "#FFFFFF" : "transparent"} />
          </Pressable>
        </FAB>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topNav: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  communityReview: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  communityUser: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  communityStars: {
    flexDirection: "row",
    gap: 2,
  },
});
