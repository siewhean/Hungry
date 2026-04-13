import { getDataRepository, getSimilarityScore } from "@/lib/services/serviceProvider";
import type { DishDetail, StallPost, UserProfile, VenueSummary } from "@/types/domain";

export interface HomeFeedItem extends StallPost {
  venue: VenueSummary;
  dishes: DishDetail[];
}

export interface HomeFeedSection {
  title: string;
  items: HomeFeedItem[];
}

export function getHomeFeed(profile: UserProfile): HomeFeedSection[] {
  const repository = getDataRepository();
  const allPosts = repository
    .listStallPosts()
    .map((post) => {
      const venue = repository.getVenueById(post.venueId);
      const dishes = post.dishIds
        .map((dishId) => repository.getDishById(dishId))
        .filter(Boolean) as DishDetail[];

      if (!venue) return null;

      return {
        ...post,
        venue,
        dishes,
      } satisfies HomeFeedItem;
    })
    .filter((p): p is HomeFeedItem => !!p);

  // 1. Fastest Near You (Shortest distance)
  const fastest = [...allPosts]
    .sort((a, b) => a.venue.buildingId.localeCompare(b.venue.buildingId)) // Mock distance logic
    .slice(0, 5);

  // 2. Comfort Food / Heavy Rich (Taste-based)
  const comfort = allPosts.filter((p) => {
    const d = p.dishes[0];
    if (!d) return false;
    return d.tasteVector.rich > 7 || d.tasteVector.salty > 7 || d.tasteVector.sweet > 7;
  }).slice(0, 5);

  // 3. Top Rated by the Community (Rating-based)
  const topRated = [...allPosts]
    .sort((a, b) => (b.dishes[0]?.rating ?? 0) - (a.dishes[0]?.rating ?? 0))
    .slice(0, 5);

  return [
    { title: "Fastest Near You", items: fastest },
    { title: "Comfort Food / Rich & Savory", items: comfort },
    { title: "Top Rated by Community", items: topRated },
  ];
}
