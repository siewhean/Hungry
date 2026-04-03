import { useEffect } from "react";
import { View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { mockRepository } from "@/lib/services/mock/repositories";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface BlogPostWebViewScreenProps {
  postId: string;
  onOpenVenue: (venueId: string) => void;
}

export function BlogPostWebViewScreen({ postId, onOpenVenue }: BlogPostWebViewScreenProps) {
  const { spacing } = useHungryTheme();
  const post = mockRepository.listBlogPosts().find((item) => item.id === postId);

  useEffect(() => {
    if (!post) {
      return;
    }

    void WebBrowser.openBrowserAsync(post.url);
  }, [post]);

  if (!post) {
    return (
      <Screen title="Article unavailable">
        <Card>
          <AppText>The selected blog post could not be found.</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Article view" subtitle="The original article opens in the system browser for this mock build.">
      <Card>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3">{post.title}</AppText>
          <AppText tone="secondary">{post.excerpt}</AppText>
        </View>
        {post.relatedVenueId ? <Button label="View on Hungry" onPress={() => onOpenVenue(post.relatedVenueId!)} /> : null}
      </Card>
    </Screen>
  );
}

