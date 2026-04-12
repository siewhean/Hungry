import { getDataRepository, getSimilarityScore } from "@/lib/services/serviceProvider";
import type { DishDetail, StallPost, UserProfile, VenueSummary } from "@/types/domain";

export interface HomeFeedItem extends StallPost {
  venue: VenueSummary;
  dishes: DishDetail[];
}

export function getHomeFeed(profile: UserProfile) {
  const repository = getDataRepository();
  return repository
    .listStallPosts()
    .map((post) => {
      const venue = repository.getVenueById(post.venueId);
      const dishes = post.dishIds
        .map((dishId) => repository.getDishById(dishId))
        .filter(Boolean) as DishDetail[];

      if (!venue) {
        return null;
      }

      return {
        ...post,
        venue,
        dishes,
      } satisfies HomeFeedItem;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDish = left!.dishes[0];
      const rightDish = right!.dishes[0];
      const leftScore = leftDish ? getSimilarityScore(leftDish.tasteVector, profile.tasteVector) : 0;
      const rightScore = rightDish ? getSimilarityScore(rightDish.tasteVector, profile.tasteVector) : 0;
      return rightScore - leftScore;
    }) as HomeFeedItem[];
}
