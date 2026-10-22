import type { DishDetail } from "@/types/domain";

export interface StallCommunityReview {
  id: string;
  dishId: string;
  dishName: string;
  authorName: string;
  authorId?: string;
  role: string;
  rating: number;
  text: string;
  createdAt: string;
  avatarUrl: string;
}

export function buildDishGallery(dish: DishDetail) {
  const ordered = [dish.imageUrl, ...dish.gallery];
  return ordered.filter((url, index) => Boolean(url) && ordered.indexOf(url) === index);
}

export function deriveStallCommunityReviews(dishes: DishDetail[]): StallCommunityReview[] {
  return dishes
    .flatMap((dish) =>
      dish.reviews.map((review) => {
        return {
          id: review.id,
          dishId: dish.id,
          dishName: dish.name,
          authorName: review.authorName,
          authorId: review.authorId,
          role: "Hungry member",
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt,
          avatarUrl: review.authorAvatarUrl ?? "",
        } satisfies StallCommunityReview;
      }),
    )
    .slice(0, 6);
}
