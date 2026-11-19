import type { Bite, TasteStamp } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";

export function biteToStallPost(
  bite: Bite,
  options: {
    authorAvatarUrl?: string;
    mediaType?: StallPost["mediaType"];
    mediaUrls?: string[];
    tags?: string[];
    showFoodContextOverlay?: boolean;
  } = {},
): StallPost {
  const mediaUrl = bite.photoUrl;
  const mediaUrls = options.mediaUrls?.length
    ? options.mediaUrls
    : bite.mediaUrls?.length
      ? bite.mediaUrls
      : [mediaUrl];

  return {
    id: bite.id,
    authorId: bite.authorId,
    venueId: bite.venueId,
    buildingId: bite.buildingId,
    authorName: bite.authorName,
    authorLocation: bite.venueName || bite.buildingName,
    // No avatar: leave it empty so Avatar shows initials, never the food photo.
    authorAvatarUrl: options.authorAvatarUrl ?? bite.authorAvatar ?? "",
    mediaType: options.mediaType ?? bite.mediaType ?? "photo",
    mediaUrl,
    mediaUrls,
    showFoodContextOverlay: options.showFoodContextOverlay ?? bite.showFoodContextOverlay,
    caption: bite.caption,
    tags: options.tags?.length ? options.tags : bite.tags?.length ? bite.tags : undefined,
    dishIds: [bite.dishId],
    venueName: bite.venueName || undefined,
    venueUnitNumber: bite.unitNumber || undefined,
    buildingName: bite.buildingName || undefined,
    createdAt: bite.createdAt,
    publishedStatus: "published",
    visibility: "public",
    likeCount: bite.cravingCount,
    savedCount: bite.savedCount,
    viewerHasLiked: bite.viewerHasLiked,
    viewerHasSaved: bite.viewerHasSaved,
    commentCount: bite.commentCount ?? 0,
    shareCount: bite.shareCount,
    isStallAccount: false,
  };
}

const POST_LIFETIME_MS = 7 * 86_400_000;
const UNKNOWN_TASTE_STAMP: TasteStamp = {
  sweet: 0,
  spicy: 0,
  sour: 0,
  salty: 0,
  rich: 0,
  aromatic: 0,
};

/**
 * The Bite a persisted StallPost was published as. A stall post keeps only what the post screens
 * show, so the taste stamp, rating and price come back neutral: nothing reads them for a post page.
 */
export function stallPostToBite(post: StallPost, context: { dishName?: string } = {}): Bite {
  const createdAt = post.createdAt;
  const createdMs = new Date(createdAt).getTime();
  return {
    id: post.id,
    authorId: post.authorId ?? "",
    authorName: post.authorName,
    authorAvatar: post.authorAvatarUrl || undefined,
    dishId: post.dishIds[0] ?? "",
    dishName: context.dishName ?? "Unknown dish",
    venueId: post.venueId,
    venueName: post.venueName ?? post.authorLocation,
    unitNumber: post.venueUnitNumber ?? "",
    buildingId: post.buildingId,
    buildingName: post.buildingName ?? "",
    photoUrl: post.mediaUrl,
    mediaUrls: post.mediaUrls,
    mediaType: post.mediaType,
    showFoodContextOverlay: post.showFoodContextOverlay,
    caption: post.caption,
    tags: post.tags,
    tasteStamp: UNKNOWN_TASTE_STAMP,
    cravingCount: post.likeCount ?? 0,
    savedCount: post.savedCount ?? 0,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    viewerHasLiked: post.viewerHasLiked,
    viewerHasSaved: post.viewerHasSaved,
    rating: 0,
    price: 0,
    expiresAt: new Date(
      (Number.isFinite(createdMs) ? createdMs : Date.now()) + POST_LIFETIME_MS,
    ).toISOString(),
    createdAt,
  };
}
