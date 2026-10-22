import { getDataRepository } from "@/lib/services/serviceProvider";
import {
  listSharedStallPostsPage,
  type SharedFeedCursor,
} from "@/features/social/sharedStallPosts";
import type { DishDetail, StallPost, UserProfile, VenueSummary } from "@/types/domain";

export type { SharedFeedCursor as HomeFeedCursor } from "@/features/social/sharedStallPosts";

export interface HomeFeedItem extends StallPost {
  venue: VenueSummary;
  dishes: DishDetail[];
}

export interface HomeFeedBundle {
  socialFeed: HomeFeedItem[];
  /** Where the next page starts; null when the feed has no more pages. */
  nextCursor: SharedFeedCursor | null;
}

export interface HomeFeedOptions {
  followedAuthors?: Record<string, boolean>;
  followedUserIds?: Record<string, boolean>;
  refreshSeed?: number;
}

const HOME_FEED_BUNDLE_CACHE_TTL_MS = 5_000;
const homeFeedBundleCache = new Map<
  string,
  { createdAt: number; promise: Promise<HomeFeedBundle> }
>();
const repositoryCacheIds = new WeakMap<object, number>();
let nextRepositoryCacheId = 1;

function getRepositoryCacheId(repository: object) {
  const cachedId = repositoryCacheIds.get(repository);
  if (cachedId) {
    return cachedId;
  }
  const id = nextRepositoryCacheId;
  nextRepositoryCacheId += 1;
  repositoryCacheIds.set(repository, id);
  return id;
}

function sortedEnabledKeys(record?: Record<string, boolean>) {
  return Object.keys(record ?? {})
    .filter((key) => record?.[key])
    .sort();
}

/**
 * The feed is the newest posts, followed authors first. Nothing about the viewer's
 * taste changes which posts it holds or their order, so the key holds only the account,
 * who they follow, and the refresh counter.
 */
export function getHomeFeedBundleCacheKey(
  profile: UserProfile,
  options?: HomeFeedOptions,
  repository = getDataRepository(),
) {
  return JSON.stringify({
    followedAuthors: sortedEnabledKeys(options?.followedAuthors),
    followedUserIds: sortedEnabledKeys(options?.followedUserIds),
    profileId: profile.id,
    repository: getRepositoryCacheId(repository),
    refreshSeed: options?.refreshSeed ?? 0,
  });
}

export function clearHomeFeedBundleCache() {
  homeFeedBundleCache.clear();
}

/** "Maxwell Food Centre · #01-23". Floor and unit are joined only when present. */
export function formatVenueLine(venue: Pick<VenueSummary, "name" | "floor" | "unitNumber">) {
  const unit = [venue.floor, venue.unitNumber]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return unit ? `${venue.name} · ${unit}` : venue.name;
}

function isFollowedPost(item: HomeFeedItem, options?: HomeFeedOptions) {
  if (item.authorId && options?.followedUserIds?.[item.authorId]) {
    return true;
  }
  return Boolean(options?.followedAuthors?.[item.authorName]);
}

function orderHomeSocialFeed(
  items: HomeFeedItem[],
  now: number,
  options?: HomeFeedOptions,
): HomeFeedItem[] {
  const recencySorted = [...items].sort(
    (left, right) => getPostTime(right, now) - getPostTime(left, now),
  );
  // Newest first within each group. A pull-to-refresh never moves the newest post down.
  const followed = recencySorted.filter((item) => isFollowedPost(item, options));
  const unfollowed = recencySorted.filter((item) => !isFollowedPost(item, options));

  return [...followed, ...unfollowed];
}

/**
 * A post at a venue the local catalog has not loaded (a new merchant, or a cold
 * start) keeps its card: build the venue from the fields the feed read returned.
 */
export function venueFromPost(post: StallPost): VenueSummary | undefined {
  const name = post.venueName?.trim();
  if (!post.venueId || !name) return undefined;
  return {
    id: post.venueId,
    buildingId: post.buildingId,
    name,
    unitNumber: post.venueUnitNumber ?? "",
    floor: "",
    isOpen: true,
    topDishId: post.dishIds[0] ?? "",
    operatingHours: "",
    deliveryLinks: [],
    buildingName: post.buildingName,
  };
}

function toHomeFeedItems(posts: StallPost[], repository = getDataRepository()): HomeFeedItem[] {
  const postsById = new Map<string, StallPost>();
  for (const post of posts) {
    postsById.set(post.id, post);
  }
  return [...postsById.values()]
    .map((post) => {
      const venue = repository.getVenueById(post.venueId) ?? venueFromPost(post);
      const dishes = post.dishIds
        .map((dishId) => repository.getDishById(dishId))
        .filter(Boolean) as DishDetail[];

      if (!venue) return null;

      return {
        ...post,
        venue,
        dishes,
      } satisfies HomeFeedItem;
    })
    .filter((p): p is HomeFeedItem => !!p);
}

const RELATIVE_TIME_UNITS: Record<string, number> = {
  m: 60_000,
  min: 60_000,
  minute: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hour: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
};

function getPostTime(post: StallPost, now = Date.now()): number {
  const timestamp = new Date(post.createdAt).getTime();
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }

  const normalized = post.createdAt.trim().toLowerCase();
  if (normalized === "now") {
    return now;
  }
  if (normalized === "yesterday") {
    return now - RELATIVE_TIME_UNITS.day;
  }

  const relativeMatch = normalized.match(
    /^(\d+)\s*(m|min|minute|h|hr|hour|d|day|w|week)s?(?:\s+ago)?$/,
  );
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unitMs = RELATIVE_TIME_UNITS[relativeMatch[2] ?? ""];
    if (Number.isFinite(amount) && unitMs) {
      return now - amount * unitMs;
    }
  }

  return 0;
}

export async function getHomeSocialFeed(
  profile: UserProfile,
  options?: HomeFeedOptions,
): Promise<HomeFeedItem[]> {
  return (await getHomeFeedBundle(profile, options)).socialFeed;
}

export async function getHomeFeedBundle(
  profile: UserProfile,
  options?: HomeFeedOptions,
): Promise<HomeFeedBundle> {
  const repository = getDataRepository();
  const cacheKey = getHomeFeedBundleCacheKey(profile, options, repository);
  const cached = homeFeedBundleCache.get(cacheKey);
  const cacheAgeMs = cached ? Date.now() - cached.createdAt : Number.POSITIVE_INFINITY;
  if (cached && cacheAgeMs < HOME_FEED_BUNDLE_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = buildHomeFeedBundle(options, repository);
  homeFeedBundleCache.set(cacheKey, {
    createdAt: Date.now(),
    promise,
  });

  try {
    return await promise;
  } catch (error) {
    homeFeedBundleCache.delete(cacheKey);
    throw error;
  }
}

/** The page after `cursor`: newest first, followed authors first within the page. */
export async function getHomeFeedNextPage(
  cursor: SharedFeedCursor,
  options?: HomeFeedOptions,
): Promise<HomeFeedBundle> {
  const repository = getDataRepository();
  const page = await listSharedStallPostsPage(repository, cursor);
  return {
    socialFeed: orderHomeSocialFeed(toHomeFeedItems(page.posts, repository), Date.now(), options),
    nextCursor: page.nextCursor,
  };
}

async function buildHomeFeedBundle(
  options?: HomeFeedOptions,
  repository = getDataRepository(),
): Promise<HomeFeedBundle> {
  const page = await listSharedStallPostsPage(repository);
  return {
    socialFeed: orderHomeSocialFeed(toHomeFeedItems(page.posts, repository), Date.now(), options),
    nextCursor: page.nextCursor,
  };
}
