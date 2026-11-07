import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, FoodPortfolioStall, FoodPortfolioTopPosts } from "@/lib/services/types";

/** Posts per page; matches listUserPosts' default page size. */
export const FOOD_PORTFOLIO_PAGE_SIZE = 60;
/** Most dishes a portfolio pins as its top three. */
export const FOOD_PORTFOLIO_MAX_PINS = 3;

/** Newest first, no duplicates (a retry or page overlap can repeat a post). */
export function mergePortfolioPosts(current: Bite[], next: Bite[]): Bite[] {
  const seen = new Set(current.map((post) => post.id));
  return [...current, ...next.filter((post) => !seen.has(post.id))];
}

/** The photo a grid tile shows: the first media item, else the post photo. */
export function portfolioPostImage(post: Bite): string | undefined {
  return post.mediaUrls?.find((url) => Boolean(url?.trim())) ?? (post.photoUrl || undefined);
}

/** One page of someone's posts, newest first; null when the read failed (already reported). */
export async function loadPortfolioPostsPage(
  userId: string,
  offset: number,
): Promise<Bite[] | null> {
  try {
    return await getHungryService().social.listUserPosts(userId, {
      limit: FOOD_PORTFOLIO_PAGE_SIZE,
      offset,
    });
  } catch (error) {
    reportError(error, {
      screen: "FoodPortfolio",
      action: offset === 0 ? "load_posts" : "load_more_posts",
    });
    return null;
  }
}

/** The top three. A failed read is empty: the grid still shows every dish. */
export async function loadPortfolioTopPosts(userId: string): Promise<FoodPortfolioTopPosts> {
  try {
    return await getHungryService().foodPortfolio.getTopPosts(userId);
  } catch (error) {
    reportError(error, { screen: "FoodPortfolio", action: "load_top_posts" });
    return { posts: [], pinnedPostIds: [] };
  }
}

/** The stalls tab; null when the read failed (already reported). */
export async function loadPortfolioStalls(userId: string): Promise<FoodPortfolioStall[] | null> {
  try {
    return await getHungryService().foodPortfolio.listStalls(userId);
  } catch (error) {
    reportError(error, { screen: "FoodPortfolio", action: "load_stalls" });
    return null;
  }
}

/** Saves up to three pins; the ids the server kept, or null when it refused (already reported). */
export async function savePortfolioPins(postIds: string[]): Promise<string[] | null> {
  try {
    return await getHungryService().foodPortfolio.setPinnedPosts(
      postIds.slice(0, FOOD_PORTFOLIO_MAX_PINS),
    );
  } catch (error) {
    reportError(error, { screen: "FoodPortfolio", action: "save_pins" });
    return null;
  }
}
