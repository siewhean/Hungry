import type { StallPost } from "@/types/domain";
import { stallPosts } from "./data";
import { loadMockState, saveMockState } from "./persistence";

const PUBLISHED_STALL_POSTS_KEY = "published_stall_posts";

let publishedStallPosts: StallPost[] = [];
let isHydrated = false;

function mergePosts(primary: StallPost[], fallback: StallPost[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

export async function hydratePublishedStallPosts() {
  if (isHydrated) return;
  const storedPosts = await loadMockState<StallPost[]>(PUBLISHED_STALL_POSTS_KEY);
  if (storedPosts) {
    publishedStallPosts = storedPosts;
  }
  isHydrated = true;
}

/** A post this device published and persisted, by id. Sample posts are not included. */
export function findPublishedStallPost(postId: string): StallPost | undefined {
  return publishedStallPosts.find((post) => post.id === postId);
}

export function listMockStallPosts(): StallPost[] {
  // A private portfolio entry is not a stall post anyone else can list.
  return mergePosts(
    publishedStallPosts.filter((post) => post.visibility !== "private"),
    stallPosts,
  );
}

/** Ids of persisted posts stored as private, so a reload can restore the in-memory private set. */
export function listPrivatePublishedStallPostIds(): string[] {
  return publishedStallPosts.filter((post) => post.visibility === "private").map((post) => post.id);
}

/** Stores a post's visibility with its record, so it survives a reload. */
export async function setPublishedStallPostVisibility(
  postId: string,
  visibility: "public" | "private",
) {
  await hydratePublishedStallPosts();
  if (!publishedStallPosts.some((post) => post.id === postId)) return;
  publishedStallPosts = publishedStallPosts.map((post) =>
    post.id === postId ? { ...post, visibility } : post,
  );
  await saveMockState(PUBLISHED_STALL_POSTS_KEY, publishedStallPosts);
}

/** Stores an edited caption with the post's record. */
export async function updatePublishedStallPostCaption(postId: string, caption: string) {
  await hydratePublishedStallPosts();
  if (!publishedStallPosts.some((post) => post.id === postId)) return;
  publishedStallPosts = publishedStallPosts.map((post) =>
    post.id === postId ? { ...post, caption } : post,
  );
  await saveMockState(PUBLISHED_STALL_POSTS_KEY, publishedStallPosts);
}

export async function appendPublishedStallPost(post: StallPost) {
  await hydratePublishedStallPosts();
  publishedStallPosts = mergePosts([post], publishedStallPosts);
  await saveMockState(PUBLISHED_STALL_POSTS_KEY, publishedStallPosts);
}

export async function removePublishedStallPost(postId: string) {
  await hydratePublishedStallPosts();
  publishedStallPosts = publishedStallPosts.filter((post) => post.id !== postId);
  await saveMockState(PUBLISHED_STALL_POSTS_KEY, publishedStallPosts);
}

export function resetPublishedStallPostsForTest() {
  publishedStallPosts = [];
  isHydrated = true;
}
