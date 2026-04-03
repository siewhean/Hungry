import { mockRepository } from "@/lib/services/mock/repositories";

export function getReadsFeed(area?: string) {
  const posts = mockRepository.listBlogPosts();

  if (!area || area === "Nearby") {
    return posts;
  }

  return posts.filter((post) => post.area === area);
}

