import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { isContentHiddenForSession } from "@/lib/security/communitySafety";
import type { DataRepository } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";

export function mergeStallPosts(...postLists: StallPost[][]): StallPost[] {
  const seen = new Set<string>();
  return postLists.flat().filter((post) => {
    if (isContentHiddenForSession({ id: post.id, authorName: post.authorName })) return false;
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

export async function listSharedStallPosts(repository: DataRepository = getDataRepository()) {
  const service = getHungryService();
  let servicePosts: StallPost[] = [];
  let bitePosts: StallPost[] = [];

  try {
    servicePosts = await service.content.listStallPosts();
  } catch {
    servicePosts = [];
  }

  try {
    bitePosts = (await service.social.getBitesFeed()).map((bite) =>
      biteToStallPost(bite, { authorAvatarUrl: bite.authorAvatar }),
    );
  } catch {
    bitePosts = [];
  }

  if (getServiceProvider().mode === "supabase") {
    return mergeStallPosts(bitePosts, servicePosts, repository.listStallPosts());
  }

  const localPublishedPosts = usePublishedPostStore.getState().posts;
  const localPublishedIds = new Set(localPublishedPosts.map((post) => post.id));
  bitePosts
    .filter((post) => !localPublishedIds.has(post.id))
    .forEach((post) => usePublishedPostStore.getState().upsertPost(post));
  return mergeStallPosts(localPublishedPosts, bitePosts, servicePosts, repository.listStallPosts());
}
