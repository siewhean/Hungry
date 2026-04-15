import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, Search as SearchIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Chip, Input, Screen } from "@/components/ui";
import {
  getDiscoverStallCollections,
  useSearchData,
} from "@/features/search/search";
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
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function DishSearchScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { motion, palette, radii, spacing, shadows } = useHungryTheme();
  const { filters } = useSearchData();
  const profile = useProfileStore((state) => state.profile);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const selectedCategories = useSearchStore(
    (state) => state.filters.categories,
  );
  const toggleCategory = useSearchStore((state) => state.toggleCategory);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const collections = getDiscoverStallCollections(profile, filters.query).slice(
    0,
    4,
  );
  const entryY = useRef(new Animated.Value(-28)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate("MainTabs", { screen: "Discover" });
            }}
          >
            <ArrowLeft color={palette.navy} size={18} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Search</AppText>
            <AppText tone="secondary">
              Search by dish, then decide whether the stall is worth the walk.
            </AppText>
          </View>
        </View>

        <Input
          leftIcon={<SearchIcon color={palette.textMuted} size={18} />}
          placeholder="Laksa, satay, Tian Tian..."
          value={filters.query}
          onChangeText={updateQuery}
          onSubmitEditing={() => navigation.navigate("SearchResults")}
        />
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
        >
          {SEARCH_CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={category}
              selected={selectedCategories.includes(category)}
              onPress={() => toggleCategory(category)}
            />
          ))}
        </View>
        <Button
          label="Adjust taste filter"
          variant="secondary"
          onPress={() => navigation.navigate("TasteFilter")}
        />
        <Button
          label="View search results"
          onPress={() => navigation.navigate("SearchResults")}
        />
        <Pressable
          onPress={() => {
            const match = collections[0]?.topDishes[0];
            if (match) {
              setDecideForMe(match);
              navigation.navigate("DishDetail", { dishId: match.id });
            }
          }}
          style={({ pressed }) => [
            {
              backgroundColor: pressed ? palette.bgSoft : palette.surface,
              borderRadius: radii.lg,
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
              <AppText
                variant="micro"
                tone="accent"
                style={{ fontWeight: "700" }}
              >
                SUGGESTED FOR TONIGHT
              </AppText>
              <AppText variant="h2" style={{ marginTop: spacing[1] }}>
                Craving{" "}
                {collections[0]?.topDishes[0]?.name ?? "something special"}?
              </AppText>
              <AppText
                variant="bodySmall"
                tone="secondary"
                style={{ marginTop: spacing[1] }}
              >
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
                <AppText
                  variant="micro"
                  style={{ color: palette.orange, fontWeight: "700" }}
                >
                  BROWSE DISH
                </AppText>
              </View>
            </View>
            <Image
              source={{ uri: collections[0]?.topDishes[0]?.imageUrl }}
              style={{ borderRadius: radii.md, height: 120, width: 100 }}
              contentFit="cover"
            />
          </View>
        </Pressable>

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
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
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
                <Image
                  source={{ uri: collection.posts[0]?.mediaUrl }}
                  style={{ borderRadius: radii.md, height: 84, width: 84 }}
                  contentFit="cover"
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
                  <AppText
                    variant="bodySmall"
                    tone="secondary"
                    numberOfLines={2}
                  >
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
