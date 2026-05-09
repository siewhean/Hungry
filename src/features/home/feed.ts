import { getDataRepository, getSimilarityScore } from "@/lib/services/serviceProvider";
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

async function buildHomeFeedItems(profile: UserProfile): Promise<HomeFeedItem[]> {
  const repository = getDataRepository();
  const postsById = new Map<string, StallPost>();
  for (const post of await listSharedStallPosts(repository)) {
    postsById.set(post.id, post);
  }
  return [...postsById.values()]
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
    .filter((p): p is HomeFeedItem => !!p)
    .sort((left, right) => {
      const leftDish = left.dishes[0];
      const rightDish = right.dishes[0];
      const leftScore = leftDish
        ? getSimilarityScore(leftDish.tasteVector, profile.tasteVector)
        : 0;
      const rightScore = rightDish
        ? getSimilarityScore(rightDish.tasteVector, profile.tasteVector)
        : 0;
      return rightScore - leftScore;
    });
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

export async function getHomeSocialFeed(profile: UserProfile): Promise<HomeFeedItem[]> {
  return (await getHomeFeedBundle(profile)).socialFeed;
}

export async function getHomeFeed(profile: UserProfile): Promise<HomeFeedSection[]> {
  return (await getHomeFeedBundle(profile)).sections;
}

export async function getHomeFeedBundle(profile: UserProfile): Promise<HomeFeedBundle> {
  const allPosts = await buildHomeFeedItems(profile);
  const now = Date.now();
  const socialFeed = [...allPosts].sort(
    (left, right) => getPostTime(right, now) - getPostTime(left, now),
  );

  // 1. Fastest Near You (Shortest distance)
  const fastest = [...allPosts]
    .sort((a, b) => a.venue.buildingId.localeCompare(b.venue.buildingId)) // Mock distance logic
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
      { title: "Fastest Near You", items: fastest },
      { title: "Comfort Food / Rich & Savory", items: comfort },
      { title: "Top Rated by Community", items: topRated },
    ],
  };
}
