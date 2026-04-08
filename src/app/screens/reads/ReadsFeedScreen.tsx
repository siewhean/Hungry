import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getReadsFeed } from "@/features/reads/feed";
import { AppText, Badge, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ReadsFeed">;

const ATMOSPHERES = [
  { label: "CANDLELIT", color: "#F5A623" },
  { label: "INDUSTRIAL", color: "#9CA3AF" },
  { label: "KINFOLK", color: "#14B8A6" },
  { label: "BRUTALIST", color: "#6B7280" },
] as const;

export function ReadsFeedScreen(_: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const posts = getReadsFeed();
  const rootNavigation = useNavigation<any>();

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={{ gap: spacing[6], paddingBottom: spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Article List ── */}
        <View style={{ gap: spacing[4] }}>
          <AppText variant="h2">Latest Reads</AppText>

          {posts.map((post) => (
            <Pressable key={post.id} onPress={() => rootNavigation.navigate("BlogPost", { postId: post.id })}>
              <Card>
                <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <Image
                  source={{ uri: post.imageUrl }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: radii.sm,
                  }}
                  contentFit="cover"
                />
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText
                    variant="micro"
                    tone="accent"
                    style={{ textTransform: "uppercase" }}
                  >
                    {post.sourceName} {"\u00B7"} 8 MIN READ
                  </AppText>
                  <AppText variant="h3">{post.title}</AppText>
                  <AppText
                    variant="bodySmall"
                    tone="secondary"
                    numberOfLines={2}
                  >
                    {post.excerpt}
                  </AppText>
                </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        {/* ── IN FOCUS — Trending Palettes ── */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2">IN FOCUS {"\u2014"} Trending Palettes</AppText>
            <AppText variant="bodySmall" tone="accent">
              View Archive
            </AppText>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3] }}
          >
            {posts.map((post) => (
              <Pressable
                key={`focus-${post.id}`}
                onPress={() => rootNavigation.navigate("BlogPost", { postId: post.id })}
                style={{
                  width: 260,
                  height: 160,
                  borderRadius: radii.md,
                  overflow: "hidden",
                  backgroundColor: palette.navy,
                }}
              >
                <Image
                  source={{ uri: post.imageUrl }}
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    opacity: 0.4,
                  }}
                  contentFit="cover"
                />
                <View
                  style={{
                    flex: 1,
                    justifyContent: "flex-end",
                    padding: spacing[4],
                  }}
                >
                  <Badge label={post.area} tone="orange" />
                  <AppText
                    variant="h3"
                    style={{
                      color: "#FFFFFF",
                      marginTop: spacing[1],
                    }}
                  >
                    {post.title}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Explore by Atmosphere ── */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2">Explore by Atmosphere</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Matching your mood to the table.
          </AppText>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[3],
            }}
          >
            {ATMOSPHERES.map((atm) => (
              <View
                key={atm.label}
                style={{
                  width: "47%",
                  height: 100,
                  borderRadius: radii.md,
                  backgroundColor: palette.navy,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <AppText
                  variant="micro"
                  style={{
                    color: atm.color,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {atm.label}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        {/* ── THE LATEST — Recent Dispatches ── */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2">THE LATEST {"\u2014"} Recent Dispatches</AppText>

          {posts.slice(0, 1).map((post) => (
            <Pressable key={`latest-${post.id}`} onPress={() => rootNavigation.navigate("BlogPost", { postId: post.id })}>
            <Card>
              <Image
                source={{ uri: post.imageUrl }}
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: radii.sm,
                }}
                contentFit="cover"
              />
              <View style={{ gap: spacing[1] }}>
                <AppText variant="h3">{post.title}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {post.excerpt}
                </AppText>
              </View>
            </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
