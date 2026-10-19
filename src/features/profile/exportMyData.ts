import { SUPPORT_EMAIL } from "@/constants/links";
import type { HungryService } from "@/lib/services/types";

export const MY_DATA_EXPORT_VERSION = 1;

type Section<T> = { ok: true; data: T } | { ok: false; error: string };

async function section<T>(load: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const FOLLOW_EXPORT_PAGE_SIZE = 500;

/** Reads every page so the export is not cut off at the list RPCs' default page size. */
async function loadAllFollowRows<T>(
  loadPage: (page: { limit: number; offset: number }) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = await loadPage({ limit: FOLLOW_EXPORT_PAGE_SIZE, offset: rows.length });
    rows.push(...page);
    if (page.length < FOLLOW_EXPORT_PAGE_SIZE) return rows;
  }
}

/**
 * PDPA access request: a copy of the personal data the signed-in user can read
 * through the app. Each section loads independently so one failing read does
 * not block the rest of the export.
 */
export async function buildMyDataExport(
  service: Pick<HungryService, "profile" | "reviews" | "social">,
) {
  const profile = await service.profile.getProfile();
  const userId = profile.id;

  const [reviews, posts, favouriteDishIds, savedPosts, followers, following] = await Promise.all([
    section(() => service.reviews.getUserReviews(userId)),
    section(() => service.social.listUserPosts(userId)),
    section(() => service.profile.getFavouriteDishIds()),
    section(() => service.social.getSavedBites()),
    section(() => loadAllFollowRows((page) => service.social.listFollowers(userId, page))),
    section(() => loadAllFollowRows((page) => service.social.listFollowing(userId, page))),
  ]);

  return {
    exportVersion: MY_DATA_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    otherDataRequests: `This export covers what the app can read. For any other personal data Hungry holds, email ${SUPPORT_EMAIL}.`,
    profile,
    reviews,
    posts,
    favouriteDishIds,
    savedPosts,
    followers,
    following,
  };
}
