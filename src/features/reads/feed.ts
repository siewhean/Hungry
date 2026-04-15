import { getDataRepository } from "@/lib/services/serviceProvider";

export function getReadsFeed(area?: string) {
  const posts = getDataRepository().listBlogPosts();

  if (!area || area === "Nearby") {
    return posts;
  }

  return posts.filter((post) => post.area === area);
}
