import { Alert, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Share2, Star, Truck } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, EmptyState } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

const COMMUNITY_REVIEWS = [
  {
    id: "review-stall-1",
    name: "Marcus Lim",
    role: "Verified Foodie",
    rating: 5,
    text: "The potato-wrapped prawns are life-changing. Perfectly crispy and the ramen noodles have that incredible springy texture you only find in high-end joints.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop",
  },
  {
    id: "review-stall-2",
    name: "Sarah Chen",
    role: "Epicurean Member",
    rating: 4,
    text: "Modern hawker food at its best. The truffle aroma is subtle but present. Long queue but absolutely worth the wait during lunch hour.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&fit=crop",
  },
] as const;

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
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing } = useHungryTheme();
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
  const leadDish = dishes[0] ?? mockRepository.listPopularNearby()[0];
  const building = mockRepository.listBuildings().find((item) => item.id === venue.buildingId);
  const signatureDishes = withFallbackSignatureDishes(dishes, mockRepository.listPopularNearby());
  const contentWidth = screenWidth - spacing[5] * 2;
  const squareTile = (contentWidth - 4) / 2;
  const distanceKm = Math.max(0.1, ((leadDish?.distanceMeters ?? 500) / 1000));
  const distanceLabel = `${distanceKm.toFixed(1)} km away`;
  const quote =
    "A pioneering interpretation of the classic Singaporean wonton noodle, elevated through Japanese ramen techniques and a commitment to artisanal assembly.";
  const deliveryAvailable = venue.deliveryLinks.length > 0;
  const topBarHeight = insets.top + 56;

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
          <ArrowLeft color={palette.navy} size={18} />
        </Pressable>
        <View style={styles.topNavSpacer} />
        <Pressable
          hitSlop={10}
          onPress={() => showToast({ message: "Sharing is mocked in this build.", tone: "info" })}
          style={styles.iconTouch}
        >
          <Share2 color={palette.navy} size={17} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[12], paddingTop: topBarHeight }}
      >
        <View>
          <Image
            source={{ uri: leadDish?.imageUrl }}
            style={{ height: 336, width: "100%" }}
            contentFit="cover"
          />
          <View pointerEvents="none" style={styles.heroFadeOverlay}>
            <View style={styles.heroFadeTint} />
            <View style={styles.heroFadeMid} />
            <View style={styles.heroFadeStrong} />
            <View style={styles.heroFadeBase} />
          </View>
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
                  {(leadDish?.rating ?? 4.8).toFixed(1)} (Michelin Bib Gourmand)
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

          <AppText variant="bodyLarge" tone="secondary" style={styles.quoteText}>
            "{quote}"
          </AppText>

          <View style={styles.attributeGrid}>
            <View
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
            </View>
            <View
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
                <Truck color={palette.navy} size={16} />
                <AppText variant="micro" tone="muted" style={styles.attributeLabel}>
                  ORDERING
                </AppText>
              </View>
              <AppText variant="h3" tone={deliveryAvailable ? "accent" : "secondary"}>
                {deliveryAvailable ? "Delivery available" : "Dine-in only"}
              </AppText>
            </View>
          </View>

          <View style={{ gap: spacing[4], paddingTop: spacing[4] }}>
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

          <View style={{ gap: spacing[3], paddingTop: spacing[4] }}>
            <Button
              label="Get directions"
              variant="secondary"
              onPress={() => {
                const dest = encodeURIComponent(`${building?.name ?? venue.name}, Singapore`);
                Linking.openURL(`https://maps.google.com/?q=${dest}`);
              }}
            />
            {deliveryAvailable
              ? venue.deliveryLinks.map((link) => (
                  <Button
                    key={link.platform}
                    label={link.platform === "grabfood" ? "Order on GrabFood" : "Order on Foodpanda"}
                    onPress={() => Linking.openURL(link.nativeUrl).catch(() => Linking.openURL(link.webUrl))}
                  />
                ))
              : null}
          </View>

          <View style={{ gap: spacing[3], paddingTop: spacing[4] }}>
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

            <View style={styles.signatureGrid}>
              {signatureDishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={{ width: squareTile, height: squareTile }}
                >
                  <Image source={{ uri: dish.imageUrl }} style={styles.signatureImage} contentFit="cover" />
                  <View style={styles.signatureOverlay} />
                  <View style={[styles.signatureCaption, { padding: spacing[3] }]}>
                    <AppText variant="h3" tone="inverse" numberOfLines={2}>
                      {dish.name}
                    </AppText>
                    <AppText variant="bodySmall" tone="inverse">
                      SGD {dish.price.toFixed(2)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[4], paddingTop: spacing[5] }}>
            <AppText variant="h1">From the Community</AppText>
            {COMMUNITY_REVIEWS.map((review) => (
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
                    <Image source={{ uri: review.avatar }} style={styles.avatar} contentFit="cover" />
                    <View>
                      <AppText variant="body">{review.name}</AppText>
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
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
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
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  topNavSpacer: {
    flex: 1,
  },
  heroFadeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFadeTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,248,242,0.08)",
  },
  heroFadeMid: {
    backgroundColor: "rgba(255,248,242,0.28)",
    bottom: 0,
    height: "52%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  heroFadeStrong: {
    backgroundColor: "rgba(255,248,242,0.58)",
    bottom: 0,
    height: "34%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  heroFadeBase: {
    backgroundColor: "#FFF8F2",
    bottom: 0,
    height: "20%",
    left: 0,
    position: "absolute",
    right: 0,
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
  quoteText: {
    color: "#5A4139",
    fontStyle: "italic",
    lineHeight: 33,
    marginTop: 8,
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
    gap: 4,
  },
  signatureImage: {
    height: "100%",
    width: "100%",
  },
  signatureOverlay: {
    backgroundColor: "rgba(0,0,0,0.38)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  signatureCaption: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
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
