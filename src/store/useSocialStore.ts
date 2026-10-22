import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAccountPersistStorage } from "./accountPersistStorage";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useActivityStore } from "./useActivityStore";
import { useProfileStore } from "@/store/useProfileStore";

export interface InteractionState {
  liked: boolean;
  saved: boolean;
  savedAt?: string;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
}

export interface SocialComment {
  id: string;
  userId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
}

export interface SocialReply extends SocialComment {
  parentCommentId: string;
}

type HapticsModule = typeof import("@/lib/haptics");

let hapticsModule: HapticsModule | null | undefined;

async function triggerLightImpact() {
  try {
    const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
    if (!useUIStore.getState().hapticFeedbackEnabled) {
      return;
    }
    if (hapticsModule === undefined) {
      hapticsModule = await import("@/lib/haptics");
    }
    await hapticsModule?.impactAsync(hapticsModule.ImpactFeedbackStyle.Light);
  } catch {
    hapticsModule = null;
  }
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ShareChannel = "in_app" | "system_share" | "copy_link";

function isUuidPostId(postId: string) {
  return UUID_V4_PATTERN.test(postId);
}

function canUseLocalAuthorFollowFallback() {
  return getServiceProvider().mode === "mock";
}

function interactionStatesMatch(left: InteractionState | undefined, right: InteractionState) {
  if (!left) return false;
  return (
    left.liked === right.liked &&
    left.saved === right.saved &&
    left.savedAt === right.savedAt &&
    left.likeCount === right.likeCount &&
    left.saveCount === right.saveCount &&
    left.shareCount === right.shareCount &&
    left.commentCount === right.commentCount
  );
}

let socialGeneration = 0;

interface SocialState {
  pendingUserIds: Record<string, boolean>;
  interactions: Record<string, InteractionState>;
  followedAuthors: Record<string, boolean>;
  followedUserIds: Record<string, boolean>;
  commentsByPostId: Record<string, SocialComment[]>;
  repliesByCommentId: Record<string, SocialReply[]>;

  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleAuthorFollow: (authorName: string) => void;
  toggleFollow: (userId: string) => void;
  incrementShare: (postId: string, channel?: ShareChannel) => void;
  addComment: (postId: string, comment: SocialComment) => void;
  addReply: (postId: string, reply: SocialReply) => void;
  loadCommentsForPost: (postId: string) => Promise<void>;
  setInteraction: (postId: string, state: InteractionState) => void;
  initializeInteractions: (items: any[]) => void;
  clearAccountScopedState: () => void;
}

type ServiceComment = Awaited<
  ReturnType<ReturnType<typeof getHungryService>["social"]["listCommentsForPost"]>
>[number];

function toSocialComment(row: ServiceComment, fallbackName: string, fallbackAvatarUrl?: string) {
  return {
    id: row.id,
    userId: row.userId,
    authorName: row.authorName?.trim() || fallbackName,
    authorAvatarUrl: row.authorAvatarUrl || fallbackAvatarUrl,
    text: row.body,
    createdAt: row.createdAt,
  } satisfies SocialComment;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      pendingUserIds: {},
      interactions: {},
      followedAuthors: {},
      followedUserIds: {},
      commentsByPostId: {},
      repliesByCommentId: {},

      clearAccountScopedState: () => {
        socialGeneration++;
        set({
          pendingUserIds: {},
          interactions: {},
          followedAuthors: {},
          followedUserIds: {},
          commentsByPostId: {},
          repliesByCommentId: {},
        });
      },

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
          const seededCommentCount = item.commentCount ?? 0;
          const seededComments = seededCommentCount + storedCommentCount + storedReplyCount;
          if (!next[item.id]) {
            const seededLikes = item.likeCount ?? 0;
            next[item.id] = {
              liked: false,
              saved: false,
              savedAt: item.interaction?.savedAt,
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

      toggleLike: (postId) => {
        const generation = socialGeneration;
        void triggerLightImpact();
        const { interactions } = get();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        const isLiked = !current.liked;
        const nextState = {
          ...current,
          liked: isLiked,
          likeCount: isLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1),
        };

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: nextState,
          },
        }));

        if (isUuidPostId(postId)) {
          void (async () => {
            try {
              await getHungryService().social.reactToBite(postId, "craving");
            } catch (e) {
              if (generation !== socialGeneration) return;
              console.error("Failed to sync liked post reaction; rolled back optimistic state.", e);
              set((prev) => {
                if (!interactionStatesMatch(prev.interactions[postId], nextState)) return prev;
                return {
                  interactions: {
                    ...prev.interactions,
                    [postId]: current,
                  },
                };
              });
            }
          })();
        }
      },

      toggleSave: (postId) => {
        const generation = socialGeneration;
        void triggerLightImpact();
        const { interactions } = get();
        const now = new Date().toISOString();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          savedAt: undefined,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        const isSaved = !current.saved;
        const nextState = {
          ...current,
          saved: isSaved,
          savedAt: isSaved ? now : undefined,
          saveCount: isSaved ? current.saveCount + 1 : Math.max(0, current.saveCount - 1),
        };

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: nextState,
          },
        }));

        if (isUuidPostId(postId)) {
          void (async () => {
            try {
              await getHungryService().social.reactToBite(postId, "save");
            } catch (e) {
              if (generation !== socialGeneration) return;
              console.error("Failed to sync saved post reaction; rolled back optimistic state.", e);
              set((prev) => {
                if (!interactionStatesMatch(prev.interactions[postId], nextState)) return prev;
                return {
                  interactions: {
                    ...prev.interactions,
                    [postId]: current,
                  },
                };
              });
            }
          })();
        }
      },

      toggleAuthorFollow: (authorName) => {
        if (!canUseLocalAuthorFollowFallback()) {
          console.warn("Author-name follow ignored because this author is not backed by Supabase.");
          return;
        }
        set((prev) => ({
          followedAuthors: {
            ...prev.followedAuthors,
            [authorName]: !prev.followedAuthors[authorName],
          },
        }));
      },

      toggleFollow: (userId: string) => {
        const generation = socialGeneration;
        const isFollowing = Boolean(get().followedUserIds[userId] || get().pendingUserIds[userId]);
        set((prev) => ({
          followedUserIds: {
            ...prev.followedUserIds,
            [userId]: !isFollowing,
          },
        }));
        if (getServiceProvider().mode !== "mock") {
          const service = getHungryService();
          void (
            isFollowing ? service.social.unfollowUser(userId) : service.social.followUser(userId)
          )
            .then(async () => {
              const state = await service.social.getFollowState(userId);
              if (generation !== socialGeneration) return;
              set((previous) => ({
                followedUserIds: { ...previous.followedUserIds, [userId]: state === "approved" },
                pendingUserIds: { ...previous.pendingUserIds, [userId]: state === "pending" },
              }));
            })
            .catch((error) => {
              if (generation !== socialGeneration) return;
              console.error("Failed to sync follow state", error);
              set((prev) => ({
                followedUserIds: { ...prev.followedUserIds, [userId]: isFollowing },
              }));
            });
        }
      },

      loadCommentsForPost: async (postId) => {
        const generation = socialGeneration;
        if (getServiceProvider().mode === "mock") return;

        const profile = useProfileStore.getState().profile;
        const loadedComments = await getHungryService().social.listCommentsForPost(postId);
        if (generation !== socialGeneration) return;
        const nextComments: SocialComment[] = [];
        const nextRepliesByCommentId: Record<string, SocialReply[]> = {};

        loadedComments.forEach((comment) => {
          const isOwnComment = comment.userId === profile.id;
          const normalized = toSocialComment(
            comment,
            isOwnComment ? profile.displayName : "Hungry User",
            isOwnComment ? profile.avatarUrl : undefined,
          );
          if (comment.parentCommentId) {
            nextRepliesByCommentId[comment.parentCommentId] = [
              ...(nextRepliesByCommentId[comment.parentCommentId] ?? []),
              {
                ...normalized,
                parentCommentId: comment.parentCommentId,
              },
            ];
            return;
          }

          nextComments.push(normalized);
        });

        set((prev) => {
          const current = prev.interactions[postId] ?? {
            liked: false,
            saved: false,
            likeCount: 0,
            saveCount: 0,
            shareCount: 0,
            commentCount: 0,
          };
          return {
            commentsByPostId: {
              ...prev.commentsByPostId,
              [postId]: nextComments,
            },
            repliesByCommentId: {
              ...prev.repliesByCommentId,
              ...nextRepliesByCommentId,
            },
            interactions: {
              ...prev.interactions,
              [postId]: {
                ...current,
                commentCount: loadedComments.length,
              },
            },
          };
        });
      },

      incrementShare: (postId, channel = "in_app") => {
        const generation = socialGeneration;
        if (getServiceProvider().mode !== "mock" && !isUuidPostId(postId)) {
          console.warn("Post share ignored because this post is not backed by Supabase.");
          return;
        }

        const { interactions } = get();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };
        const nextState = {
          ...current,
          shareCount: current.shareCount + 1,
        };

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: nextState,
          },
        }));

        if (isUuidPostId(postId)) {
          void (async () => {
            try {
              await getHungryService().social.shareBite(postId, { channel });
            } catch (e) {
              if (generation !== socialGeneration) return;
              console.error("Failed to sync shared post; rolled back optimistic state.", e);
              set((prev) => {
                if (!interactionStatesMatch(prev.interactions[postId], nextState)) return prev;
                return {
                  interactions: {
                    ...prev.interactions,
                    [postId]: current,
                  },
                };
              });
            }
          })();
        }
      },

      addComment: (postId, comment) => {
        const generation = socialGeneration;
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
        if (getServiceProvider().mode !== "mock") {
          void getHungryService()
            .social.createComment(postId, comment.text)
            .then((syncedComment) => {
              if (generation !== socialGeneration) return;
              const profile = useProfileStore.getState().profile;
              const normalized = toSocialComment(
                syncedComment,
                profile.displayName,
                profile.avatarUrl,
              );
              set((prev) => {
                const existing = prev.commentsByPostId[postId] ?? [];
                const replaced = existing.some((candidate) => candidate.id === comment.id)
                  ? existing.map((candidate) =>
                      candidate.id === comment.id ? { ...normalized } : candidate,
                    )
                  : [...existing, normalized];
                return {
                  commentsByPostId: {
                    ...prev.commentsByPostId,
                    [postId]: replaced,
                  },
                };
              });
            })
            .catch((error) => {
              if (generation !== socialGeneration) return;
              console.error("Failed to sync comment to backend", error);
            });
        }
      },

      addReply: (postId, reply) => {
        const generation = socialGeneration;
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
        if (getServiceProvider().mode !== "mock") {
          void getHungryService()
            .social.createComment(postId, reply.text, reply.parentCommentId)
            .then((syncedReply) => {
              if (generation !== socialGeneration) return;
              const profile = useProfileStore.getState().profile;
              const normalized = toSocialComment(
                syncedReply,
                profile.displayName,
                profile.avatarUrl,
              );
              const parentCommentId = syncedReply.parentCommentId ?? reply.parentCommentId;
              set((prev) => {
                const existing = prev.repliesByCommentId[parentCommentId] ?? [];
                const replacement = { ...normalized, parentCommentId } satisfies SocialReply;
                const replaced = existing.some((candidate) => candidate.id === reply.id)
                  ? existing.map((candidate) =>
                      candidate.id === reply.id ? replacement : candidate,
                    )
                  : [...existing, replacement];
                return {
                  repliesByCommentId: {
                    ...prev.repliesByCommentId,
                    [parentCommentId]: replaced,
                  },
                };
              });
            })
            .catch((error) => {
              if (generation !== socialGeneration) return;
              console.error("Failed to sync reply to backend", error);
            });
        }
      },
    }),
    {
      name: "hungry-social-v1",
      storage: createAccountPersistStorage("hungry-social-v1"),
    },
  ),
);
