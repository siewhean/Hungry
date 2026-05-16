import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { ColorValue } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Bookmark,
  Clock3,
  CheckCircle,
  MapPin,
  MessageCircleMore,
  MessageCircle,
  Send,
  Sparkles,
  Star,
  Utensils,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useSocialStore } from "@/store/useSocialStore";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { AppText, Button, EmptyState, FeedErrorBoundary } from "@/components/ui";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import type { DishDetail } from "@/types/domain";

const CommentIcon = MessageCircle ?? MessageCircleMore;

type ListedHoursRow = {
  days: string;
  hours: string;
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayName = (typeof DAY_ORDER)[number];

function normalizeDay(day: string): DayName {
  const normalized = day.trim().toLowerCase();
  switch (normalized) {
    case "mon":
    case "monday":
      return "Mon";
    case "tue":
    case "tues":
    case "tuesday":
      return "Tue";
    case "wed":
    case "wednesday":
      return "Wed";
    case "thu":
    case "thursday":
      return "Thu";
    case "fri":
    case "friday":
      return "Fri";
    case "sat":
    case "saturday":
      return "Sat";
    case "sun":
    case "sunday":
      return "Sun";
    default:
      return "Mon";
  }
}

function expandDayRange(start: DayName, end: DayName): DayName[] {
  const startIndex = DAY_ORDER.indexOf(start);
  const endIndex = DAY_ORDER.indexOf(end);
  if (startIndex === -1 || endIndex === -1) return [start];

  if (startIndex <= endIndex) {
    return DAY_ORDER.slice(startIndex, endIndex + 1);
  }

  return [...DAY_ORDER.slice(startIndex), ...DAY_ORDER.slice(0, endIndex + 1)];
}

function parseListedHours(raw: string): ListedHoursRow[] {
  const cleaned = raw.trim().replace(/\u2013|\u2014/g, "-");
  if (!cleaned) return [];

  const normalized = cleaned.replace(/\s{2,}/g, " ");
  const segments = normalized
    .split(/;|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const rows: ListedHoursRow[] = [];
  const fallback = () => rows.push({ days: "All days", hours: normalized });

  const dayRangeRegex =
    /^(?<startDay>Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*-\s*(?<endDay>Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?<hours>.+)$/i;
  const daySingleRegex = /^(?<day>Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?<hours>.+)$/i;

  for (const segment of segments) {
    const rangeMatch = segment.match(dayRangeRegex);
    if (rangeMatch?.groups) {
      const days = expandDayRange(
        normalizeDay(rangeMatch.groups.startDay),
        normalizeDay(rangeMatch.groups.endDay),
      );
      days.forEach((day) => rows.push({ days: day, hours: rangeMatch.groups!.hours }));
      continue;
    }

    const singleMatch = segment.match(daySingleRegex);
    if (singleMatch?.groups) {
      rows.push({ days: normalizeDay(singleMatch.groups.day), hours: singleMatch.groups.hours });
      continue;
    }

    const lowerSegment = segment.toLowerCase();
    if (lowerSegment.startsWith("open") || lowerSegment.startsWith("closed")) {
      rows.push({ days: "All days", hours: segment });
      continue;
    }

    if (rows.length === 0) {
      fallback();
      return rows;
    }
  }

  return rows.length ? rows : [{ days: "All days", hours: normalized }];
}

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail" | "DishDetailV2">;

type Attribute = {
  label: string;
  value: string;
  helper: string;
};

function getDominantTaste(dish: DishDetail) {
  return TASTE_DIMENSIONS.reduce(
    (best, dimension) => {
      const score = dish.tasteVector[dimension.key] ?? 0;
      return score > best.score ? { label: dimension.label, score } : best;
    },
    { label: TASTE_DIMENSIONS[0]?.label ?? "Taste", score: 0 },
  );
}

function formatWaitTime(liveCrowd?: "low" | "medium" | "high") {
  if (liveCrowd === "high") return "25-40 min";
  if (liveCrowd === "medium") return "15-25 min";
  if (liveCrowd === "low") return "< 15 min";
  return null;
}

function formatBasePrice(price: number) {
  return `S$${price.toFixed(2)}`;
}

function getSignatureDishes(currentDish: DishDetail, venueDishes: DishDetail[]) {
  const byId = new Map<string, DishDetail>();
  [currentDish, ...venueDishes].forEach((dish) => {
    byId.set(dish.id, dish);
  });
  return Array.from(byId.values()).slice(0, 4);
}

export function DishDetailScreenV2({ navigation, route }: Props) {
  const repository = getDataRepository();
  const dishId = route.params?.dishId ?? route.params?.id ?? "";
  const dish = repository.getDishById(dishId);
  const { colorScheme, componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const addReviewedDish = useProfileStore((state) => state.addReviewedDish);
  const removeReviewedDish = useProfileStore((state) => state.removeReviewedDish);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const stallInteraction = dish?.venueId ? stallInteractions[dish.venueId] : undefined;
  const markTried = useStallInteractionStore((state) => state.markTried);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [tasteProfileOpen, setTasteProfileOpen] = useState(false);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const lastRecordedDishViewId = useRef<string | null>(null);
  const [isTryingFood, setIsTryingFood] = useState(false);

  const venue = useMemo(
    () => (dish ? repository.getVenueById(dish.venueId) : undefined),
    [dish, repository],
  );

  const gallery = useMemo(() => (dish ? buildDishGallery(dish) : []), [dish]);
  const heroImage = gallery[0] ?? dish?.imageUrl;
  const tasteMatch = useMemo(
    () => (dish ? getTasteSimilarityWithDish(profile, dish) : 0),
    [dish, profile],
  );
  const venueDishes = useMemo(
    () => (dish ? repository.listDishesByVenue(dish.venueId) : []),
    [dish, repository],
  );
  const signatureDishes = useMemo(
    () => (dish ? getSignatureDishes(dish, venueDishes) : []),
    [dish, venueDishes],
  );
  const listedHours = useMemo(() => (venue ? parseListedHours(venue.operatingHours) : []), [venue]);

  useEffect(() => {
    if (!dish || lastRecordedDishViewId.current === dish.id) return;
    lastRecordedDishViewId.current = dish.id;
    void getHungryService().discovery.recordDishView(dish.id, {
      userId: isAuthenticated ? profile.id : undefined,
    });
  }, [dish, isAuthenticated, profile.id]);

  if (!dish || !venue || !heroImage) {
    return (
      <FeedErrorBoundary
        title="Dish details unavailable"
        body="Couldn't load this dish - try again."
      >
        <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["top"]}>
          <EmptyState
            title="Dish not found"
            body="This dish is no longer available in the current dataset."
            errorMessage={`Missing dish data for ID: ${dishId || "unknown"}`}
            sendErrorContext="Dish detail"
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const dominantTaste = getDominantTaste(dish);
  const isSaved = profile.favouriteDishIds.includes(dish.id);
  const waitTime = formatWaitTime(venue.liveCrowd ?? dish.liveCrowd);
  const attributes: Attribute[] = [
    {
      label: "Taste Intensity",
      value: `${dominantTaste.score}/10`,
      helper: dominantTaste.label,
    },
    {
      label: "Texture Profile",
      value: dish.tasteTags[0] ?? "Signature",
      helper: dish.tasteTags[1] ?? "House style",
    },
    {
      label: "Key Note",
      value: dish.tasteTags[2] ?? dominantTaste.label,
      helper: `${tasteMatch}% match`,
    },
    ...(waitTime
      ? [
          {
            label: "Wait Time",
            value: waitTime,
            helper: venue.isOpen ? "Open now" : "Closed now",
          },
        ]
      : []),
  ];
  const heroHeight = Math.min(Math.max(width * 1.12, 420), 530);
  const cardWidth = (width - spacing[4] * 2 - spacing[3]) / 2;
  const signatureGridItemWidth = width / 2;
  const signatureGridItemHeight = signatureGridItemWidth * 1.5;
  const reviewIconSize = 22;
  const canonicalDishUrl = `https://hungry.sg/dish/${dish.id}`;
  const heroGradientColors: readonly [ColorValue, ColorValue, ColorValue] =
    colorScheme === "dark"
      ? [`${palette.bg}00`, `${palette.bg}B3`, palette.bg]
      : ["rgba(255,255,255,0)", "rgba(255,255,255,0.72)", palette.bg];
  const headerButtonBackground =
    colorScheme === "dark" ? palette.surface : "rgba(255, 255, 255, 0.88)";
  const headerButtonBorder = colorScheme === "dark" ? palette.border : "rgba(226, 232, 240, 0.78)";
  const shareReviewTarget = {
    reviewId: `dish-${dish.id}`,
    postId: dish.id,
    title: dish.name,
    subtitle: `${venue.name} · ${venue.unitNumber}`,
    imageUrl: gallery[0] ?? dish.imageUrl,
    authorName: profile.displayName,
    message: `${dish.name} at ${venue.name}. ${formatBasePrice(dish.price)}. ${tasteMatch}% taste match.`,
    link: canonicalDishUrl,
  };

  const openShareSheet = () => {
    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      setReturnRoute({
        name: "DishDetailV2",
        params: { dishId: dish.id },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    toggleFavourite(dish);
    showToast({
      message: isSaved ? "Removed from favourites." : "Saved to favourites!",
      tone: "success",
    });
  };

  const handleReview = () => {
    if (!isAuthenticated) {
      setReturnRoute({
        name: "ReviewStack",
        params: {
          screen: "ReviewMain",
          params: { venueId: dish.venueId, dishId: dish.id },
        },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: dish.venueId, dishId: dish.id },
    });
  };

  const isDishTried = profile.reviewedDishIds.includes(dish.id);
  const isVenueVisited = stallInteraction?.isTried ?? false;

  const handleTryFood = async () => {
    if (isTryingFood) return;

    if (!isAuthenticated) {
      setReturnRoute({
        name: "DishDetailV2",
        params: { dishId: dish.id },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    setIsTryingFood(true);
    try {
      const didMark = await markTried(profile.id, dish.venueId);

      if (didMark.isTried) {
        addReviewedDish(dish.id);
        showToast({
          message:
            didMark.pointsAwarded > 0
              ? "+5 Food Cred"
              : isVenueVisited
                ? "Marked as tried again."
                : "Marked this stall as visited.",
          tone: "success",
          backgroundColor: palette.surfaceTranslucent,
          borderColor: palette.orange,
          textColor: palette.text,
          iconColor: palette.text,
          borderWidth: 1,
          duration: 3000,
        });
      } else {
        removeReviewedDish(dish.id);
        await useFoodCredStore
          .getState()
          .adjustPoints(-didMark.pointsAwarded, dish.venueId, "stall_marked_tried");
        showToast({
          message: didMark.pointsAwarded > 0 ? "-5 Food Cred" : "Food try check removed.",
          tone: "success",
          backgroundColor: palette.surfaceTranslucent,
          borderColor: palette.orange,
          textColor: palette.text,
          iconColor: palette.text,
          borderWidth: 1,
          duration: 3000,
        });
      }
    } finally {
      setIsTryingFood(false);
    }
  };

  return (
    <FeedErrorBoundary title="Dish details unavailable" body="Couldn't load this dish - try again.">
      <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
          >
            <View style={{ height: heroHeight }}>
              <Image source={{ uri: heroImage }} contentFit="cover" style={{ flex: 1 }} />
              <LinearGradient
                colors={heroGradientColors}
                locations={[0, 0.58, 1]}
                style={{ bottom: 0, height: 260, left: 0, position: "absolute", right: 0 }}
              />
            </View>

            <View
              style={{
                gap: spacing[5],
                marginTop: -spacing[12],
                paddingHorizontal: spacing[4],
              }}
            >
              <View style={{ gap: spacing[4] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${venue.name} stall details`}
                  onPress={() => navigation.navigate("StallDetail", { venueId: dish.venueId })}
                  hitSlop={8}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View
                    style={[
                      {
                        alignItems: "center",
                        alignSelf: "flex-start",
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        flexDirection: "row",
                        gap: spacing[1],
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[1.5],
                      },
                      shadows.card,
                    ]}
                  >
                    <MapPin color={palette.orange} size={16} />
                    <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                      {venue.name} - {venue.unitNumber}
                    </AppText>
                  </View>
                </Pressable>

                <View
                  style={{
                    alignItems: "flex-start",
                    flexDirection: "row",
                    gap: spacing[3],
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, gap: spacing[2] }}>
                    <View
                      style={{
                        alignItems: "flex-start",
                        flexDirection: "row",
                        gap: spacing[3],
                        justifyContent: "space-between",
                      }}
                    >
                      <AppText variant="h1" style={{ flex: 1, fontSize: 28, lineHeight: 34 }}>
                        {dish.name}
                      </AppText>
                      <AppText
                        variant="price"
                        style={{ color: palette.orange, fontSize: 22, lineHeight: 34 }}
                      >
                        {formatBasePrice(dish.price)}
                      </AppText>
                    </View>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
                      {[0, 1, 2, 3, 4].map((index) => (
                        <Star
                          key={index}
                          color={palette.amber}
                          fill={index < Math.round(dish.rating) ? palette.amber : "transparent"}
                          size={17}
                        />
                      ))}
                      <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                        {dish.rating.toFixed(1)}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        ({dish.reviewCount})
                      </AppText>
                    </View>
                  </View>
                </View>

                <AppText
                  variant="bodyLarge"
                  tone="secondary"
                  style={{ fontStyle: "italic", lineHeight: 26 }}
                >
                  {dish.description ??
                    `${dish.name} is served by ${venue.name}${
                      dish.tasteTags.length > 0 ? ` with ${dish.tasteTags.join(", ")} notes.` : "."
                    }`}
                </AppText>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                {attributes.map((attribute) => (
                  <View
                    key={attribute.label}
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      gap: spacing[1],
                      padding: spacing[3],
                      width: cardWidth,
                    }}
                  >
                    <AppText variant="micro" tone="secondary">
                      {attribute.label}
                    </AppText>
                    <AppText variant="h3" style={{ fontSize: 18 }}>
                      {attribute.value}
                    </AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      {attribute.helper}
                    </AppText>
                  </View>
                ))}
              </View>

              <View style={{ gap: spacing[3] }}>
                <Button
                  label={tasteProfileOpen ? "Hide Taste Profile" : "View Taste Profile"}
                  onPress={() => setTasteProfileOpen((current) => !current)}
                />
                {tasteProfileOpen ? (
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      gap: spacing[3],
                      padding: spacing[4],
                    }}
                  >
                    {TASTE_DIMENSIONS.map((dimension) => {
                      const score = dish.tasteVector[dimension.key] ?? 0;
                      const progressWidth =
                        `${Math.max(0, Math.min(100, Math.round((score / 10) * 100)))}%` as const;

                      return (
                        <View key={dimension.key} style={{ gap: spacing[1] }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                              {dimension.label}
                            </AppText>
                            <AppText variant="micro" tone="secondary">
                              {score}/10
                            </AppText>
                          </View>
                          <View
                            style={{
                              backgroundColor: palette.border,
                              borderRadius: radii.pill,
                              height: 8,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: palette.orange,
                                borderRadius: radii.pill,
                                height: "100%",
                                width: progressWidth,
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={{ gap: spacing[3] }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                  <Clock3 color={palette.orange} size={20} />
                  <AppText variant="h2">Opening Hours</AppText>
                </View>
                <View
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    borderWidth: 1,
                    gap: spacing[3],
                    padding: spacing[4],
                  }}
                >
                  <AppText style={{ fontWeight: "800" }}>Listed hours</AppText>
                  {listedHours.length ? (
                    <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                      {listedHours.map((row) => (
                        <View
                          key={`${row.days}-${row.hours}`}
                          style={{
                            flexDirection: "row",
                            gap: spacing[2],
                            justifyContent: "space-between",
                          }}
                        >
                          <AppText tone="secondary" style={{ width: 104 }}>
                            {row.days}
                          </AppText>
                          <AppText tone="secondary" style={{ flex: 1, textAlign: "right" }}>
                            {row.hours}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <AppText tone="secondary">No listed hours available.</AppText>
                  )}
                  {venue.closureNotice ? (
                    <AppText tone="secondary">{venue.closureNotice}</AppText>
                  ) : null}
                </View>
              </View>

              <View style={{ gap: spacing[3] }}>
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: spacing[2],
                    marginHorizontal: 0,
                  }}
                >
                  <Utensils color={palette.orange} size={20} />
                  <AppText variant="h2">Signature Dishes</AppText>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    marginHorizontal: -spacing[4],
                  }}
                >
                  {signatureDishes.slice(0, 4).map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.name}`}
                      onPress={() => navigation.navigate("DishDetailV2", { dishId: item.id })}
                      style={{
                        height: signatureGridItemHeight,
                        overflow: "hidden",
                        width: signatureGridItemWidth,
                      }}
                    >
                      <Image
                        source={{ uri: item.imageUrl }}
                        contentFit="cover"
                        style={{ flex: 1 }}
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(15, 23, 42, 0.78)"]}
                        style={{
                          bottom: 0,
                          left: 0,
                          padding: spacing[3],
                          position: "absolute",
                          right: 0,
                        }}
                      >
                        <View
                          style={{
                            alignSelf: "flex-start",
                            backgroundColor: "rgba(15, 23, 42, 0.48)",
                            borderColor: "rgba(255, 255, 255, 0.18)",
                            borderRadius: radii.md,
                            borderWidth: 1,
                            paddingHorizontal: spacing[2],
                            paddingVertical: spacing[1],
                            shadowColor: "#000000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.24,
                            shadowRadius: 12,
                          }}
                        >
                          <AppText
                            style={{
                              color: palette.white,
                              fontWeight: "900",
                              textShadowColor: "rgba(0, 0, 0, 0.36)",
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 3,
                            }}
                          >
                            {item.name}
                          </AppText>
                          <AppText
                            variant="price"
                            style={{
                              color: palette.white,
                              textShadowColor: "rgba(0, 0, 0, 0.36)",
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 3,
                            }}
                          >
                            {formatBasePrice(item.price)}
                          </AppText>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ gap: spacing[3] }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                  <Sparkles color={palette.orange} size={20} />
                  <AppText variant="h2">From the Community</AppText>
                </View>
                {dish.reviews.length ? (
                  dish.reviews.slice(0, 3).map((review) => (
                    <View
                      key={review.id}
                      style={{
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        borderRadius: componentRadii.card,
                        borderWidth: 1,
                        gap: spacing[2],
                        padding: spacing[4],
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <AppText style={{ fontWeight: "900" }}>{review.authorName}</AppText>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
                          <Star color={palette.amber} fill={palette.amber} size={13} />
                          <AppText variant="micro" style={{ fontWeight: "800" }}>
                            {review.rating}
                          </AppText>
                        </View>
                      </View>
                      <AppText variant="bodySmall" tone="secondary">
                        {review.text}
                      </AppText>
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="No reviews yet"
                    body="Be the first to add one."
                    icon={<Star size={36} color={palette.textMuted} />}
                  />
                )}
              </View>
            </View>
          </ScrollView>

          <View
            style={{
              backgroundColor: palette.bg,
              borderTopColor: palette.border,
              borderTopWidth: 1,
              bottom: 0,
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: spacing[3],
              left: 0,
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              paddingHorizontal: spacing[4],
              paddingTop: spacing[3],
              position: "absolute",
              right: 0,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSaved ? "Unsave this dish" : "Save this dish"}
              onPress={handleSave}
              style={{
                alignItems: "center",
                paddingHorizontal: spacing[1],
                height: 42,
                justifyContent: "center",
                width: undefined,
              }}
            >
              <Bookmark
                color={isSaved ? palette.white : palette.text}
                size={reviewIconSize}
                fill={isSaved ? palette.white : "none"}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark this food as tried"
              onPress={handleTryFood}
              disabled={isTryingFood}
              style={({ pressed }) => {
                const backgroundColor = isDishTried
                  ? palette.surface
                  : pressed
                    ? palette.bg
                    : palette.bgSoft;
                const normalizedBackgroundColor = backgroundColor.toLowerCase();
                const isWhiteOrBlackBackground =
                  !isDishTried &&
                  (normalizedBackgroundColor === "#ffffff" ||
                    normalizedBackgroundColor === "#000000");
                return {
                  alignItems: "center",
                  backgroundColor,
                  borderColor: isWhiteOrBlackBackground ? palette.orange : "transparent",
                  borderWidth: isWhiteOrBlackBackground ? 1 : 0,
                  paddingHorizontal: spacing[1],
                  borderRadius: componentRadii.iconButton,
                  height: 42,
                  justifyContent: "center",
                  width: undefined,
                };
              }}
            >
              <CheckCircle color={palette.text} fill="none" size={reviewIconSize} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Write a review"
              onPress={handleReview}
              style={{
                alignItems: "center",
                paddingHorizontal: spacing[1],
                height: 42,
                justifyContent: "center",
                width: undefined,
              }}
            >
              <CommentIcon color={palette.text} size={reviewIconSize} />
            </Pressable>
          </View>

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
              left: 0,
              paddingHorizontal: spacing[4],
              position: "absolute",
              right: 0,
              top: insets.top + spacing[2],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={{
                alignItems: "center",
                backgroundColor: headerButtonBackground,
                borderColor: headerButtonBorder,
                borderRadius: componentRadii.iconButton,
                borderWidth: 1,
                height: 40,
                justifyContent: "center",
                width: 40,
              }}
            >
              <ArrowLeft color={palette.text} size={22} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${dish.name}`}
              onPress={openShareSheet}
              style={{
                alignItems: "center",
                backgroundColor: headerButtonBackground,
                borderColor: headerButtonBorder,
                borderRadius: componentRadii.iconButton,
                borderWidth: 1,
                height: 40,
                justifyContent: "center",
                width: 40,
              }}
            >
              <Send color={palette.text} size={21} />
            </Pressable>
          </View>

          <ReviewShareSheet
            activeReview={activeShareReview}
            innerRef={shareSheetRef}
            bottomInset={insets.bottom}
            onDismiss={() => {
              setActiveShareReview(null);
            }}
            onShared={(reviewId) => {
              incrementShare(reviewId);
            }}
          />
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
