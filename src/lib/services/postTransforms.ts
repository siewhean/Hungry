import type { Bite } from "@/lib/services/types";
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
    authorAvatarUrl: options.authorAvatarUrl ?? bite.authorAvatar ?? mediaUrl,
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
    commentCount: 0,
    isStallAccount: false,
  };
}
