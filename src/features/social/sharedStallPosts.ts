import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { biteToStallPost } from "@/lib/services/postTransforms";
import {
  isContentHiddenForSession,
  loadBlockedAuthorsForSession,
} from "@/lib/security/communitySafety";
import type { Bite, DataRepository } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";

export function mergeStallPosts(...postLists: StallPost[][]): StallPost[] {
  const seen = new Set<string>();
  return postLists.flat().filter((post) => {
    if (isContentHiddenForSession({ id: post.id, authorId: post.authorId })) return false;
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

export function listSharedStallPostsSync(repository: DataRepository = getDataRepository()) {
  if (getServiceProvider().mode === "supabase") {
    return mergeStallPosts(repository.listStallPosts());
  }
  return mergeStallPosts(usePublishedPostStore.getState().posts, repository.listStallPosts());
}

/** Posts per Home feed page. */
export const FEED_PAGE_SIZE = 40;

/** Where the next Home feed page starts: the oldest post of the page before it. */
export interface SharedFeedCursor {
  createdAt: string;
  postId: string;
}

export interface SharedStallPostsPage {
  posts: StallPost[];
  /** Null when the feed has no more pages (always, outside Supabase mode). */
  nextCursor: SharedFeedCursor | null;
}

function nextCursorAfter(bites: Bite[]): SharedFeedCursor | null {
  if (getServiceProvider().mode !== "supabase" || bites.length < FEED_PAGE_SIZE) return null;
  const last = bites[bites.length - 1];
  return last ? { createdAt: last.createdAt, postId: last.id } : null;
}

/** One page of the Home feed. Pass the previous page's cursor to read the next one. */
export async function listSharedStallPostsPage(
  repository: DataRepository = getDataRepository(),
  cursor?: SharedFeedCursor,
): Promise<SharedStallPostsPage> {
  const service = getHungryService();
  let servicePosts: StallPost[] = [];
  let bites: Bite[] = [];

  // Saved blocks must apply after a restart, before any post is merged in.
  await loadBlockedAuthorsForSession();

  if (cursor) {
    // Later pages come from the feed read alone; only Supabase has more than one page.
    if (getServiceProvider().mode !== "supabase") return { posts: [], nextCursor: null };
    bites = await service.social.getBitesFeed(undefined, undefined, {
      limit: FEED_PAGE_SIZE,
      cursor,
    });
    return {
      posts: mergeStallPosts(
        bites.map((bite) => biteToStallPost(bite, { authorAvatarUrl: bite.authorAvatar })),
      ),
      nextCursor: nextCursorAfter(bites),
    };
  }

  try {
    servicePosts = await service.content.listStallPosts();
  } catch {
    servicePosts = [];
  }

  try {
    bites = await service.social.getBitesFeed(undefined, undefined, { limit: FEED_PAGE_SIZE });
  } catch (error) {
    // The live feed is the only source in Supabase mode: an offline or backend
    // failure must reach the error state, not read as "No posts yet".
    if (getServiceProvider().mode === "supabase") throw error;
    bites = [];
  }
  const bitePosts = bites.map((bite) =>
    biteToStallPost(bite, { authorAvatarUrl: bite.authorAvatar }),
  );
  const nextCursor = nextCursorAfter(bites);

  if (getServiceProvider().mode === "supabase") {
    return {
      posts: mergeStallPosts(bitePosts, servicePosts, repository.listStallPosts()),
      nextCursor,
    };
  }

  const localPublishedPosts = usePublishedPostStore.getState().posts;
  const localPublishedIds = new Set(localPublishedPosts.map((post) => post.id));
  bitePosts
    .filter((post) => !localPublishedIds.has(post.id))
    .forEach((post) => usePublishedPostStore.getState().upsertPost(post));
  return {
    posts: mergeStallPosts(
      localPublishedPosts,
      bitePosts,
      servicePosts,
      repository.listStallPosts(),
    ),
    nextCursor,
  };
}

export async function listSharedStallPosts(repository: DataRepository = getDataRepository()) {
  return (await listSharedStallPostsPage(repository)).posts;
}
