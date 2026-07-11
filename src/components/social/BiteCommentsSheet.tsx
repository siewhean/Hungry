import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { Pressable, View, type TextInput } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MessageCircle, MessageCircleMore, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Avatar, EmptyState, Input } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import type { Bite } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore, type SocialComment, type SocialReply } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";

const CommentIcon = MessageCircle ?? MessageCircleMore;

interface BiteCommentsSheetProps {
  activeBite: Bite | null;
  inputRef: RefObject<TextInput | null>;
  innerRef: RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
}

export function BiteCommentsSheet({
  activeBite,
  inputRef,
  innerRef,
  onDismiss,
}: BiteCommentsSheetProps) {
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

  useEffect(() => {
    if (!activeBite?.id) return;
    void loadCommentsForPost(activeBite.id);
  }, [activeBite?.id, loadCommentsForPost]);

  const commentsForActiveBite = useMemo(() => {
    if (!activeBite) {
      return [];
    }

    return [...(commentsByPostId[activeBite.id] ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeBite, commentsByPostId]);

  const handleDismiss = useCallback(() => {
    setActiveReplyCommentId(null);
    setDraftComment("");
    onDismiss();
  }, [onDismiss]);

  const handlePostCommentOrReply = useCallback(() => {
    if (!activeBite || !draftComment.trim().length) return;

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

      addReply(activeBite.id, newReply);
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

      addComment(activeBite.id, newComment);
    }

    setDraftComment("");
  }, [activeBite, activeReplyCommentId, addComment, addReply, draftComment, profile]);

  if (!FEATURE_FLAGS.commentsEnabled) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={innerRef}
      snapPoints={["50%", "88%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      accessibilityLabel="Bite comments"
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
          accessibilityHint="Dismisses the bite comments sheet"
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
                    {commentsForActiveBite.find((comment) => comment.id === activeReplyCommentId)
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
          paddingTop: spacing[1],
          paddingBottom: spacing[3],
        }}
      />
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: spacing[24] + spacing[8] + insets.bottom,
          paddingHorizontal: spacing[3],
          paddingTop: spacing[2],
        }}
      >
        {commentsForActiveBite.length ? (
          commentsForActiveBite.map((comment) => (
            <View key={comment.id} style={{ gap: spacing[3], marginBottom: spacing[5] }}>
              <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    <AppText variant="bodySmallBold">{comment.authorName}</AppText>
                    <AppText variant="micro" tone="muted">
                      {formatTimeAgo(comment.createdAt)}
                    </AppText>
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

                  {(repliesByCommentId[comment.id] ?? []).length > 0 ? (
                    <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
                      {(repliesByCommentId[comment.id] ?? []).map((reply) => (
                        <View key={reply.id} style={{ flexDirection: "row", gap: spacing[3] }}>
                          <Avatar uri={reply.authorAvatarUrl} name={reply.authorName} size={24} />
                          <View style={{ flex: 1, gap: 2 }}>
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
        ) : (
          <EmptyState
            title="No comments yet"
            body="Be the first to share your review!"
            icon={<CommentIcon size={36} color={palette.textMuted} />}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
