import { Pressable, ScrollView, View } from "react-native";
import { MessageCircle, MessageCircleMore } from "lucide-react-native";

const CommentIcon = MessageCircle ?? MessageCircleMore;

import { BiteCard } from "@/components/social/BiteCard";
import { AppText, EmptyState, Skeleton } from "@/components/ui";
import type { Bite } from "@/lib/services/types";
import { useSocialStore, type InteractionState } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";

export type ReviewBitesLoadingState = "ready" | "pending" | "skeleton";

interface ReviewBitesStripProps {
  bites: Bite[];
  dishName: string;
  loadingState?: ReviewBitesLoadingState;
  onCommentPress?: (bite: Bite) => void;
  onPressDish: () => void;
}

function ReviewBitesStripSkeleton() {
  const { radii, spacing } = useHungryTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[1] }}
    >
      {[0, 1, 2].map((slot) => (
        <View
          key={`review-bites-loading-${slot}`}
          style={{
            width: 210,
            borderRadius: radii.md,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row" }}>
            <Skeleton width={72} height={92} borderRadius={0} />
            <View style={{ flex: 1, gap: spacing[1], padding: spacing[2] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                <Skeleton width="58%" height={14} borderRadius={radii.sm} />
                <Skeleton width={28} height={14} borderRadius={radii.sm} />
              </View>
              <Skeleton width="100%" height={16} borderRadius={radii.sm} />
              <Skeleton width="72%" height={16} borderRadius={radii.sm} />
              <Skeleton width="42%" height={12} borderRadius={radii.sm} />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function ReviewBitesStrip({
  bites,
  dishName,
  loadingState = "ready",
  onCommentPress,
  onPressDish,
}: ReviewBitesStripProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const interactions = useSocialStore((state) => state.interactions);
  const toggleLike = useSocialStore((state) => state.toggleLike);
  const toggleSave = useSocialStore((state) => state.toggleSave);
  const visibleBites = bites.slice(0, 3);

  const getBiteInteraction = (bite: Bite): InteractionState =>
    interactions[bite.id] ?? {
      liked: false,
      saved: false,
      likeCount: bite.cravingCount,
      saveCount: bite.savedCount,
      shareCount: 0,
      commentCount: 0,
    };

  if (loadingState === "pending") {
    return null;
  }

  return (
    <View
      style={{
        gap: spacing[2],
        paddingTop: spacing[2],
        borderTopWidth: 1,
        borderTopColor: palette.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText
          variant="micro"
          tone="muted"
          style={{ fontWeight: "800", letterSpacing: 0, textTransform: "uppercase" }}
        >
          Bites on this dish
        </AppText>
        {loadingState === "skeleton" ? (
          <Skeleton width={18} height={14} borderRadius={radii.sm} />
        ) : (
          <AppText variant="micro" tone="muted">
            {bites.length}
          </AppText>
        )}
      </View>

      {loadingState === "skeleton" ? (
        <ReviewBitesStripSkeleton />
      ) : visibleBites.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[1] }}
        >
          {visibleBites.map((bite) => {
            const interaction = getBiteInteraction(bite);

            return (
              <BiteCard
                key={bite.id}
                bite={bite}
                width={210}
                variant="compact"
                liked={interaction.liked}
                saved={interaction.saved}
                commentCount={interaction.commentCount}
                likeCount={interaction.likeCount}
                saveCount={interaction.saveCount}
                onCommentPress={() => onCommentPress?.(bite)}
                onDishPress={onPressDish}
                onToggleLike={() => void toggleLike(bite.id)}
                onToggleSave={() => void toggleSave(bite.id)}
              />
            );
          })}
        </ScrollView>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${dishName} to add the first bite`}
      onPress={onPressDish}
      style={{ borderRadius: radii.md, backgroundColor: palette.bgSoft }}
    >
      <EmptyState
        title="No bites yet"
        body={`No bites yet for ${dishName}. Tap through to start one.`}
        icon={<CommentIcon size={36} color={palette.textMuted} />}
      />
    </Pressable>
  )}
    </View>
  );
}
