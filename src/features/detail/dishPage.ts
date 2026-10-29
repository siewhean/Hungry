import { buildDishGallery } from "@/features/detail/detailTransforms";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import type { DishDetail, Review } from "@/types/domain";

/** Photos in the dish page's swipeable hero. */
export const DISH_HERO_PHOTO_LIMIT = 8;

/**
 * The hero shows only the dish's own photos, each once and only when it passes the catalog
 * image check. Review photos stay in "Photos from reviews" and on each review card, so the
 * hero count does not jump when reviews load and a blocked raw URL never comes back.
 */
export function buildDishHeroPhotos(dish: DishDetail): string[] {
  const photos = buildDishGallery(dish)
    .map((url) => sanitizeCatalogImageUrl(url))
    .filter((url): url is string => Boolean(url));
  return Array.from(new Set(photos)).slice(0, DISH_HERO_PHOTO_LIMIT);
}

/**
 * The page's reviews after one was reported or its author blocked: the reported review goes,
 * and so does every other review by an author who is now blocked.
 */
export function withoutRemovedReview(
  reviews: readonly Review[],
  removedId: string,
  blockedAuthorIds: ReadonlySet<string>,
): Review[] {
  return reviews.filter(
    (review) =>
      review.id !== removedId && !(review.authorId && blockedAuthorIds.has(review.authorId)),
  );
}
