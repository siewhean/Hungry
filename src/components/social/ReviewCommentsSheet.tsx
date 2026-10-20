import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { Pressable, View, type TextInput } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MessageCircle, MessageCircleMore, MoreHorizontal, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Avatar, EmptyState, Input } from "@/components/ui";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import {
  isContentHiddenForSession,
  promptCommentSafetyActions,
} from "@/lib/security/communitySafety";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore, type SocialComment, type SocialReply } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

const CommentIcon = MessageCircle ?? MessageCircleMore;

export interface ActiveReviewCommentTarget {
  id: string;
  authorName: string;
  dishName: string;
  caption?: string;
}

interface ReviewCommentsSheetProps {
  activeReview: ActiveReviewCommentTarget | null;
  seededComments?: SocialComment[];
  inputRef: RefObject<TextInput | null>;
  innerRef: RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
  /** Return false to block sending, e.g. a guest who must sign in first. */
  onBeforeSend?: () => boolean;
}

export function ReviewCommentsSheet({
  activeReview,
  seededComments = [],
  inputRef,
  innerRef,
  onDismiss,
  onBeforeSend,
}: ReviewCommentsSheetProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const addComment = useSocialStore((state) => state.addComment);
  const addReply = useSocialStore((state) => state.addReply);
  const loadCommentsForPost = useSocialStore((state) => state.loadCommentsForPost);

  const [draftComment, setDraftComment] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  // Bumped after a block so comments and replies re-read the session block filter.
  const [blockedAuthorsVersion, setBlockedAuthorsVersion] = useState(0);
  const onAuthorBlocked = useCallback(() => setBlockedAuthorsVersion((version) => version + 1), []);
  const emptyStateSpacing = Math.max(spacing[6], insets.bottom);

  useEffect(() => {
    if (!activeReview?.id) return;
    void loadCommentsForPost(activeReview.id);
  }, [activeReview?.id, loadCommentsForPost]);

  const commentsForActiveReview = useMemo<SocialComment[]>(() => {
    if (!activeReview) {
      return [];
    }

    const fromStore = [...(commentsByPostId[activeReview.id] ?? [])];
    const merged = [...seededComments, ...fromStore];

    const seen = new Set<string>();
    const deduped = merged.filter((comment) => {
      if (isContentHiddenForSession({ id: comment.id, authorId: comment.userId })) return false;
      if (seen.has(comment.id)) return false;
      seen.add(comment.id);
      return true;
    });

    return deduped.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    // blockedAuthorsVersion re-runs the session block filter after a block.
  }, [activeReview, blockedAuthorsVersion, commentsByPostId, seededComments]);

  const visibleRepliesByCommentId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(repliesByCommentId).map(([commentId, replies]) => [
          commentId,
          replies.filter(
            (reply) => !isContentHiddenForSession({ id: reply.id, authorId: reply.userId }),
          ),
        ]),
      ),
    // blockedAuthorsVersion re-runs the session block filter after a block.
    [blockedAuthorsVersion, repliesByCommentId],
  );

  const hasComments = commentsForActiveReview.length > 0;

  const handleDismiss = useCallback(() => {
    setActiveReplyCommentId(null);
    setDraftComment("");
    onDismiss();
  }, [onDismiss]);

  const handlePostCommentOrReply = useCallback(() => {
    if (!activeReview || !draftComment.trim().length) return;
    if (onBeforeSend && !onBeforeSend()) return;

    if (activeReplyCommentId) {
      const newReply: SocialReply = {
        id: `reply-${Date.now()}`,
        parentCommentId: activeReplyCommentId,
        userId: profile.id,
        authorName: profile.displayName,
        authorAvatarUrl: profile.avatarUrl,
        text: draftComment.trim(),
        createdAt: new Date().toISOString(),
      };

      addReply(activeReview.id, newReply);
      setActiveReplyCommentId(null);
    } else {
      const newComment: SocialComment = {
        id: `comment-${Date.now()}`,
        userId: profile.id,
        authorName: profile.displayName,
        authorAvatarUrl: profile.avatarUrl,
        text: draftComment.trim(),
        createdAt: new Date().toISOString(),
      };

      addComment(activeReview.id, newComment);
    }

    setDraftComment("");
  }, [
    activeReview,
    activeReplyCommentId,
    addComment,
    addReply,
    draftComment,
    onBeforeSend,
    profile,
  ]);

  if (!FEATURE_FLAGS.commentsEnabled) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={innerRef}
      snapPoints={["50%", "88%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="extend"
      accessibilityLabel="Review comments"
      accessibilityViewIsModal
      onDismiss={handleDismiss}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
          accessibilityRole="button"
          accessibilityLabel="Close comments"
          accessibilityHint="Dismisses the review comments sheet"
        />
      )}
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
      footerComponent={(props) => (
        <BottomSheetFooter {...props}>
          <View
            style={{
              backgroundColor: palette.surface,
              borderTopWidth: 1,
              borderTopColor: palette.border,
              gap: spacing[2],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              paddingHorizontal: spacing[3],
              paddingTop: spacing[2],
            }}
          >
            {activeReplyCommentId ? (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.bgSoft,
                  borderRadius: componentRadii.card,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1.5],
                }}
              >
                <AppText variant="micro" tone="secondary">
                  Replying to{" "}
                  <AppText variant="micro" style={{ fontWeight: "700" }}>
                    {commentsForActiveReview.find((comment) => comment.id === activeReplyCommentId)
                      ?.authorName ?? "comment"}
                  </AppText>
                </AppText>
                <Pressable
                  onPress={() => setActiveReplyCommentId(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reply"
                  accessibilityHint="Stops replying to the selected comment"
                >
                  <X size={14} color={palette.textMuted} />
                </Pressable>
              </View>
            ) : null}
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: spacing[2] }}>
              <View style={{ flex: 1 }}>
                <Input
                  ref={inputRef}
                  placeholder={activeReplyCommentId ? "Write a reply..." : "Add a comment..."}
                  value={draftComment}
                  onChangeText={setDraftComment}
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                  style={{ maxHeight: 44, minHeight: 44 }}
                />
              </View>
              <Pressable
                onPress={handlePostCommentOrReply}
                disabled={!draftComment.trim().length}
                style={{
                  opacity: draftComment.trim().length ? 1 : 0.5,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[3],
                }}
              >
                <AppText variant="bodyBold" style={{ color: palette.orange }}>
                  Post
                </AppText>
              </Pressable>
            </View>
          </View>
        </BottomSheetFooter>
      )}
    >
      <View
        style={{
          gap: spacing[1],
          paddingHorizontal: spacing[4],
          paddingTop: spacing[1],
          paddingBottom: spacing[3],
        }}
      >
        {activeReview ? (
          <>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="bodySmall" tone="secondary">
                {activeReview.dishName} · {activeReview.authorName}
              </AppText>
              {activeReview.caption ? (
                <AppText variant="bodySmall" style={{ lineHeight: 20 }}>
                  {activeReview.caption}
                </AppText>
              ) : null}
            </View>
            {!hasComments ? (
              <EmptyState
                title="No comments yet"
                body="Be the first to reply to this review."
                icon={<CommentIcon size={36} color={palette.textMuted} />}
              />
            ) : null}
          </>
        ) : null}
      </View>
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: commentsForActiveReview.length
            ? spacing[24] + spacing[8] + insets.bottom
            : emptyStateSpacing,
          paddingHorizontal: spacing[3],
          paddingTop: spacing[2],
        }}
      >
        {commentsForActiveReview.length
          ? commentsForActiveReview.map((comment) => (
              <View key={comment.id} style={{ gap: spacing[3], marginBottom: spacing[5] }}>
                <View style={{ flexDirection: "row", gap: spacing[3] }}>
                  <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        gap: spacing[2],
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                        <AppText variant="bodySmallBold">{comment.authorName}</AppText>
                        <AppText variant="micro" tone="muted">
                          {formatTimeAgo(comment.createdAt)}
                        </AppText>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Manage comment by ${comment.authorName}`}
                        hitSlop={8}
                        onPress={() =>
                          promptCommentSafetyActions({
                            commentId: comment.id,
                            authorName: comment.authorName,
                            authorId: comment.userId,
                            postId: activeReview?.id,
                            label: "comment",
                            onBlocked: onAuthorBlocked,
                          })
                        }
                      >
                        <MoreHorizontal color={palette.textMuted} size={18} />
                      </Pressable>
                    </View>
                    <AppText
                      variant="bodySmall"
                      style={{ flexShrink: 1, lineHeight: 20, width: "100%" }}
                    >
                      {comment.text}
                    </AppText>
                    <Pressable
                      onPress={() => {
                        setActiveReplyCommentId(comment.id);
                        inputRef.current?.focus();
                      }}
                      style={{ marginTop: 4 }}
                    >
                      <AppText
                        variant="micro"
                        style={{ color: palette.textMuted, fontWeight: "700" }}
                      >
                        Reply
                      </AppText>
                    </Pressable>

                    {(visibleRepliesByCommentId[comment.id] ?? []).length > 0 ? (
                      <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
                        {(visibleRepliesByCommentId[comment.id] ?? []).map((reply) => (
                          <View key={reply.id} style={{ flexDirection: "row", gap: spacing[3] }}>
                            <Avatar uri={reply.authorAvatarUrl} name={reply.authorName} size={24} />
                            <View style={{ flex: 1, gap: 2 }}>
                              <View
                                style={{
                                  alignItems: "center",
                                  flexDirection: "row",
                                  gap: spacing[2],
                                  justifyContent: "space-between",
                                }}
                              >
                                <View
                                  style={{
                                    alignItems: "center",
                                    flexDirection: "row",
                                    gap: spacing[2],
                                  }}
                                >
                                  <AppText variant="micro" style={{ fontWeight: "700" }}>
                                    {reply.authorName}
                                  </AppText>
                                  <AppText variant="micro" tone="muted">
                                    {formatTimeAgo(reply.createdAt)}
                                  </AppText>
                                </View>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Manage reply by ${reply.authorName}`}
                                  hitSlop={8}
                                  onPress={() =>
                                    promptCommentSafetyActions({
                                      commentId: reply.id,
                                      authorName: reply.authorName,
                                      authorId: reply.userId,
                                      postId: activeReview?.id,
                                      label: "reply",
                                      onBlocked: onAuthorBlocked,
                                    })
                                  }
                                >
                                  <MoreHorizontal color={palette.textMuted} size={16} />
                                </Pressable>
                              </View>
                              <AppText
                                variant="bodySmall"
                                style={{ flexShrink: 1, lineHeight: 18, width: "100%" }}
                              >
                                {reply.text}
                              </AppText>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
