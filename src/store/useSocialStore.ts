import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { trackAnalyticsEvent } from "@/lib/analytics";

/** Shows a toast without importing the UI store at module load. */
function showSocialToast(message: string) {
  const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
  useUIStore.getState().showToast({ message, tone: "error" });
}

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

// Guests browse only: likes, saves, follows, comments and share counts need an account.
// Screens prompt sign-in first; this keeps a guest tap from ever reaching the server.
function isSignedIn() {
  const { useSessionStore } = require("./useSessionStore") as typeof import("./useSessionStore");
  return useSessionStore.getState().isAuthenticated;
}

type HapticsModule = typeof import("@/lib/haptics");

let hapticsModule: HapticsModule | null | undefined;

async function triggerLightImpact() {
  try {
    // The shared wrapper checks Settings > Haptic feedback.
    if (hapticsModule === undefined) {
      hapticsModule = await import("@/lib/haptics");
    }
    await hapticsModule?.impactAsync(hapticsModule.ImpactFeedbackStyle.Light);
  } catch {
    hapticsModule = null;
  }
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ShareChannel = "in_app" | "system_share" | "copy_link" | "whatsapp" | "telegram";

// Like/save writes run one at a time per post and reaction, so two fast taps
// reach the server in tap order. Posts with a write in flight keep their local
// state when a feed read lands.
const reactionQueues = new Map<string, Promise<void>>();
const pendingReactionCounts = new Map<string, number>();
// When each post's last like/save write settled. A feed read that started
// before then may carry pre-write viewer state, so it is ignored for that post.
const lastReactionSettledAt = new Map<string, number>();

function enqueueReactionWrite(
  postId: string,
  reaction: "craving" | "save",
  write: () => Promise<void>,
) {
  const key = `${postId}:${reaction}`;
  pendingReactionCounts.set(postId, (pendingReactionCounts.get(postId) ?? 0) + 1);
  const run = (reactionQueues.get(key) ?? Promise.resolve()).then(write, write);
  const settled = run
    .catch(() => undefined)
    .finally(() => {
      const remaining = (pendingReactionCounts.get(postId) ?? 1) - 1;
      if (remaining > 0) pendingReactionCounts.set(postId, remaining);
      else pendingReactionCounts.delete(postId);
      lastReactionSettledAt.set(postId, Date.now());
      if (reactionQueues.get(key) === settled) reactionQueues.delete(key);
    });
  reactionQueues.set(key, settled);
  return run;
}

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
  /**
   * Seed or refresh interaction state from fetched posts. readStartedAt is when
   * the fetch began: server viewer state is skipped for posts whose like/save
   * write settled after that (the read may predate the write).
   */
  initializeInteractions: (items: any[], readStartedAt?: number) => void;
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

/** Newest posts whose like/save/share state is kept on the device. */
export const PERSISTED_INTERACTION_LIMIT = 500;
/** Newest posts whose comment threads are kept on the device. */
export const PERSISTED_COMMENT_THREAD_LIMIT = 50;

function keepNewestKeys<T>(record: Record<string, T>, limit: number): Record<string, T> {
  const keys = Object.keys(record);
  if (keys.length <= limit) return record;
  // Insertion order: the newest posts are the last ones added.
  return Object.fromEntries(keys.slice(keys.length - limit).map((key) => [key, record[key]]));
}

/**
 * What hungry-social-v1 keeps on the device: follow state, and a bounded window of
 * per-post state. The server re-sends the rest on the next read.
 */
export function partializeSocialState(
  state: Pick<
    SocialState,
    | "interactions"
    | "followedAuthors"
    | "followedUserIds"
    | "requestedUserIds"
    | "commentsByPostId"
    | "repliesByCommentId"
  >,
) {
  const commentsByPostId = keepNewestKeys(state.commentsByPostId, PERSISTED_COMMENT_THREAD_LIMIT);
  const commentIdsOf = (threads: Record<string, SocialComment[]>) =>
    new Set(Object.values(threads).flatMap((comments) => comments.map((comment) => comment.id)));
  const keptCommentIds = commentIdsOf(commentsByPostId);
  const droppedCommentIds = commentIdsOf(state.commentsByPostId);
  keptCommentIds.forEach((id) => droppedCommentIds.delete(id));
  return {
    interactions: keepNewestKeys(state.interactions, PERSISTED_INTERACTION_LIMIT),
    followedAuthors: state.followedAuthors,
    followedUserIds: state.followedUserIds,
    requestedUserIds: state.requestedUserIds,
    commentsByPostId,
    repliesByCommentId: Object.fromEntries(
      // Replies to a comment on a dropped thread go with it; replies to seeded comments stay.
      Object.entries(state.repliesByCommentId).filter(
        ([parentId]) => !droppedCommentIds.has(parentId),
      ),
    ),
  };
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

      initializeInteractions: (items, readStartedAt) => {
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
          const hasServerViewerState =
            typeof item.viewerHasLiked === "boolean" || typeof item.viewerHasSaved === "boolean";
          const settledAt = lastReactionSettledAt.get(item.id);
          const readPredatesWrite =
            typeof readStartedAt === "number" &&
            typeof settledAt === "number" &&
            settledAt >= readStartedAt;
          if (hasServerViewerState && !pendingReactionCounts.has(item.id) && !readPredatesWrite) {
            // The server knows the viewer's like/save and the latest counts:
            // trust it on every fetch instead of a stale local default.
            const previous = next[item.id];
            const saved =
              typeof item.viewerHasSaved === "boolean"
                ? item.viewerHasSaved
                : (previous?.saved ?? false);
            next[item.id] = {
              liked:
                typeof item.viewerHasLiked === "boolean"
                  ? item.viewerHasLiked
                  : (previous?.liked ?? false),
              saved,
              savedAt: saved ? (previous?.savedAt ?? item.interaction?.savedAt) : undefined,
              likeCount: item.likeCount ?? previous?.likeCount ?? 0,
              saveCount: item.savedCount ?? previous?.saveCount ?? 0,
              shareCount: item.shareCount ?? previous?.shareCount ?? 0,
              commentCount: Math.max(previous?.commentCount ?? 0, seededComments),
            };
            return;
          }
          if (!next[item.id]) {
            const seededLikes = item.likeCount ?? 0;
            next[item.id] = {
              liked: false,
              saved: false,
              savedAt: item.interaction?.savedAt,
              likeCount: seededLikes,
              saveCount: item.savedCount ?? 0,
              shareCount: item.shareCount ?? 0,
              commentCount: seededComments,
            };
          } else {
            next[item.id] = {
              ...next[item.id],
              shareCount: Math.max(next[item.id].shareCount, item.shareCount ?? 0),
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
        if (!isSignedIn()) return;
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

        // The post author's "liked your post" notification is created on the
        // server (post_likes trigger); never add one to the liker's own inbox.

        set((prev) => ({
          interactions: {
            ...prev.interactions,
            [postId]: nextState,
          },
        }));
        if (isLiked) trackAnalyticsEvent("post_liked", { post_id: postId });

        if (isUuidPostId(postId)) {
          void (async () => {
            try {
              await enqueueReactionWrite(postId, "craving", () =>
                getHungryService().social.reactToBite(postId, "craving", isLiked),
              );
            } catch (e) {
              console.error("Failed to sync liked post reaction; rolled back optimistic state.", e);
              showSocialToast(
                isLiked
                  ? "Couldn't like this post. Please try again."
                  : "Couldn't remove your like. Please try again.",
              );
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
        if (!isSignedIn()) return;
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
        if (isSaved) trackAnalyticsEvent("post_saved", { post_id: postId });

        if (isUuidPostId(postId)) {
          void (async () => {
            try {
              await enqueueReactionWrite(postId, "save", () =>
                getHungryService().social.reactToBite(postId, "save", isSaved),
              );
            } catch (e) {
              console.error("Failed to sync saved post reaction; rolled back optimistic state.", e);
              showSocialToast(
                isSaved
                  ? "Couldn't save this post. Please try again."
                  : "Couldn't remove this post from saved. Please try again.",
              );
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
        if (!isSignedIn()) return;
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
        trackAnalyticsEvent(isFollowing ? "user_unfollowed" : "user_followed", {
          target_user_id: userId,
        });
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
        // Snapshot to keep any follow the user toggles while this request is in flight.
        const startFollowed = get().followedUserIds;
        const startRequested = get().requestedUserIds;
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
              Object.keys({ ...startFollowed, ...prev.followedUserIds }).forEach((id) => {
                const current = Boolean(prev.followedUserIds[id]);
                if (current !== Boolean(startFollowed[id])) followed[id] = current;
              });
              const requested = { ...prev.requestedUserIds };
              followingIds.forEach((id) => {
                if (Boolean(prev.requestedUserIds[id]) === Boolean(startRequested[id])) {
                  requested[id] = false;
                }
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
        if (!isSignedIn()) return;
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
        trackAnalyticsEvent("post_shared", { post_id: postId, channel });

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
        if (!isSignedIn()) return;
        const { interactions } = get();
        const current = interactions[postId] ?? {
          liked: false,
          saved: false,
          likeCount: 0,
          saveCount: 0,
          shareCount: 0,
          commentCount: 0,
        };

        trackAnalyticsEvent("post_commented", { post_id: postId, is_reply: false });
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
              // Never leave a comment on screen that was not saved.
              set((prev) => ({
                commentsByPostId: {
                  ...prev.commentsByPostId,
                  [postId]: (prev.commentsByPostId[postId] ?? []).filter(
                    (candidate) => candidate.id !== comment.id,
                  ),
                },
                interactions: {
                  ...prev.interactions,
                  [postId]: {
                    ...(prev.interactions[postId] ?? current),
                    commentCount: Math.max(
                      0,
                      (prev.interactions[postId]?.commentCount ?? current.commentCount + 1) - 1,
                    ),
                  },
                },
              }));
              showSocialToast("Your comment was not posted. Please try again.");
            });
        }
      },

      addReply: (postId, reply) => {
        if (!isSignedIn()) return;
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
              set((prev) => ({
                repliesByCommentId: {
                  ...prev.repliesByCommentId,
                  [reply.parentCommentId]: (
                    prev.repliesByCommentId[reply.parentCommentId] ?? []
                  ).filter((candidate) => candidate.id !== reply.id),
                },
                interactions: {
                  ...prev.interactions,
                  [postId]: {
                    ...(prev.interactions[postId] ?? current),
                    commentCount: Math.max(
                      0,
                      (prev.interactions[postId]?.commentCount ?? current.commentCount + 1) - 1,
                    ),
                  },
                },
              }));
              showSocialToast("Your reply was not posted. Please try again.");
            });
        }
      },
    }),
    {
      name: "hungry-social-v1",
      storage: hungryPersistStorage,
      partialize: (state: SocialState) => partializeSocialState(state),
    },
  ),
);
