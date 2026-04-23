import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, Mic, Search as SearchIcon, X, Star } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, Input, Screen } from "@/components/ui";
import { getDiscoverStallCollections, useSearchData } from "@/features/search/search";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const SEARCH_TABS = ["All", "Dishes", "Stalls", "Reads"] as const;

export function DishSearchScreenV2() {
  const navigation = useNavigation<RootNavigation>();
  const { motion, palette, radii, spacing, shadows } = useHungryTheme();
  const { filters } = useSearchData();
  const profile = useProfileStore((state) => state.profile);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);
  const collections = getDiscoverStallCollections(profile, filters.query).slice(0, 5);

  const [activeTab, setActiveTab] = useState<(typeof SEARCH_TABS)[number]>("Dishes");

  const entryY = useRef(new Animated.Value(-10)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryY]);

  return (
    <Screen scroll={false}>
      <Animated.View
        style={{
          flex: 1,
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        }}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            paddingBottom: spacing[2],
          }}
        >
          <AppText variant="h1" style={{ fontSize: 20, fontWeight: "900" }}>
            Discover
          </AppText>
        </View>

        {/* Search Bar Active */}
        <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: palette.surface,
              borderWidth: 2,
              borderColor: palette.orange,
              borderRadius: radii.pill,
              height: 52,
              paddingHorizontal: spacing[4],
              gap: spacing[3],
            }}
          >
            <SearchIcon color={palette.orange} size={18} />
            <Input
              placeholder="Search..."
              value={filters.query}
              onChangeText={updateQuery}
              style={{ flex: 1, height: "100%", fontSize: 16, fontWeight: "600" }}
              autoFocus
            />
            {filters.query.length > 0 ? (
              <Pressable onPress={() => updateQuery("")}>
                <X color={palette.textMuted} size={18} />
              </Pressable>
            ) : (
              <Mic color={palette.textMuted} size={18} />
            )}
          </View>
        </View>

        {/* Type Tabs */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            gap: spacing[6],
          }}
        >
          {SEARCH_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingVertical: spacing[3],
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? palette.text : "transparent",
                }}
              >
                <AppText
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? "700" : "600",
                    color: isActive ? palette.text : palette.textMuted,
                  }}
                >
                  {tab}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
        >
          {/* Section Heading */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingHorizontal: spacing[4],
              paddingTop: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h2" style={{ fontSize: 16, fontWeight: "800" }}>
              {filters.query ? `Dishes matching "${filters.query}"` : "Trending dishes"}
            </AppText>
            <AppText variant="micro" tone="secondary" style={{ fontWeight: "600" }}>
              {collections.length} results
            </AppText>
          </View>

          {/* Results List */}
          <View style={{ paddingHorizontal: spacing[4] }}>
            {collections.map((item) => {
              const dish = item.topDishes[0];
              if (!dish) return null;
              return (
                <Pressable
                  key={dish.id}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: radii.md,
                      backgroundColor: palette.bgSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText style={{ fontSize: 24 }}>🍜</AppText>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <AppText variant="bodyBold">{dish.name}</AppText>
                    <View style={{ gap: 2, marginTop: 2 }}>
                      <AppText variant="micro" tone="secondary">
                        {item.venue.name} · 80m
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <Star size={10} color={palette.amber} fill={palette.amber} />
                          <AppText variant="micro" style={{ fontWeight: "700" }}>
                            {dish.rating.toFixed(1)}
                          </AppText>
                        </View>
                        <AppText variant="micro" tone="secondary">
                          · 312 reviews
                        </AppText>
                        <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                          S${dish.price.toFixed(2)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor: palette.successSoft,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <AppText
                      variant="micro"
                      style={{ color: palette.success, fontWeight: "800", fontSize: 10 }}
                    >
                      A
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Taste Filter Quick Access */}
          <View
            style={{
              margin: spacing[4],
              padding: spacing[4],
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <AppText variant="bodySmallBold" style={{ marginBottom: spacing[2] }}>
              Filter by taste
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              <Chip label="🌶️ Spicy" onPress={() => {}} />
              <Chip label="🥥 Coconut" selected onPress={() => {}} />
              <Chip label="🍤 Seafood" onPress={() => {}} />
              <Chip label="🌿 Herb" onPress={() => {}} />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}
