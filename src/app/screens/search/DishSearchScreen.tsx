import { ScrollView, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Search as SearchIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, Card, Input, Screen } from "@/components/ui";
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
  const collections = getDiscoverStallCollections(profile, filters.query);

  return (
    <Screen
      title="Discover"
      subtitle="Search for stalls or dishes, then browse what each stall is sharing."
    >
      <View style={{ gap: spacing[4] }}>
        <Card style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <SearchIcon color={palette.orange} size={18} />
            <AppText variant="h3">Search for food or stalls</AppText>
          </View>
          <Input
            placeholder="Laksa, satay, Tian Tian..."
            value={filters.query}
            onChangeText={updateQuery}
            onSubmitEditing={() => navigation.navigate("SearchResults")}
          />
          <Button label="Search results" onPress={() => navigation.navigate("SearchResults")} />
        </Card>

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Button
            label="Nearby stalls"
            fullWidth={false}
            onPress={() => updateQuery("")}
          />
          <Button
            label="Dishes you'll like"
            fullWidth={false}
            variant="secondary"
            onPress={() => {
              const match = collections[0]?.topDishes[0];
              if (match) {
                setDecideForMe(match);
                navigation.getParent()?.getParent()?.navigate("DishDetail", { dishId: match.id });
              }
            }}
          />
        </View>

        <ScrollView contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}>
          {collections.map((collection) => (
            <Card key={collection.venue.id} style={{ gap: spacing[3], padding: 0, overflow: "hidden" }}>
              <Pressable
                onPress={() => navigation.getParent()?.getParent()?.navigate("StallDetail", { venueId: collection.venue.id })}
                style={{ flexDirection: "row", gap: spacing[3], padding: spacing[4] }}
              >
                <Image
                  source={{ uri: collection.posts[0]?.authorAvatarUrl }}
                  style={{ borderRadius: radii.pill, height: 52, width: 52 }}
                  contentFit="cover"
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="h3">{collection.venue.name}</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {collection.location} · {collection.venue.floor} {collection.venue.unitNumber}
                  </AppText>
                </View>
                <Badge label={`${Math.round(collection.affinity * 100)}% match`} tone="orange" />
              </Pressable>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing[3],
                  paddingHorizontal: spacing[4],
                  paddingBottom: spacing[4],
                }}
              >
                {collection.posts.map((post) => (
                  <Pressable
                    key={post.id}
                    onPress={() => navigation.getParent()?.getParent()?.navigate("DishDetail", { dishId: post.dishIds[0] })}
                    style={{ gap: spacing[2], width: 220 }}
                  >
                    <Image
                      source={{ uri: post.mediaUrl }}
                      style={{ borderRadius: radii.md, height: 180, width: 220 }}
                      contentFit="cover"
                    />
                    <View style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[2] }}>
                        <Badge label={post.mediaType === "video" ? "Video" : "Photo"} tone="amber" />
                        <AppText variant="bodySmall" tone="secondary">
                          {post.createdAt}
                        </AppText>
                      </View>
                      <AppText numberOfLines={2}>{post.caption}</AppText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}
