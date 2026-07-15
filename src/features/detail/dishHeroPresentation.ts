import { getDiscoverCardImage, getDishImageCandidates } from "@/features/discover/bites";
import {
  getDishFallbackImageKey,
  type DishFallbackImageKey,
} from "@/features/discover/presentation";
import type { DishDetail } from "@/types/domain";

export type DishHeroSelection =
  | {
      kind: "dish";
      imageUrl: string;
    }
  | {
      kind: "representative";
      fallbackKey: DishFallbackImageKey;
    };

/**
 * Select only a source-backed URL accepted by the Discover media guard. When
 * none is usable, the caller must visibly identify the local asset as
 * representative rather than describing it as a photo of the exact dish.
 */
export function getDishHeroSelection(
  dish: Pick<
    DishDetail,
    "cuisineTags" | "foodTypeTag" | "gallery" | "imageUrl" | "name" | "venueName"
  >,
): DishHeroSelection {
  const selected = getDiscoverCardImage(getDishImageCandidates(dish));
  if (selected.imageUrl) {
    return { kind: "dish", imageUrl: selected.imageUrl };
  }

  return {
    kind: "representative",
    fallbackKey: getDishFallbackImageKey(dish),
  };
}
