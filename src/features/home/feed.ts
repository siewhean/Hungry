import { mockRepository } from "@/lib/services/mock/repositories";
import { similarityScore } from "@/lib/services/mock/repositories";
import type { DishDetail, StallPost, UserProfile, VenueSummary } from "@/types/domain";

export interface HomeFeedItem extends StallPost {
  venue: VenueSummary;
  dishes: DishDetail[];
}

export async function getHomeFeed(profile: UserProfile) {
  // Simulate network delay for skeleton loaders
  await new Promise((resolve) => setTimeout(resolve, 800));

  return mockRepository
    .listStallPosts()
    .map((post) => {
      const venue = mockRepository.getVenueById(post.venueId);
      const dishes = post.dishIds
        .map((dishId) => mockRepository.getDishById(dishId))
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
      
      // Proactive logic: prioritize nearby dishes (simulated via distanceMeters)
      const leftDistance = leftDish?.distanceMeters ?? 1000;
      const rightDistance = rightDish?.distanceMeters ?? 1000;
      
      if (Math.abs(leftDistance - rightDistance) > 200) {
        return leftDistance - rightDistance;
      }

      const leftScore = leftDish ? similarityScore(leftDish.tasteVector, profile.tasteVector) : 0;
      const rightScore = rightDish ? similarityScore(rightDish.tasteVector, profile.tasteVector) : 0;
      return rightScore - leftScore;
    }) as HomeFeedItem[];
}

