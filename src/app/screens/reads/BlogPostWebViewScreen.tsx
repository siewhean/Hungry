import { useEffect, useState } from "react";
import { View } from "react-native";
import { loadExactArticle } from "@/features/reads/articleInspector";
import { getHungryService } from "@/lib/services/serviceProvider";
import { openTrustedBlogUrl } from "@/lib/security/safeLinking";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { BlogPost } from "@/types/domain";

interface BlogPostWebViewScreenProps {
  postId?: string;
  onOpenVenue: (venueId: string) => void;
}
export function BlogPostWebViewScreen({ postId, onOpenVenue }: BlogPostWebViewScreenProps) {
  const { spacing } = useHungryTheme();
  const [post, setPost] = useState<BlogPost>();
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [opening, setOpening] = useState(false);
  const [handoffError, setHandoffError] = useState(false);
  useEffect(() => {
    let current = true;
    setPost(undefined);
    setHandoffError(false);
    if (!postId) {
      setStatus("missing");
      return;
    }
    setStatus("loading");
    void loadExactArticle(postId, (id) => getHungryService().content.getArticle(id))
      .then((article) => {
        if (!current) return;
        setPost(article);
        setStatus(article ? "ready" : "missing");
      })
      .catch(() => {
        if (current) setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [postId, retry]);
  return (
    <Screen title="Article view" subtitle="Open the original article in your browser.">
      <Card>
        <View style={{ gap: spacing[2] }}>
          {status === "loading" ? <AppText>Loading article…</AppText> : null}
          {status === "missing" ? <AppText>This article is unavailable.</AppText> : null}
          {status === "error" ? (
            <>
              <AppText>Couldn’t load this article.</AppText>
              <Button label="Retry" onPress={() => setRetry((value) => value + 1)} />
            </>
          ) : null}
          {post && status === "ready" ? (
            <>
              <AppText variant="h3">{post.title}</AppText>
              <AppText tone="secondary">{post.excerpt}</AppText>
              <Button
                label={opening ? "Opening…" : "Open original article"}
                disabled={opening}
                onPress={() => {
                  if (opening) return;
                  setOpening(true);
                  setHandoffError(false);
                  void openTrustedBlogUrl(post.url)
                    .then((opened) => {
                      if (opened === false) setHandoffError(true);
                    })
                    .catch(() => setHandoffError(true))
                    .finally(() => setOpening(false));
                }}
              />
              {handoffError ? <AppText>Couldn’t open your browser. Try again.</AppText> : null}
              {post.relatedVenueId ? (
                <Button label="View on Hungry" onPress={() => onOpenVenue(post.relatedVenueId!)} />
              ) : null}
            </>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}
