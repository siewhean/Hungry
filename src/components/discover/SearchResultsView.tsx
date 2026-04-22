import { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Search, X, SlidersHorizontal, Star } from "lucide-react-native";
import { Image } from "expo-image";

import { AppText, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type FilterTab = "All" | "Dishes" | "Stalls" | "Reads";

interface SearchResultsViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onTasteFilterPress: () => void;
  results: DishDetail[];
  onResultPress: (dish: DishDetail) => void;
}

export function SearchResultsView({
  query,
  onQueryChange,
  onClear,
  onTasteFilterPress,
  results,
  onResultPress,
}: SearchResultsViewProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  const TABS: FilterTab[] = ["All", "Dishes", "Stalls", "Reads"];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Orange-bordered Search Bar */}
      <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}>
        <View
          style={[
            shadows.card,
            {
              backgroundColor: palette.surface,
              borderRadius: radii.pill,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              height: 56,
              gap: spacing[2],
              borderWidth: 1,
              borderColor: palette.orange,
            },
          ]}
        >
          <Search color={palette.orange} size={20} />
          <Input
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search..."
            style={{ flex: 1, height: "100%", paddingHorizontal: 0 }}
          />
          {query.length > 0 && (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X color={palette.textMuted} size={20} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Type Filter Tabs */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                marginRight: spacing[6],
                paddingVertical: spacing[3],
                borderBottomWidth: 2,
                borderBottomColor: isActive ? palette.orange : "transparent",
              }}
            >
              <AppText
                variant="bodySmall"
                style={{
                  fontWeight: isActive ? "800" : "600",
                  color: isActive ? palette.text : palette.textSecondary,
                }}
              >
                {tab}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Taste Filter Quick Access */}
      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
        <Pressable
          onPress={onTasteFilterPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            alignSelf: "flex-start",
            paddingVertical: spacing[1],
            paddingHorizontal: spacing[3],
            borderRadius: radii.pill,
            backgroundColor: palette.bgSoft,
          }}
        >
          <SlidersHorizontal color={palette.navy} size={16} />
          <AppText variant="micro" style={{ fontWeight: "700" }}>
            TASTE FILTERS
          </AppText>
        </Pressable>
      </View>

      {/* Results List */}
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}>
        {results.map((dish) => (
          <Pressable
            key={dish.id}
            onPress={() => onResultPress(dish)}
            style={{ flexDirection: "row", gap: spacing[3] }}
          >
            <Image
              source={{ uri: dish.imageUrl }}
              style={{ width: 80, height: 80, borderRadius: radii.md }}
              contentFit="cover"
            />
            <View style={{ flex: 1, justifyContent: "center", gap: spacing[1] }}>
              <AppText variant="bodyBold" numberOfLines={1}>
                {dish.name}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                <Star color={palette.amber} fill={palette.amber} size={14} />
                <AppText variant="micro" style={{ fontWeight: "700" }}>
                  {dish.rating.toFixed(1)}
                </AppText>
                <AppText variant="micro" tone="secondary">
                  ({Math.floor(Math.random() * 200) + 50})
                </AppText>
              </View>
              <AppText style={{ color: palette.orange, fontWeight: "800" }}>
                S${dish.price.toFixed(2)}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
