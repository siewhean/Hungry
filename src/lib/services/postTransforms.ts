import type { Bite } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";

export function biteToStallPost(
  bite: Bite,
  options: {
    authorAvatarUrl?: string;
    mediaType?: StallPost["mediaType"];
    mediaUrls?: string[];
    tags?: string[];
  } = {},
): StallPost {
  const mediaUrl = bite.photoUrl;
  const mediaUrls = options.mediaUrls?.length ? options.mediaUrls : [mediaUrl];

  return {
    id: bite.id,
    authorId: bite.authorId,
    venueId: bite.venueId,
    buildingId: bite.buildingId,
    authorName: bite.authorName,
    authorLocation: bite.venueName || bite.buildingName,
    authorAvatarUrl: options.authorAvatarUrl ?? bite.authorAvatar ?? mediaUrl,
    mediaType: options.mediaType ?? "photo",
    mediaUrl,
    mediaUrls,
    caption: bite.caption,
    tags: options.tags?.length ? options.tags : undefined,
    dishIds: [bite.dishId],
    createdAt: bite.createdAt,
    publishedStatus: "published",
    visibility: "public",
    likeCount: bite.cravingCount,
    savedCount: bite.savedCount,
    commentCount: 0,
    isStallAccount: false,
  };
}
