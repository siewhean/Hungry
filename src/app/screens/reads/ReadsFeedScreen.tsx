import { Pressable, ScrollView, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { getReadsFeed } from "@/features/reads/feed";
import { AppText, Badge, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Reads">,
  NativeStackScreenProps<RootStackParamList>
>;

const ATMOSPHERES = [
  { label: "CANDLELIT", color: "amber" },
  { label: "INDUSTRIAL", color: "textMuted" },
  { label: "KINFOLK", color: "teal" },
  { label: "BRUTALIST", color: "text" },
] as const;

export function ReadsFeedScreen(_: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const posts = getReadsFeed();
  const rootNavigation = useNavigation<any>();

  const getReadTime = (post: any) => {
    const words = post.title.length + post.excerpt.length;
    return `${Math.max(3, Math.ceil(words / 20))} MIN READ`;
  };

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={{ gap: spacing[6], paddingBottom: spacing[2] }}
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
                    {post.sourceName} {"\u00B7"} {getReadTime(post)}
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
              paddingHorizontal: spacing[1],
            }}
          >
            <AppText variant="h2">IN FOCUS {"\u2014"} Trending Palettes</AppText>
            <Pressable 
              style={({ pressed }) => [
                { 
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: palette.border
                },
                shadows.card
              ]}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                VIEW ARCHIVE
              </AppText>
            </Pressable>
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
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderWidth: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  ...shadows.card,
                }}
              >
                <AppText
                  variant="micro"
                  style={{
                    color: (palette as any)[atm.color] ?? palette.text,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    fontWeight: "700",
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
