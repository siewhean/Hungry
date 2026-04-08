import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Search as SearchIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Button, Input, Screen } from "@/components/ui";
import { getDiscoverStallCollections, useSearchData } from "@/features/search/search";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";

export function DishSearchScreen() {
  const navigation = useNavigation<any>();
  const { palette, radii, spacing } = useHungryTheme();
  const { filters } = useSearchData();
  const profile = useProfileStore((state) => state.profile);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const collections = getDiscoverStallCollections(profile, filters.query).slice(0, 4);

  return (
    <Screen
      title="Search"
      subtitle="Search by dish, then decide whether the stall is worth the walk."
    >
      <View style={{ gap: spacing[4] }}>
        <Input
          leftIcon={<SearchIcon color={palette.textMuted} size={18} />}
          placeholder="Laksa, satay, Tian Tian..."
          value={filters.query}
          onChangeText={updateQuery}
          onSubmitEditing={() => navigation.navigate("SearchResults")}
        />
        <Button label="View search results" onPress={() => navigation.navigate("SearchResults")} />
        <Pressable
          onPress={() => {
            const match = collections[0]?.topDishes[0];
            if (match) {
              setDecideForMe(match);
              navigation.navigate("DishDetail", { dishId: match.id });
            }
          }}
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.lg,
            gap: spacing[1],
            padding: spacing[4],
          }}
        >
          <AppText variant="h3">Suggested for tonight</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Start with a strong match first, then widen the search only if you need more options.
          </AppText>
        </Pressable>

        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2">Stalls worth checking</AppText>
          {collections.map((collection) => (
            <Pressable
              key={collection.venue.id}
              onPress={() => navigation.navigate("StallDetail", { venueId: collection.venue.id })}
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
                borderWidth: 1,
                overflow: "hidden",
              }}
            >
              <View style={{ flexDirection: "row", gap: spacing[3], padding: spacing[4] }}>
                <Image
                  source={{ uri: collection.posts[0]?.mediaUrl }}
                  style={{ borderRadius: radii.md, height: 84, width: 84 }}
                  contentFit="cover"
                />
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[2] }}>
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
                    {collection.topDishes[0]?.name} · {collection.topDishes[0]?.tasteTags.slice(0, 2).join(" · ")}
                  </AppText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

      </View>
    </Screen>
  );
}
