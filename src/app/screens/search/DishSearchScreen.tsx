import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { ArrowLeft, Search as SearchIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  IconButton,
  Input,
  Screen,
} from "@/components/ui";
import { getDiscoverStallCollections, useSearchData } from "@/features/search/search";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

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

export function DishSearchScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, motion, palette, radii, spacing, shadows } = useHungryTheme();
  const { filters } = useSearchData();
  const profile = useProfileStore((state) => state.profile);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const [searchText, setSearchText] = useState("");
  const shouldUseCatalogReadV2 =
    FEATURE_FLAGS.catalogReadV2 && getServiceProvider().mode === "supabase";
  // Search results own the raw, paged catalog request. Keeping this landing
  // screen empty of local recommendations avoids a whole-catalog hydration.
  const collections = shouldUseCatalogReadV2
    ? []
    : getDiscoverStallCollections(profile, filters.query).slice(0, 4);
  const entryY = useRef(new Animated.Value(-28)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const suggestedDish = collections[0]?.topDishes[0];

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
        {/* Catalog mode renders no local suggestion; hide the card instead of a disabled dead end. */}
        {!shouldUseCatalogReadV2 ? (
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
                  Best match within 2km. Start strong, widen later if needed.
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
                  <AppText variant="micro" style={{ color: palette.accentText, fontWeight: "700" }}>
                    BROWSE DISH
                  </AppText>
                </View>
              </View>
              <AccessibleImage
                source={{ uri: suggestedDish?.imageUrl }}
                style={{ borderRadius: radii.md, height: 120, width: 100 }}
                contentFit="cover"
                decorative
              />
            </View>
          </Pressable>
        ) : null}

        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2">Stalls worth checking</AppText>
          {collections.map((collection) => (
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
                <AccessibleImage
                  source={{ uri: collection.posts[0]?.mediaUrl }}
                  style={{ borderRadius: radii.md, height: 84, width: 84 }}
                  contentFit="cover"
                  decorative
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
                    {collection.location} · {collection.venue.floor} {collection.venue.unitNumber}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                    {collection.topDishes[0]?.name} ·{" "}
                    {collection.topDishes[0]?.tasteTags.slice(0, 2).join(" · ")}
                  </AppText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </Screen>
  );
}
