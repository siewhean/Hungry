import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import type { CatalogRawDishCard } from "@/lib/services/catalog";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import type { Bite } from "@/lib/services/types";

/** A catalogue dish as a Home rail card, so a rail can keep going past the feed's own dishes. */
export function catalogDishToBite(card: CatalogRawDishCard): Bite {
  const photoUrl = sanitizeCatalogImageUrl(card.imageUrl) ?? "";
  const createdAt = card.updatedAt ?? new Date(0).toISOString();
  return {
    id: `bite-${card.id}`,
    authorId: `venue-${card.venueId}`,
    authorName: card.venueName,
    authorAvatar: photoUrl || undefined,
    dishId: card.id,
    dishName: card.name,
    venueId: card.venueId,
    venueName: card.venueName,
    unitNumber: "",
    buildingId: card.buildingId,
    buildingName: card.buildingName ?? card.venueName,
    photoUrl,
    mediaUrls: photoUrl ? [photoUrl] : [],
    imageSourceType: photoUrl ? "dish" : "local_fallback",
    caption: card.description ?? card.name,
    tasteStamp: NEUTRAL_TASTE_VECTOR,
    cravingCount: card.reviewCount ?? 0,
    savedCount: 0,
    ...(card.distanceMeters === undefined ? {} : { distanceMeters: card.distanceMeters }),
    rating: card.rating ?? 0,
    price: card.price ?? 0,
    ...(card.priceBasis ? { priceBasis: card.priceBasis } : {}),
    expiresAt: createdAt,
    createdAt,
  };
}
