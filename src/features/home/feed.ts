import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import type { DishDetail, StallPost, UserProfile, VenueSummary } from "@/types/domain";

export interface HomeFeedItem extends StallPost {
  venue: VenueSummary;
  dishes: DishDetail[];
}

export interface HomeFeedSection {
  title: string;
  items: HomeFeedItem[];
}

export interface HomeFeedBundle {
  sections: HomeFeedSection[];
  socialFeed: HomeFeedItem[];
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

function getProfileTasteKey(profile: UserProfile) {
  return Object.entries(profile.tasteVector)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

export function getHomeFeedBundleCacheKey(
  profile: UserProfile,
  options?: HomeFeedOptions,
  repository = getDataRepository(),
) {
  return JSON.stringify({
    dietary: [...profile.dietaryPreferences].sort(),
    favourites: [...profile.favouriteDishIds].sort(),
    followedAuthors: sortedEnabledKeys(options?.followedAuthors),
    followedUserIds: sortedEnabledKeys(options?.followedUserIds),
    profileId: profile.id,
    repository: getRepositoryCacheId(repository),
    refreshSeed: options?.refreshSeed ?? 0,
    taste: getProfileTasteKey(profile),
    tasteProfile: profile.tasteProfile?.neophiliaIndex ?? null,
  });
}

export function clearHomeFeedBundleCache() {
  homeFeedBundleCache.clear();
}

function rankHomeFeedItems(items: HomeFeedItem[], profile: UserProfile): HomeFeedItem[] {
  const candidateDishes = items.map((item) => item.dishes[0]).filter(Boolean) as DishDetail[];
  const ranked = runRecommendationPipeline(candidateDishes, {
    userVector: profile.tasteVector,
    dietaryFlags: profile.dietaryPreferences,
    neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
    radiusMeters: Number.MAX_SAFE_INTEGER,
    likedDishIds: [...profile.favouriteDishIds, ...(profile.onboardingSelectedDishIds ?? [])],
  });
  const ranks = new Map(ranked.map((result, index) => [result.dishId, index]));

  return [...items].sort((left, right) => {
    const leftRank = ranks.get(left.dishes[0]?.id ?? "") ?? Number.MAX_SAFE_INTEGER;
    const rightRank = ranks.get(right.dishes[0]?.id ?? "") ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

function isFollowedPost(item: HomeFeedItem, options?: HomeFeedOptions) {
  if (item.authorId && options?.followedUserIds?.[item.authorId]) {
    return true;
  }
  return Boolean(options?.followedAuthors?.[item.authorName]);
}

function rotateFeedGroup(items: HomeFeedItem[], refreshSeed = 0) {
  if (refreshSeed <= 0 || items.length <= 1) {
    return items;
  }
  const offset = refreshSeed % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function orderHomeSocialFeed(
  items: HomeFeedItem[],
  now: number,
  options?: HomeFeedOptions,
): HomeFeedItem[] {
  const recencySorted = [...items].sort(
    (left, right) => getPostTime(right, now) - getPostTime(left, now),
  );
  const followed = recencySorted.filter((item) => isFollowedPost(item, options));
  const unfollowed = recencySorted.filter((item) => !isFollowedPost(item, options));
  const refreshSeed = options?.refreshSeed ?? 0;

  return [...rotateFeedGroup(followed, refreshSeed), ...rotateFeedGroup(unfollowed, refreshSeed)];
}

async function buildHomeFeedItems(
  profile: UserProfile,
  repository = getDataRepository(),
): Promise<HomeFeedItem[]> {
  const postsById = new Map<string, StallPost>();
  for (const post of await listSharedStallPosts(repository)) {
    postsById.set(post.id, post);
  }
  const items = [...postsById.values()]
    .map((post) => {
      const venue = repository.getVenueById(post.venueId);
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

  return rankHomeFeedItems(items, profile);
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

export async function getHomeFeed(profile: UserProfile): Promise<HomeFeedSection[]> {
  return (await getHomeFeedBundle(profile)).sections;
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

  const promise = buildHomeFeedBundle(profile, options, repository);
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

async function buildHomeFeedBundle(
  profile: UserProfile,
  options?: HomeFeedOptions,
  repository = getDataRepository(),
): Promise<HomeFeedBundle> {
  const allPosts = await buildHomeFeedItems(profile, repository);
  const now = Date.now();
  const socialFeed = orderHomeSocialFeed(allPosts, now, options);

  // 1. Nearby picks use the current repository order without implying live wait-time data.
  const nearbyPicks = [...allPosts]
    .sort((a, b) => a.venue.buildingId.localeCompare(b.venue.buildingId))
    .slice(0, 5);

  // 2. Comfort Food / Heavy Rich (Taste-based)
  const comfort = allPosts
    .filter((p) => {
      const d = p.dishes[0];
      if (!d) return false;
      return d.tasteVector.rich > 7 || d.tasteVector.salty > 7 || d.tasteVector.sweet > 7;
    })
    .slice(0, 5);

  // 3. Top Rated by the Community (Rating-based)
  const topRated = [...allPosts]
    .sort((a, b) => (b.dishes[0]?.rating ?? 0) - (a.dishes[0]?.rating ?? 0))
    .slice(0, 5);

  return {
    socialFeed,
    sections: [
      { title: "Nearby picks", items: nearbyPicks },
      { title: "Comfort Food / Rich & Savory", items: comfort },
      { title: "Top Rated by Community", items: topRated },
    ],
  };
}
