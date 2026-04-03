import { FlatList, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { PlayCircle, Send, Heart, MessageCircle } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Card, Screen } from "@/components/ui";
import { getHomeFeed } from "@/features/home/feed";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";

export function HomeFeedScreen() {
  const navigation = useNavigation<any>();
  const { palette, radii, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const feed = getHomeFeed(profile);

  return (
    <Screen
      title="Home"
      subtitle="A social feed of food photos, stall posts, and short-form updates."
      scroll={false}
    >
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}
        renderItem={({ item }) => (
          <Card style={{ gap: spacing[3], padding: 0, overflow: "hidden" }}>
            <Pressable
              onPress={() => navigation.navigate("StallDetail", { venueId: item.venueId })}
              style={{ flexDirection: "row", gap: spacing[3], padding: spacing[4] }}
            >
              <Image
                source={{ uri: item.authorAvatarUrl }}
                style={{ borderRadius: radii.pill, height: 52, width: 52 }}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="h3">{item.authorName}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {item.authorLocation} · {item.createdAt}
                </AppText>
              </View>
              <Badge label={item.mediaType === "video" ? "Video" : "Photo"} tone="amber" />
            </Pressable>

            <Pressable onPress={() => navigation.navigate("DishDetail", { dishId: item.dishIds[0] })}>
              <View>
                <Image
                  source={{ uri: item.mediaUrl }}
                  style={{ height: 320, width: "100%" }}
                  contentFit="cover"
                />
                {item.mediaType === "video" ? (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: "rgba(17, 24, 39, 0.28)",
                      borderRadius: 999,
                      justifyContent: "center",
                      left: "50%",
                      marginLeft: -22,
                      marginTop: -22,
                      position: "absolute",
                      top: "50%",
                    }}
                  >
                    <PlayCircle color={palette.bg} size={44} />
                  </View>
                ) : null}
              </View>
            </Pressable>

            <View style={{ gap: spacing[3], padding: spacing[4] }}>
              <View style={{ flexDirection: "row", gap: spacing[4] }}>
                <Heart color={palette.text} size={20} />
                <MessageCircle color={palette.text} size={20} />
                <Send color={palette.text} size={20} />
              </View>
              <AppText>{item.caption}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {item.dishes.map((dish) => (
                  <Pressable key={dish.id} onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}>
                    <Badge label={dish.name} tone="orange" />
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
