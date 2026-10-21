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

export function listMockStallPosts(): StallPost[] {
  return mergePosts(publishedStallPosts, stallPosts);
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
