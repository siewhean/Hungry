import { getDataRepository } from "@/lib/services/serviceProvider";

export interface HomeBite {
  id: string;
  dishId: string;
  dishName: string;
  dishImageUrl: string;
  venueName: string;
  authorName: string;
  authorAvatarUrl: string;
  caption: string;
  heartCount: number;
  commentCount: number;
  tasteTag: string;
  createdAt: string;
}

export function createDefaultBites(): HomeBite[] {
  const repository = getDataRepository();
  const postDrivenBites = repository
    .listStallPosts()
    .flatMap((post, index) =>
      post.dishIds
        .map((dishId) => repository.getDishById(dishId))
        .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish))
        .map((dish) => ({
          id: `bite-${post.id}-${dish.id}`,
          dishId: dish.id,
          dishName: dish.name,
          dishImageUrl: dish.imageUrl,
          venueName: dish.venueName,
          authorName: post.authorName,
          authorAvatarUrl: post.authorAvatarUrl,
          caption: post.caption,
          heartCount: 140 + index * 22,
          commentCount: 20 + index * 4,
          tasteTag: dish.tasteTags[0] ?? "Popular",
          createdAt: post.createdAt,
        })),
    );

  const nearbyBites = repository.listPopularNearby().map((dish, index) => ({
    id: `bite-nearby-${dish.id}`,
    dishId: dish.id,
    dishName: dish.name,
    dishImageUrl: dish.imageUrl,
    venueName: dish.venueName,
    authorName: dish.venueName,
    authorAvatarUrl: dish.imageUrl,
    caption: `Community pick: ${dish.name} at ${dish.venueName}.`,
    heartCount: 100 + index * 17,
    commentCount: 14 + index * 3,
    tasteTag: dish.tasteTags[0] ?? "Popular",
    createdAt: "Today",
  }));

  const uniqueByDishId = new Set<string>();
  return [...postDrivenBites, ...nearbyBites].filter((bite) => {
    if (uniqueByDishId.has(bite.dishId)) {
      return false;
    }
    uniqueByDishId.add(bite.dishId);
    return true;
  });
}