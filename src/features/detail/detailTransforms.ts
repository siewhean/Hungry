import type { DishDetail } from "@/types/domain";

export interface StallCommunityReview {
  id: string;
  dishId: string;
  dishName: string;
  authorName: string;
  role: string;
  rating: number;
  text: string;
  createdAt: string;
  avatarUrl: string;
}

const AVATAR_POOL = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop",
  "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=96&h=96&fit=crop",
] as const;

function hashName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function reviewRoleFromRating(rating: number) {
  if (rating >= 4.5) {
    return "Verified Foodie";
  }
  if (rating >= 3.5) {
    return "Hungry Member";
  }
  return "Local Reviewer";
}

export function buildDishGallery(dish: DishDetail) {
  const ordered = [dish.imageUrl, ...dish.gallery];
  return ordered.filter((url, index) => Boolean(url) && ordered.indexOf(url) === index);
}

export function deriveStallCommunityReviews(dishes: DishDetail[]): StallCommunityReview[] {
  return dishes
    .flatMap((dish) =>
      dish.reviews.map((review) => {
        const avatarIndex = hashName(review.authorName) % AVATAR_POOL.length;
        return {
          id: `${dish.id}-${review.id}`,
          dishId: dish.id,
          dishName: dish.name,
          authorName: review.authorName,
          role: reviewRoleFromRating(review.rating),
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt,
          avatarUrl: review.authorAvatarUrl ?? AVATAR_POOL[avatarIndex],
        } satisfies StallCommunityReview;
      }),
    )
    .slice(0, 6);
}
