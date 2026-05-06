import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { dataRepositoryMock as fallbackRepository } from "@/lib/services/mock/repositories";
import { biteToStallPost } from "@/lib/services/postTransforms";
import type { DataRepository } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";

export function mergeStallPosts(...postLists: StallPost[][]): StallPost[] {
  const seen = new Set<string>();
  return postLists.flat().filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

export function listSharedStallPostsSync(repository: DataRepository = getDataRepository()) {
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

  bitePosts.forEach((post) => usePublishedPostStore.getState().upsertPost(post));

  return mergeStallPosts(
    usePublishedPostStore.getState().posts,
    bitePosts,
    servicePosts,
    repository.listStallPosts(),
    fallbackRepository.listStallPosts(),
  );
}
