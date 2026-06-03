import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore } from "@/store/useSocialStore";
import type { DishDetail, StallPost, VenueSummary } from "@/types/domain";
import { useComposerStore, type MediaItem } from "./useComposerStore";

type PublishMode = "both" | "post" | "review";

interface PublishComposerPostOptions {
  publishMode: PublishMode;
  routeDishId?: string;
  routeVenueId?: string;
}

interface ResolvedPublishTarget {
  dish: DishDetail;
  venue: VenueSummary;
}

function getAllVenues(repository: DataRepository) {
  return repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id));
}

function resolveVenueFromLocation(repository: DataRepository, locationName?: string | null) {
  if (!locationName) return undefined;
  const normalizedLocation = locationName.toLowerCase();
  return getAllVenues(repository).find((venue) => {
    const buildingName =
      repository
        .listBuildings()
        .find((building) => building.id === venue.buildingId)
        ?.name.toLowerCase() ?? "";
    return (
      venue.name.toLowerCase().includes(normalizedLocation) ||
      normalizedLocation.includes(venue.name.toLowerCase()) ||
      buildingName.includes(normalizedLocation) ||
      normalizedLocation.includes(buildingName)
    );
  });
}

function resolvePublishTarget(
  repository: DataRepository,
  options: PublishComposerPostOptions,
): ResolvedPublishTarget {
  const state = useComposerStore.getState();
  const routeVenue = options.routeVenueId
    ? repository.getVenueById(options.routeVenueId)
    : undefined;
  const locationVenue = resolveVenueFromLocation(repository, state.location?.name);
  const venue = routeVenue ?? locationVenue;

  const routeDish = options.routeDishId ? repository.getDishById(options.routeDishId) : undefined;
  const venueDish = venue ? repository.listDishesByVenue(venue.id)[0] : undefined;
  const fallbackDish = repository.listPopularNearby()[0];
  const dish = routeDish ?? venueDish ?? fallbackDish;
  const resolvedVenue = venue ?? (dish ? repository.getVenueById(dish.venueId) : undefined);

  if (!dish || !resolvedVenue) {
    throw new Error("Choose a dish or location before publishing.");
  }

  return { dish, venue: resolvedVenue };
}

function resolveMedia(media: MediaItem[], fallbackImageUrl: string) {
  const mediaUrls = media.length ? media.map((item) => item.uri) : [fallbackImageUrl];
  const firstMedia = media[0];
  const mediaTypes = media.length
    ? media.map((item) => (item.type === "video" ? ("video" as const) : ("photo" as const)))
    : [firstMedia?.type === "video" ? ("video" as const) : ("photo" as const)];
  return {
    mediaType: firstMedia?.type === "video" ? ("video" as const) : ("photo" as const),
    mediaUrl: mediaUrls[0] ?? fallbackImageUrl,
    mediaUrls,
    mediaTypes,
  };
}

export async function publishComposerPost(options: PublishComposerPostOptions) {
  if (options.publishMode === "review") {
    return undefined;
  }

  const repository = getDataRepository();
  const service = getHungryService();
  const state = useComposerStore.getState();
  const storedProfile = useProfileStore.getState().profile;
  const guestProfile = repository.getProfile(false);
  const profile =
    useSessionStore.getState().isAuthenticated && storedProfile.id === guestProfile.id
      ? repository.getProfile(true)
      : storedProfile;
  const { dish, venue } = resolvePublishTarget(repository, options);
  const media = resolveMedia(state.media, dish.imageUrl);
  const caption = state.postCaption.trim() || state.reviewCaption.trim() || dish.name;
  const rating = state.rating > 0 ? state.rating : dish.rating;

  const bite = await service.social.postBite({
    dishId: dish.id,
    venueId: venue.id,
    photoUrl: media.mediaUrl,
    mediaUrls: media.mediaUrls,
    mediaType: media.mediaType,
    mediaTypes: media.mediaTypes,
    showFoodContextOverlay: state.showFoodContextOverlay,
    caption,
    tags: [...state.foodTags, ...state.tasteTags],
    tasteStamp: dish.tasteVector ?? NEUTRAL_TASTE_VECTOR,
    rating,
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

  usePublishedPostStore.getState().upsertPost(post);
  useSocialStore.getState().initializeInteractions([post]);
  return post;
}
