import { useEffect } from "react";
import { View } from "react-native";

import { getDataRepository } from "@/lib/services/serviceProvider";
import { openTrustedBlogUrl } from "@/lib/security/safeLinking";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface BlogPostWebViewScreenProps {
  postId?: string;
  onOpenVenue: (venueId: string) => void;
}

export function BlogPostWebViewScreen({ postId, onOpenVenue }: BlogPostWebViewScreenProps) {
  const { spacing } = useHungryTheme();
  const repository = getDataRepository();
  const posts = repository.listBlogPosts();
  // An unknown id shows "not found" rather than silently opening a different article.
  const post = postId ? posts.find((item) => item.id === postId) : posts[0];

  useEffect(() => {
    if (!post) {
      return;
    }

    void openTrustedBlogUrl(post.url);
  }, [post]);

  if (!post) {
    return (
      <Screen title="Article view">
        <Card>
          <AppText variant="h3">Article not found</AppText>
          <AppText tone="secondary">It may have been removed.</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Article view" subtitle="The original article opens in your system browser.">
      <Card>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3">{post.title}</AppText>
          <AppText tone="secondary">{post.excerpt}</AppText>
        </View>
        {post.relatedVenueId ? (
          <Button label="View on Hungry" onPress={() => onOpenVenue(post.relatedVenueId!)} />
        ) : null}
      </Card>
    </Screen>
  );
}
