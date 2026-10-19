import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";
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

type HapticsModule = typeof import("expo-haptics");

let hapticsModule: HapticsModule | null | undefined;

async function triggerLightImpact() {
  try {
    const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
    if (!useUIStore.getState().hapticFeedbackEnabled) {
      return;
    }
    if (hapticsModule === undefined) {
      hapticsModule = await import("expo-haptics");
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
  return getServiceProvider().mode === "mock" || (typeof __DEV__ !== "undefined" && __DEV__);
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

interface SocialState {
  interactions: Record<string, InteractionState>;
  followedAuthors: Record<string, boolean>;
  followedUserIds: Record<string, boolean>;
  /** Users the viewer has a pending follow request to (private accounts). */
  requestedUserIds: Record<string, boolean>;
  commentsByPostId: Record<string, SocialComment[]>;
  repliesByCommentId: Record<string, SocialReply[]>;

  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleAuthorFollow: (authorName: string) => void;
  toggleFollow: (userId: string) => void;
  /** Record server-confirmed follows (e.g. from the viewer's own Following list). */
  markFollowedUserIds: (userIds: string[]) => void;
  /** Reconcile one user's follow state with the server (true or false). */
  setFollowedUserId: (userId: string, isFollowing: boolean) => void;
  /** Reconcile one user's pending follow request state with the server. */
  setFollowRequested: (userId: string, isRequested: boolean) => void;
  /** Re-check every locally "Requested" user with the server (approved, declined or cancelled). */
  reconcileRequestedFollows: () => Promise<void>;
  /** Replace local follow state with the signed-in user's Following list from the server. */
  syncFollowedUserIds: (userId: string) => Promise<void>;
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

const FOLLOW_SYNC_PAGE_SIZE = 500;
const FOLLOW_SYNC_MAX_PAGES = 4;

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      interactions: {},
      followedAuthors: {},
      followedUserIds: {},
      requestedUserIds: {},
      commentsByPostId: {},
      repliesByCommentId: {},

      clearAccountScopedState: () =>
        set({
          interactions: {},
          followedAuthors: {},
          followedUserIds: {},
          requestedUserIds: {},
          commentsByPostId: {},
          repliesByCommentId: {},
        }),

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

        if (isLiked) {
          requestAnimationFrame(() => {
            const { addActivityUpdate } = useActivityStore.getState();
            const actorName = useProfileStore.getState().profile.displayName || "You";
            addActivityUpdate({
              kind: "like",
              postId,
              actorName,
              text: "liked your post",
              target: postId,
              time: "now",
            });
          });
        }

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
        const isFollowing = get().followedUserIds[userId] ?? false;
        const service = getHungryService();
        const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
        // "Requested": tapping again withdraws the pending request.
        if (!isFollowing && get().requestedUserIds[userId]) {
          set((prev) => ({
            requestedUserIds: { ...prev.requestedUserIds, [userId]: false },
          }));
          void service.social.cancelFollowRequest(userId).catch((error) => {
            console.error("Failed to cancel follow request", error);
            set((prev) => ({
              requestedUserIds: { ...prev.requestedUserIds, [userId]: true },
            }));
            useUIStore.getState().showToast({
              message: "Couldn't cancel the request. Please try again.",
              tone: "error",
            });
          });
          return;
        }
        set((prev) => ({
          followedUserIds: {
            ...prev.followedUserIds,
            [userId]: !isFollowing,
          },
          requestedUserIds: { ...prev.requestedUserIds, [userId]: false },
        }));
        void (isFollowing ? service.social.unfollowUser(userId) : service.social.followUser(userId))
          .then((result) => {
            // Private accounts must approve the request, so the viewer is not following yet.
            if (result !== "pending") return;
            set((prev) => ({
              followedUserIds: { ...prev.followedUserIds, [userId]: false },
              requestedUserIds: { ...prev.requestedUserIds, [userId]: true },
            }));
            useUIStore.getState().showToast({
              message: "Follow request sent. You'll follow them once they approve.",
              tone: "info",
            });
          })
          .catch((error) => {
            console.error("Failed to sync follow state", error);
            set((prev) => ({
              followedUserIds: { ...prev.followedUserIds, [userId]: isFollowing },
            }));
            useUIStore.getState().showToast({
              message: isFollowing
                ? "Couldn't unfollow. Please try again."
                : "Couldn't follow. Please try again.",
              tone: "error",
            });
          });
      },

      markFollowedUserIds: (userIds) => {
        if (!userIds.length) return;
        set((prev) => {
          const next = { ...prev.followedUserIds };
          const nextRequested = { ...prev.requestedUserIds };
          userIds.forEach((userId) => {
            if (!userId) return;
            next[userId] = true;
            // An approved follow is no longer a pending request.
            nextRequested[userId] = false;
          });
          return { followedUserIds: next, requestedUserIds: nextRequested };
        });
      },

      setFollowedUserId: (userId, isFollowing) => {
        if (!userId) return;
        const clearsRequest = isFollowing && Boolean(get().requestedUserIds[userId]);
        if (Boolean(get().followedUserIds[userId]) === isFollowing && !clearsRequest) return;
        set((prev) => ({
          followedUserIds: { ...prev.followedUserIds, [userId]: isFollowing },
          ...(clearsRequest
            ? { requestedUserIds: { ...prev.requestedUserIds, [userId]: false } }
            : {}),
        }));
      },

      setFollowRequested: (userId, isRequested) => {
        if (!userId) return;
        if (Boolean(get().requestedUserIds[userId]) === isRequested) return;
        set((prev) => ({
          requestedUserIds: { ...prev.requestedUserIds, [userId]: isRequested },
        }));
      },

      reconcileRequestedFollows: async () => {
        const pendingIds = Object.keys(get().requestedUserIds).filter(
          (userId) => get().requestedUserIds[userId],
        );
        if (!pendingIds.length) return;
        const social = getHungryService().social;
        const statuses = await Promise.all(
          pendingIds.map((userId) => social.getFollowStatus(userId).catch(() => null)),
        );
        set((prev) => {
          const followed = { ...prev.followedUserIds };
          const requested = { ...prev.requestedUserIds };
          pendingIds.forEach((userId, index) => {
            const status = statuses[index];
            // Unknown (offline/error): keep the local state; and skip users the
            // viewer re-tapped while the checks were in flight.
            if (status === null || !requested[userId]) return;
            requested[userId] = status === "pending";
            followed[userId] = status === "approved";
          });
          return { followedUserIds: followed, requestedUserIds: requested };
        });
      },

      syncFollowedUserIds: async (userId) => {
        if (!userId) return;
        const social = getHungryService().social;
        const followingIds: string[] = [];
        // Bounded: a very large Following list keeps its first pages and falls back to
        // per-profile checks (getFollowStatus) for the rest.
        for (let page = 0; page < FOLLOW_SYNC_MAX_PAGES; page += 1) {
          const rows = await social.listFollowing(userId, {
            limit: FOLLOW_SYNC_PAGE_SIZE,
            offset: page * FOLLOW_SYNC_PAGE_SIZE,
          });
          rows.forEach((row) => {
            if (row.userId) followingIds.push(row.userId);
          });
          if (rows.length < FOLLOW_SYNC_PAGE_SIZE) {
            // Complete list: the server wins both ways, so stale local follows are cleared.
            const followed: Record<string, boolean> = {};
            followingIds.forEach((id) => {
              followed[id] = true;
            });
            set((prev) => {
              const requested = { ...prev.requestedUserIds };
              followingIds.forEach((id) => {
                requested[id] = false;
              });
              return { followedUserIds: followed, requestedUserIds: requested };
            });
            return;
          }
        }
        get().markFollowedUserIds(followingIds);
      },

      loadCommentsForPost: async (postId) => {
        if (getServiceProvider().mode === "mock") return;

        const profile = useProfileStore.getState().profile;
        const loadedComments = await getHungryService().social.listCommentsForPost(postId);
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
              console.error("Failed to sync comment to backend", error);
            });
        }
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
        if (getServiceProvider().mode !== "mock") {
          void getHungryService()
            .social.createComment(postId, reply.text, reply.parentCommentId)
            .then((syncedReply) => {
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
              console.error("Failed to sync reply to backend", error);
            });
        }
      },
    }),
    {
      name: "hungry-social-v1",
      storage: hungryPersistStorage,
    },
  ),
);
