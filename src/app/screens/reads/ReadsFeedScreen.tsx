import { View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";

import type { MainTabParamList } from "@/app/navigation/navigationTypes";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getReadsFeed } from "@/features/reads/feed";
import { AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Reads">;

const AREAS = ["Nearby", "CBD", "Chinatown"];

export function ReadsFeedScreen(_: Props) {
  const { spacing } = useHungryTheme();
  const posts = getReadsFeed();
  const rootNavigation = useNavigation<any>();

  if (!FEATURE_FLAGS.readsEnabled) {
    return (
      <Screen title="Reads" subtitle="This tab stays wired but is hidden behind a feature flag until content is ready.">
        <EmptyState title="Reads is currently paused" body="The tab contract remains intact, but the feed is disabled for release." />
      </Screen>
    );
  }

  return (
    <Screen title="Reads" subtitle="Editorial food picks and blog coverage anchored to the same stall graph.">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {AREAS.map((area) => (
          <Badge key={area} label={area} tone={area === "Nearby" ? "orange" : "neutral"} />
        ))}
      </View>

      {posts.map((post) => (
        <Card key={post.id}>
          <View style={{ gap: spacing[2] }}>
            <Badge label={`Near ${post.area}`} tone="amber" />
            <AppText variant="h3">{post.title}</AppText>
            <AppText tone="secondary">
              {post.sourceName} · {post.excerpt}
            </AppText>
          </View>
          <Button
            label="Open article"
            onPress={() => rootNavigation.navigate("BlogPost", { postId: post.id })}
          />
        </Card>
      ))}
    </Screen>
  );
}
