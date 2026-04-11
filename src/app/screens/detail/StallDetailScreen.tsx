import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Heart, MapPin, Share2, Star, Truck } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState, InlineBanner, Screen, FAB, Button } from "@/components/ui";
import { deriveStallCommunityReviews } from "@/features/detail/detailTransforms";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

function withFallbackSignatureDishes(dishes: DishDetail[], fallbacks: DishDetail[]) {
  const shortlist = [...dishes];
  let idx = 0;
  while (shortlist.length < 4 && idx < fallbacks.length) {
    const candidate = fallbacks[idx];
    if (!shortlist.some((dish) => dish.id === candidate.id)) {
      shortlist.push(candidate);
    }
    idx += 1;
  }
  return shortlist.slice(0, 4);
}

export function StallDetailScreen({ navigation, route }: Props) {
  const venue = mockRepository.getVenueById(route.params?.venueId ?? "");
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  if (!venue) {
    return (
      <Screen scroll={false}>
        <EmptyState
          title="Stall not found"
          body="This stall could not be found in the current fixture set."
        />
      </Screen>
    );
  }

  const dishes = mockRepository.listDishesByVenue(venue.id);
  const leadDish = dishes[0] ?? mockRepository.listPopularNearby()[0];
  const building = mockRepository.listBuildings().find((item) => item.id === venue.buildingId);
  const signatureDishes = withFallbackSignatureDishes(dishes, mockRepository.listPopularNearby());
  const squareTile = screenWidth / 2;
  const distanceKm = Math.max(0.1, ((leadDish?.distanceMeters ?? 500) / 1000));
  const distanceLabel = `${distanceKm.toFixed(1)} km away`;
  const deliveryAvailable = venue.deliveryLinks.length > 0;
  const topBarHeight = insets.top + 56;
  const buildingCoordinate = building?.coordinate;
  const primaryDeliveryLink = venue.deliveryLinks[0];
  const communityReviews = deriveStallCommunityReviews(dishes);
  const isSaved = leadDish ? profile.favouriteDishIds.includes(leadDish.id) : false;

  const openExternal = async (primary: string, fallback?: string) => {
    try {
      await Linking.openURL(primary);
      return;
    } catch {
      if (!fallback) {
        showToast({ message: "Unable to open external link right now.", tone: "warning" });
        return;
      }
    }

    try {
      await Linking.openURL(fallback);
    } catch {
      showToast({ message: "Unable to open external link right now.", tone: "warning" });
    }
  };

  const handleOpenDirections = () => {
    if (!buildingCoordinate) {
      showToast({ message: "Map directions are unavailable for this stall.", tone: "warning" });
      return;
    }

    const query = encodeURIComponent(`${venue.name}, ${building?.name ?? "Singapore"}`);
    const destination = `${buildingCoordinate.latitude},${buildingCoordinate.longitude}`;
    const primary =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${destination}&q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${destination}`;
    const fallback = `https://www.google.com/maps/search/?api=1&query=${query}`;
    void openExternal(primary, fallback);
  };

  const handleOpenDelivery = () => {
    if (!primaryDeliveryLink) {
      showToast({ message: "No delivery link is available for this stall yet.", tone: "info" });
      return;
    }
    void openExternal(primaryDeliveryLink.nativeUrl, primaryDeliveryLink.webUrl);
  };

  const openReviewChoice = () => {
    Alert.alert("Share your review", "Choose how you want to continue.", [
      {
        text: "Quick review",
        onPress: () => {
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
        },
      },
      {
        text: "Post",
        onPress: () => {
          if (!isAuthenticated) {
            setReturnRoute("Post");
            navigation.navigate("AuthStack", { screen: "Login" });
            return;
          }
          navigation.navigate("Post");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${venue.name} · ${building?.name ?? "Hungry"}`,
        message: `Check out ${venue.name} at ${building?.name ?? "this food centre"} (${venue.unitNumber}) on Hungry.`,
      });
    } catch {
      showToast({ message: "Unable to share this stall right now.", tone: "warning" });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["left", "right"]}>
      <View
        style={[
          styles.topNav,
          {
            backgroundColor: "rgba(255,255,255,0.96)",
            height: topBarHeight,
            paddingTop: insets.top,
            paddingHorizontal: spacing[5],
          },
        ]}
      >
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={styles.iconTouch}>
          <ArrowLeft color={palette.navy} size={21} />
        </Pressable>
        <View style={styles.topNavSpacer} />
        {leadDish ? (
          <Pressable
            hitSlop={10}
            onPress={() => {
              if (!isAuthenticated) {
                setReturnRoute({ name: "StallDetail", params: { venueId: venue.id } });
                navigation.navigate("AuthStack", { screen: "Login" });
                return;
              }
              toggleFavourite(leadDish);
              showToast({ message: isSaved ? "Removed from favourites." : "Saved to favourites.", tone: "success" });
            }}
            style={styles.iconTouch}
          >
            <Heart color={palette.navy} fill={isSaved ? palette.navy : "transparent"} size={20} />
          </Pressable>
        ) : null}
        <Pressable
          hitSlop={10}
          onPress={handleShare}
          style={styles.iconTouch}
        >
          <Share2 color={palette.navy} size={20} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[16] + 80, paddingTop: topBarHeight }}
      >
        <View>
          <Image
            source={{ uri: leadDish?.imageUrl }}
            style={{ height: 336, width: "100%" }}
            contentFit="cover"
          />
        </View>

        <View style={[styles.contentWrap, { marginTop: -112, paddingHorizontal: spacing[5] }]}>
          <View
            style={[
              styles.locationBadge,
              {
                backgroundColor: "rgba(232,83,30,0.10)",
                borderColor: "rgba(232,83,30,0.20)",
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: 6,
              },
            ]}
          >
            <MapPin color={palette.orange} size={12} />
            <AppText variant="micro" tone="accent" style={styles.locationText}>
              {(building?.name ?? "Food Centre").toUpperCase()}
            </AppText>
          </View>

          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: spacing[2] }}>
              <AppText variant="display" style={{ color: "#1E1B16" }}>
                {venue.name}
              </AppText>
              <View style={styles.ratingRow}>
                {[0, 1, 2, 3, 4].map((idx) => (
                  <Star
                    key={idx}
                    color={palette.orange}
                    fill={(leadDish?.rating ?? 4.8) >= idx + 1 ? palette.orange : "transparent"}
                    size={14}
                  />
                ))}
                <AppText variant="bodySmall" tone="secondary">
                  {(leadDish?.rating ?? 4.8).toFixed(1)}
                </AppText>
              </View>
            </View>
            <View style={styles.priceBlock}>
              <AppText variant="h1" tone="accent">
                $$
              </AppText>
              <AppText variant="micro" tone="secondary" style={styles.priceLabel}>
                PRICING
              </AppText>
            </View>
          </View>
          {venue.closureNotice ? <InlineBanner message={venue.closureNotice} tone="warning" /> : null}

          <View style={styles.attributeGrid}>
            <Pressable
              onPress={handleOpenDirections}
              style={[
                styles.attributeCard,
                {
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgba(30,27,22,0.08)",
                  borderRadius: 20,
                  padding: 16,
                },
              ]}
            >
              <View style={styles.infoCardHeader}>
                <MapPin color={palette.navy} size={16} />
                <AppText variant="micro" tone="muted" style={styles.attributeLabel}>
                  DISTANCE
                </AppText>
              </View>
              <AppText variant="h3">{distanceLabel}</AppText>
            </Pressable>
            <Pressable
              onPress={deliveryAvailable ? handleOpenDelivery : undefined}
              style={[
                styles.attributeCard,
                {
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgba(30,27,22,0.08)",
                  borderRadius: 20,
                  opacity: deliveryAvailable ? 1 : 0.7,
                  padding: 16,
                },
              ]}
            >
              <View style={styles.infoCardHeader}>
                <Truck color={palette.navy} size={16} />
                <AppText variant="micro" tone="muted" style={styles.attributeLabel}>
                  ORDERING
                </AppText>
              </View>
              <AppText variant="h3" tone={deliveryAvailable ? "accent" : "secondary"}>
                {deliveryAvailable ? "Delivery available" : "Dine-in only"}
              </AppText>
            </Pressable>
          </View>

          <View style={{ gap: spacing[2], paddingTop: spacing[4] }}>
            <AppText variant="micro" tone="muted" style={styles.sectionLabel}>
              OPENING HOURS
            </AppText>
            <View style={styles.hoursRow}>
              <View style={styles.hoursColumn}>
                <AppText variant="h3">Mon - Fri</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {venue.operatingHours}
                </AppText>
              </View>
              <View style={styles.hoursColumn}>
                <AppText variant="h3">Sat - Sun</AppText>
                <AppText variant="bodySmall" tone="secondary" style={{ fontStyle: "italic" }}>
                  Closed
                </AppText>
              </View>
            </View>
          </View>

          <View style={{ gap: spacing[3], paddingTop: spacing[6] }}>
            <View style={styles.sectionHeaderRow}>
              <AppText variant="h1">Signature Dishes</AppText>
              <Pressable
                onPress={() =>
                  navigation.navigate("NotFound", {
                    title: "Menu preview mocked",
                    body: "The full menu route will be linked in production.",
                  })
                }
                style={styles.viewMenuLink}
              >
                <AppText variant="micro" style={styles.viewMenuText}>
                  VIEW FULL MENU
                </AppText>
              </Pressable>
            </View>

            <View style={[styles.signatureGrid, { marginHorizontal: -spacing[5], width: screenWidth }]}>
              {signatureDishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={{ width: squareTile }}
                >
                  <Image source={{ uri: dish.imageUrl }} style={{ height: squareTile, width: "100%" }} contentFit="cover" />
                  <View style={{ gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
                    <AppText variant="h3" numberOfLines={2}>
                      {dish.name}
                    </AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      SGD {dish.price.toFixed(2)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[4], paddingTop: spacing[5] }}>
            <AppText variant="h1">From the Community</AppText>
            {communityReviews.length ? communityReviews.map((review) => (
              <Pressable
                key={review.id}
                onPress={openReviewChoice}
                style={[
                  styles.communityCard,
                  {
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgba(30,27,22,0.05)",
                    borderRadius: 24,
                    padding: spacing[4],
                  },
                ]}
              >
                <View style={styles.communityHeader}>
                  <View style={styles.communityUser}>
                    <Image source={{ uri: review.avatarUrl }} style={styles.avatar} contentFit="cover" />
                    <View>
                      <AppText variant="body">{review.authorName}</AppText>
                      <AppText variant="micro" tone="secondary">
                        {review.role}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.communityStars}>
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <Star
                        key={idx}
                        color={palette.orange}
                        fill={review.rating >= idx + 1 ? palette.orange : "transparent"}
                        size={11}
                      />
                    ))}
                  </View>
                </View>
                <AppText variant="bodySmall" tone="secondary">
                  "{review.text}"
                </AppText>
                <AppText variant="micro" tone="muted">
                  {review.dishName} · {review.createdAt}
                </AppText>
              </Pressable>
            )) : (
              <EmptyState
                title="No reviews yet"
                body="Be the first to add a review for this stall."
              />
            )}
          </View>
        </View>
      </ScrollView>
      <FAB>
        <Button
          fullWidth={false}
          label="Write a review"
          onPress={openReviewChoice}
        />
      </FAB>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topNav: {
    alignItems: "center",
    borderBottomColor: "rgba(30,27,22,0.05)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  iconTouch: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topNavSpacer: {
    flex: 1,
  },
  contentWrap: {
    alignSelf: "center",
    maxWidth: 460,
    width: "100%",
  },
  locationBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
  },
  locationText: {
    fontFamily: "Nunito_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 14,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  priceBlock: {
    alignItems: "flex-end",
    minWidth: 56,
    paddingTop: 6,
  },
  priceLabel: {
    letterSpacing: 1,
  },
  attributeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  attributeCard: {
    borderWidth: 1,
    minHeight: 86,
    width: "48%",
  },
  infoCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  attributeLabel: {
    letterSpacing: 1,
  },
  sectionLabel: {
    letterSpacing: 1,
  },
  hoursRow: {
    flexDirection: "row",
    gap: 28,
  },
  hoursColumn: {
    flex: 1,
    gap: 4,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  viewMenuLink: {
    borderBottomColor: "#E8531E",
    borderBottomWidth: 2,
    paddingBottom: 4,
  },
  viewMenuText: {
    color: "#1E1B16",
    fontFamily: "Nunito_700Bold",
    letterSpacing: 1,
  },
  signatureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  signatureImage: {
    height: "100%",
    width: "100%",
  },
  communityCard: {
    borderWidth: 1,
    gap: 12,
  },
  communityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
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
