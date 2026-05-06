import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";
import { getHungryService } from "@/lib/services/serviceProvider";
import * as Haptics from "expo-haptics";
import { useActivityStore } from "./useActivityStore";
import { useProfileStore } from "@/store/useProfileStore";

export interface InteractionState {
  liked: boolean;
  saved: boolean;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
}

export interface SocialComment {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
}

export interface SocialReply extends SocialComment {
  parentCommentId: string;
}

interface SocialState {
  interactions: Record<string, InteractionState>;
  followedAuthors: Record<string, boolean>;
  commentsByPostId: Record<string, SocialComment[]>;
  repliesByCommentId: Record<string, SocialReply[]>;

  toggleLike: (postId: string) => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  toggleAuthorFollow: (authorName: string) => void;
  incrementShare: (postId: string) => void;
  addComment: (postId: string, comment: SocialComment) => void;
  addReply: (postId: string, reply: SocialReply) => void;
  setInteraction: (postId: string, state: InteractionState) => void;
  initializeInteractions: (items: any[]) => void;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      interactions: {},
      followedAuthors: {},
      commentsByPostId: {},
      repliesByCommentId: {},

      initializeInteractions: (items) => {
        const { commentsByPostId, repliesByCommentId, interactions } = get();
        const next = { ...interactions };
        items.forEach((item) => {
          const storedComments = commentsByPostId[item.id] ?? [];
          const seededCommentIds = new Set(
            (item.dishes?.[0]?.reviews ?? []).map((review: { id: string }) => review.id),
          );
          const storedCommentIds = new Set(storedComments.map((comment) => comment.id));
          const storedCommentCount = storedComments.length;
          const storedReplyCount = Object.values(repliesByCommentId)
            .flat()
            .filter(
              (reply) =>
                seededCommentIds.has(reply.parentCommentId) ||
                storedCommentIds.has(reply.parentCommentId),
            ).length;
          const seededCommentCount = item.commentCount ?? item.dishes?.[0]?.reviews?.length ?? 0;
          const seededComments = seededCommentCount + storedCommentCount + storedReplyCount;
          if (!next[item.id]) {
            const seededLikes = item.likeCount ?? item.cravingCount ?? seededComments;
            next[item.id] = {
              liked: false,
              saved: false,
              likeCount: seededLikes,
              saveCount: item.savedCount ?? 0,
              shareCount: 0,
              commentCount: seededComments,
            };
          } else {
            next[item.id] = {
              ...next[item.id],
              commentCount: Math.max(next[item.id].commentCount, seededComments),
            };
          }
        });
        set({ interactions: next });
      },

      setInteraction: (postId, state) => {
        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: state,
          },
        }));
      },

      toggleLike: async (postId) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { interactions } = get();
        const { addActivityUpdate } = useActivityStore.getState();
        const actorName = useProfileStore.getState().profile.displayName || "You";
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        const isLiked = !current.liked;
        const newState = {
          ...current,
          liked: isLiked,
          likeCount: isLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1),
        };

        if (isLiked) {
          addActivityUpdate({
            kind: "like",
            postId,
            actorName,
            text: "liked your post",
            target: postId,
            time: "now",
          });
        }

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: newState,
          },
        }));

        try {
          await getHungryService().social.reactToBite(postId, "craving");
        } catch (e) {
          console.warn("Failed to sync liked post reaction; kept local state.", e);
        }
      },

      toggleSave: async (postId) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { interactions } = get();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        const isSaved = !current.saved;
        const newState = {
          ...current,
          saved: isSaved,
          saveCount: isSaved ? current.saveCount + 1 : Math.max(0, current.saveCount - 1),
        };

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: newState,
          },
        }));

        try {
          await getHungryService().social.reactToBite(postId, "save");
        } catch (e) {
          console.warn("Failed to sync saved post reaction; kept local state.", e);
        }
      },

      toggleAuthorFollow: (authorName) => {
        set((prev) => ({
          followedAuthors: {
            ...prev.followedAuthors,
            [authorName]: !prev.followedAuthors[authorName],
          },
        }));
      },

      incrementShare: (postId) => {
        const { interactions } = get();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: {
              ...current,
              shareCount: current.shareCount + 1,
            },
          },
        }));
      },

      addComment: (postId, comment) => {
        const { interactions } = get();
        const { addActivityUpdate } = useActivityStore.getState();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        set((prev) => ({
          commentsByPostId: {
            ...prev.commentsByPostId,
            [postId]: [...(prev.commentsByPostId[postId] ?? []), comment],
          },
          interactions: {
            ...prev.interactions,
            [postId]: {
              ...current,
              commentCount: current.commentCount + 1,
            },
          },
        }));
        addActivityUpdate({
          kind: "comment",
          postId,
          actorName: comment.authorName,
          text: "commented on your post",
          target: postId,
          time: "now",
        });
      },

      addReply: (postId, reply) => {
        const { interactions } = get();
        const { addActivityUpdate } = useActivityStore.getState();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        set((prev) => ({
          repliesByCommentId: {
            ...prev.repliesByCommentId,
            [reply.parentCommentId]: [
              ...(prev.repliesByCommentId[reply.parentCommentId] ?? []),
              reply,
            ],
          },
          interactions: {
            ...prev.interactions,
            [postId]: {
              ...current,
              commentCount: current.commentCount + 1,
            },
          },
        }));
        addActivityUpdate({
          kind: "comment",
          postId,
          actorName: reply.authorName,
          text: "replied to your comment",
          target: postId,
          time: "now",
        });
      },
    }),
    {
      name: "hungry-social-v1",
      storage: hungryPersistStorage,
    },
  ),
);
