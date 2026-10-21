import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { createClientReviewId, resolveWouldRecommend } from "@/features/review/reviewDraft";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { DataRepository, HungryService } from "@/lib/services/types";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore } from "@/store/useSocialStore";
import type { DishDetail, StallPost } from "@/types/domain";
import { useComposerStore, type MediaItem, type PublishMode } from "./useComposerStore";

export interface PublishComposerPostOptions {
  publishMode: PublishMode;
  routeDishId?: string;
  routeVenueId?: string;
  /** Reused by the caller across retries so a retried publish resumes the same post. */
  clientPostId?: string;
}

interface ResolvedPublishTarget {
  dish: DishDetail;
  venueId: string;
}

/**
 * Posts and reviews must name the exact dish. A location or stall alone is never enough:
 * guessing (e.g. the stall's first dish) attaches content to the wrong dish.
 */
async function resolvePublishTarget(
  repository: DataRepository,
  service: HungryService,
  options: PublishComposerPostOptions,
): Promise<ResolvedPublishTarget> {
  const routeDishId = options.routeDishId?.trim();
  if (!routeDishId) {
    throw new Error("Choose a dish before publishing.");
  }

  const dish =
    repository.getDishById(routeDishId) ??
    (await service.discovery.getDish(routeDishId).catch(() => undefined));
  if (!dish) {
    throw new Error("We couldn't find that dish. Choose it again before publishing.");
  }

  const routeVenueId = options.routeVenueId?.trim();
  if (routeVenueId && routeVenueId !== dish.venueId) {
    throw new Error("That dish isn't on this stall's menu. Choose the dish again.");
  }

  return { dish, venueId: dish.venueId };
}

function resolveMedia(media: MediaItem[]) {
  if (media.length === 0) {
    throw new Error("Add a photo or video before publishing.");
  }

  const mediaUrls = media.map((item) => item.uri);
  const firstMedia = media[0];
  const mediaTypes = media.map((item) =>
    item.type === "video" ? ("video" as const) : ("photo" as const),
  );
  return {
    mediaType: firstMedia?.type === "video" ? ("video" as const) : ("photo" as const),
    mediaUrl: mediaUrls[0] ?? "",
    mediaUrls,
    mediaTypes,
  };
}

export async function publishComposerPost(options: PublishComposerPostOptions) {
  const repository = getDataRepository();
  const service = getHungryService();
  const state = useComposerStore.getState();
  const storedProfile = useProfileStore.getState().profile;
  const guestProfile = repository.getProfile(false);
  const profile =
    useSessionStore.getState().isAuthenticated && storedProfile.id === guestProfile.id
      ? repository.getProfile(true)
      : storedProfile;
  const { dish, venueId } = await resolvePublishTarget(repository, service, options);
  const shouldPublishPost = options.publishMode === "both" || options.publishMode === "post";
  const shouldSubmitReview =
    options.publishMode === "review" ||
    (options.publishMode === "both" && (state.rating > 0 || state.reviewCaption.trim().length > 0));
  const caption = state.postCaption.trim() || state.reviewCaption.trim() || dish.name;
  // The poster's own rating only: 0 when they gave none, never the dish average.
  const rating = state.rating > 0 ? state.rating : 0;
  const media = shouldPublishPost ? resolveMedia(state.media) : null;
  const applyReviewProfileState = () => {
    const profileStore = useProfileStore.getState();
    profileStore.addReviewedDish(dish.id);
    profileStore.addReview(dish);
    profileStore.recordReviewEntry(dish.id, {
      rating: state.rating,
      text: state.reviewCaption.trim() || state.postCaption.trim(),
      tags: [...state.foodTags, ...state.tasteTags],
    });
  };

  if (shouldSubmitReview) {
    if (state.rating <= 0) {
      throw new Error("Add a rating before publishing a review.");
    }
    // Reuse the id across retries: if the post step fails after the review was saved,
    // "Try Again" resumes the review instead of inserting a duplicate.
    const clientReviewId = state.pendingReviewId ?? createClientReviewId();
    useComposerStore.getState().setPendingReviewId(clientReviewId);
    await service.reviews.submitReview({
      dishId: dish.id,
      venueId,
      rating: state.rating,
      text: state.reviewCaption.trim() || state.postCaption.trim(),
      tags: [...state.foodTags, ...state.tasteTags],
      photos: state.media.filter((item) => item.type === "image").map((item) => item.uri),
      // Same rule as the review editor when no explicit Yes/No was given.
      wouldRecommend: resolveWouldRecommend(undefined, state.rating),
      clientReviewId,
    });
  }

  if (!shouldPublishPost) {
    if (shouldSubmitReview) {
      applyReviewProfileState();
      useComposerStore.getState().setPendingReviewId(null);
    }
    return undefined;
  }
  if (!media) {
    throw new Error("Add a photo or video before publishing.");
  }

  const bite = await service.social.postBite({
    dishId: dish.id,
    venueId,
    photoUrl: media.mediaUrl,
    mediaUrls: media.mediaUrls,
    mediaType: media.mediaType,
    mediaTypes: media.mediaTypes,
    showFoodContextOverlay: state.showFoodContextOverlay,
    caption,
    tags: [...state.foodTags, ...state.tasteTags],
    tasteStamp: dish.tasteVector ?? NEUTRAL_TASTE_VECTOR,
    rating,
    clientPostId: options.clientPostId,
    author: {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  });

  const transformedPost = biteToStallPost(bite, {
    authorAvatarUrl: bite.authorAvatar ?? profile.avatarUrl ?? bite.photoUrl,
    mediaType: bite.mediaType ?? media.mediaType,
    mediaUrls: bite.mediaUrls ?? media.mediaUrls,
    tags: [...state.foodTags, ...state.tasteTags],
    showFoodContextOverlay: state.showFoodContextOverlay,
  });
  const post: StallPost = {
    ...transformedPost,
    authorId: profile.id,
    authorName: profile.displayName,
    authorAvatarUrl: profile.avatarUrl ?? transformedPost.authorAvatarUrl,
    publishedStatus: "published",
    visibility: "public",
  };

  if (shouldSubmitReview) {
    applyReviewProfileState();
    useComposerStore.getState().setPendingReviewId(null);
  }
  usePublishedPostStore.getState().upsertPost(post);
  useSocialStore.getState().initializeInteractions([post]);
  return post;
}
