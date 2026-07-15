import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, View } from "react-native";
import { ArrowLeft, Search as SearchIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  IconButton,
  Input,
  Screen,
} from "@/components/ui";
import { getDishImageCandidates, isUsableDiscoverImageUrl } from "@/features/discover/bites";
import {
  formatDiscoverDistance,
  formatDiscoverPrice,
  getDishFallbackImageSource,
  getEffectiveCuisineTags,
} from "@/features/discover/presentation";
import { buildBoundedDiscoverStallCollections } from "@/features/search/boundedDiscoverStallCollections";
import { getDiscoverStallCollections, useSearchData } from "@/features/search/search";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, SearchCategory } from "@/types/domain";

const SEARCH_CATEGORIES: SearchCategory[] = [
  "local favourites",
  "noodles",
  "rice",
  "desserts",
  "late night",
];
const SEARCH_CATEGORY_OPTIONS = SEARCH_CATEGORIES.map((category) => ({
  id: category,
  label: category.replace(/\b\w/g, (char) => char.toUpperCase()),
}));
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function SearchCardDishImage({
  additionalImageUrls = [],
  dish,
  height,
  width,
}: {
  additionalImageUrls?: readonly (string | null | undefined)[];
  dish?: DishDetail;
  height: number;
  width: number;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const [failedImageUrls, setFailedImageUrls] = useState<readonly string[]>([]);
  const imageUrls = [
    ...(dish ? getDishImageCandidates(dish).map((candidate) => candidate.imageUrl) : []),
    ...additionalImageUrls,
  ].filter(
    (imageUrl, index, candidates): imageUrl is string =>
      isUsableDiscoverImageUrl(imageUrl) && candidates.indexOf(imageUrl) === index,
  );
  const imageSignature = imageUrls.join("\u001f");
  const activeImageUrl = imageUrls.find((imageUrl) => !failedImageUrls.includes(imageUrl));

  useEffect(() => {
    setFailedImageUrls([]);
  }, [dish?.id, imageSignature]);

  return (
    <View style={{ borderRadius: radii.md, height, overflow: "hidden", width }}>
      <AccessibleImage
        source={
          activeImageUrl
            ? { uri: activeImageUrl }
            : getDishFallbackImageSource({
                cuisineTags: dish?.cuisineTags,
                foodTypeTag: dish?.foodTypeTag,
                name: dish?.name ?? "Suggested dish",
                venueName: dish?.venueName,
              })
        }
        style={{ height, width }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        onError={
          activeImageUrl
            ? () => setFailedImageUrls((current) => [...current, activeImageUrl])
            : undefined
        }
        decorative
      />
      {!activeImageUrl ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: palette.imageLabelSurface,
            borderRadius: radii.pill,
            bottom: spacing[1],
            left: spacing[1],
            paddingHorizontal: spacing[1],
            paddingVertical: spacing[0.5],
            position: "absolute",
          }}
        >
          <AppText
            variant="micro"
            style={{ color: palette.textOnDark, fontSize: 8, fontWeight: "900" }}
          >
            REPRESENTATIVE
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function DishSearchScreen() {
  const navigation = useNavigation<RootNavigation>();
  const serviceProvider = getServiceProvider();
  const isSupabaseDataSource = serviceProvider.mode === "supabase";
  const { componentRadii, motion, palette, radii, spacing, shadows } = useHungryTheme();
  const { filters } = useSearchData();
  const profile = useProfileStore((state) => state.profile);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const [searchText, setSearchText] = useState("");
  const [scopedFeed, setScopedFeed] = useState<DiscoveryLocationFeed>();
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">(
    isSupabaseDataSource ? "loading" : "ready",
  );
  const [catalogError, setCatalogError] = useState<string>();
  const [catalogLoadAttempt, setCatalogLoadAttempt] = useState(0);
  const mockCollections = isSupabaseDataSource
    ? []
    : getDiscoverStallCollections(profile, filters.query).slice(0, 4);
  const collections = isSupabaseDataSource
    ? scopedFeed
      ? buildBoundedDiscoverStallCollections(scopedFeed, filters.query, 4)
      : []
    : mockCollections;
  const entryY = useRef(new Animated.Value(-28)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const suggestedDish = collections[0]?.topDishes[0];
  const suggestedCuisineTags = suggestedDish ? getEffectiveCuisineTags(suggestedDish) : [];
  const suggestedDistance = suggestedDish
    ? formatDiscoverDistance(suggestedDish.distanceMeters)
    : undefined;

  useEffect(() => {
    if (!isSupabaseDataSource) {
      setCatalogStatus("ready");
      setCatalogError(undefined);
      return undefined;
    }

    let active = true;
    setCatalogStatus("loading");
    setCatalogError(undefined);
    void serviceProvider.service.discovery
      .listDiscoveryFeedByLocation({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        radiusMeters: 3000,
        limit: 20,
      })
      .then((feed) => {
        if (!active) return;
        if (!feed) throw new Error("Nearby search suggestions are unavailable.");
        setScopedFeed(feed);
        setCatalogStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setScopedFeed(undefined);
        setCatalogError(
          error instanceof Error ? error.message : "Nearby search suggestions are unavailable.",
        );
        setCatalogStatus("error");
      });

    return () => {
      active = false;
    };
  }, [
    catalogLoadAttempt,
    currentLocation.latitude,
    currentLocation.longitude,
    isSupabaseDataSource,
    serviceProvider.service,
  ]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [entryOpacity, entryY, motion.screenTransition]);

  return (
    <Screen>
      <Animated.View
        style={{
          gap: spacing[4],
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[3],
          }}
        >
          <IconButton
            variant="ghost"
            accessibilityLabel="Go back"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate("MainTabs", { screen: "Discover" });
            }}
            icon={<ArrowLeft color={palette.text} size={18} />}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Search</AppText>
          </View>
        </View>

        <Input
          leftIcon={<SearchIcon color={palette.textMuted} size={18} />}
          placeholder="Laksa, satay, Tian Tian..."
          accessibilityLabel="Search dishes, stalls, or hawker centres"
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            updateQuery(text);
          }}
          onSubmitEditing={() => {
            const trimmedQuery = searchText.trim();
            if (trimmedQuery) {
              rememberSearch(trimmedQuery);
            }
            navigation.navigate("SearchResults");
          }}
        />
        <ChipGroup
          options={SEARCH_CATEGORY_OPTIONS}
          selectedIds={selectedCategories}
          onSelect={toggleCategory}
        />
        <Button
          label="Adjust taste filter"
          variant="secondary"
          onPress={() => navigation.navigate("TasteFilter")}
        />
        <Button label="View search results" onPress={() => navigation.navigate("SearchResults")} />
        {isSupabaseDataSource && catalogStatus === "loading" ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading nearby dish and stall suggestions"
            style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[8] }}
          >
            <ActivityIndicator color={palette.orange} size="small" />
            <AppText variant="bodySmall" tone="secondary">
              Loading nearby dishes and stalls…
            </AppText>
          </View>
        ) : isSupabaseDataSource && catalogStatus === "error" ? (
          <EmptyState
            title="Suggestions unavailable"
            body="We couldn’t load nearby dishes and stalls. Check your connection and try again."
            ctaLabel="Try again"
            onPress={() => setCatalogLoadAttempt((attempt) => attempt + 1)}
            errorMessage={catalogError}
            sendErrorContext="Dish search nearby suggestions"
          />
        ) : isSupabaseDataSource && collections.length === 0 ? (
          <EmptyState
            title="No nearby suggestions"
            body="No dishes or stalls matched this area and search yet. Retry or search all results."
            ctaLabel="Retry nearby"
            onPress={() => setCatalogLoadAttempt((attempt) => attempt + 1)}
          />
        ) : (
          <>
            <Pressable
              onPress={() => {
                if (suggestedDish) {
                  setDecideForMe(suggestedDish);
                  navigation.navigate("DishDetail", { dishId: suggestedDish.id });
                }
              }}
              disabled={!suggestedDish}
              accessibilityRole="button"
              accessibilityLabel={
                suggestedDish
                  ? `Open suggested dish ${suggestedDish.name}`
                  : "Suggested dish unavailable"
              }
              accessibilityHint="Opens this dish detail page"
              accessibilityState={{ disabled: !suggestedDish }}
              style={({ pressed }) => [
                {
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  borderColor: palette.border,
                  overflow: "hidden",
                },
                shadows.card,
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing[4],
                  padding: spacing[4],
                }}
              >
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                    SUGGESTED FOR TONIGHT
                  </AppText>
                  <AppText variant="h2" style={{ marginTop: spacing[1] }}>
                    Craving {suggestedDish?.name ?? "something special"}?
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" style={{ marginTop: spacing[1] }}>
                    {suggestedDish
                      ? [
                          ...suggestedCuisineTags,
                          suggestedDistance ? `${suggestedDistance} away` : "Distance unavailable",
                          formatDiscoverPrice(suggestedDish),
                        ].join(" · ")
                      : "Nearby suggestions are unavailable right now."}
                  </AppText>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginTop: spacing[3],
                      backgroundColor: palette.orangeLight,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: radii.pill,
                    }}
                  >
                    <AppText
                      variant="micro"
                      style={{ color: palette.accentText, fontWeight: "700" }}
                    >
                      BROWSE DISH
                    </AppText>
                  </View>
                </View>
                <SearchCardDishImage dish={suggestedDish} height={120} width={100} />
              </View>
            </Pressable>

            <View style={{ gap: spacing[3] }}>
              <AppText variant="h2">Stalls worth checking</AppText>
              {collections.map((collection) => {
                const topDish = collection.topDishes[0];
                const cuisineTags = getEffectiveCuisineTags({
                  cuisineTags: [
                    ...(collection.venue.cuisineTags ?? []),
                    ...(topDish?.cuisineTags ?? []),
                  ],
                  foodTypeTag: topDish?.foodTypeTag,
                  name: topDish?.name,
                  venueName: collection.venue.name,
                });
                const distanceLabel = formatDiscoverDistance(topDish?.distanceMeters);
                const priceLabel = topDish ? formatDiscoverPrice(topDish) : "Price unavailable";

                return (
                  <Pressable
                    key={collection.venue.id}
                    onPress={() =>
                      navigation.navigate("StallDetail", {
                        venueId: collection.venue.id,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${collection.venue.name} stall details`}
                    accessibilityHint="Opens this stall page with menu and dish information"
                    accessibilityValue={{
                      text: [
                        ...cuisineTags,
                        topDish?.name,
                        priceLabel,
                        distanceLabel ? `${distanceLabel} away` : "distance unavailable",
                      ]
                        .filter(Boolean)
                        .join(", "),
                    }}
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: spacing[3],
                        padding: spacing[4],
                      }}
                    >
                      <SearchCardDishImage
                        additionalImageUrls={collection.posts.map((post) => post.mediaUrl)}
                        dish={topDish}
                        height={84}
                        width={84}
                      />
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            gap: spacing[2],
                          }}
                        >
                          <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
                            {collection.venue.name}
                          </AppText>
                          <AppText variant="bodySmall">
                            {Math.round(collection.affinity * 100)}% match
                          </AppText>
                        </View>
                        <AppText variant="bodySmall" tone="secondary">
                          {collection.location} · {collection.venue.floor}{" "}
                          {collection.venue.unitNumber}
                        </AppText>
                        <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                          {[topDish?.name, ...cuisineTags, distanceLabel, priceLabel]
                            .filter(Boolean)
                            .join(" · ")}
                        </AppText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
