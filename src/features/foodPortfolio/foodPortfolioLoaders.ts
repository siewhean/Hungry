import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type {
  Bite,
  FoodPortfolioStall,
  PortfolioDiaryEntry,
  PortfolioPicks,
} from "@/lib/services/types";

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

/** Diary entries per page (the server's default; it allows up to 60). */
export const FOOD_PORTFOLIO_DIARY_PAGE_SIZE = 30;

/** Newest first, no duplicates (a retry or page overlap can repeat an entry). */
export function mergeDiaryEntries(
  current: PortfolioDiaryEntry[],
  next: PortfolioDiaryEntry[],
): PortfolioDiaryEntry[] {
  const seen = new Set(current.map((entry) => entry.post.id));
  return [...current, ...next.filter((entry) => !seen.has(entry.post.id))];
}

/**
 * One page of someone's diary, newest first, after `last` (the last entry shown) when given; null
 * when the read failed (already reported).
 */
export async function loadPortfolioDiaryPage(
  userId: string,
  last?: PortfolioDiaryEntry,
): Promise<PortfolioDiaryEntry[] | null> {
  try {
    return await getHungryService().foodPortfolio.getDiary(userId, {
      limit: FOOD_PORTFOLIO_DIARY_PAGE_SIZE,
      before: last ? { publishedAt: last.post.createdAt, id: last.post.id } : undefined,
    });
  } catch (error) {
    reportError(error, {
      screen: "FoodPortfolio",
      action: last ? "load_more_diary" : "load_diary",
    });
    return null;
  }
}

/** The top three and bests by dish type. A failed read is empty: the diary still shows. */
export async function loadPortfolioPicks(userId: string): Promise<PortfolioPicks> {
  try {
    return await getHungryService().foodPortfolio.getPicks(userId);
  } catch (error) {
    reportError(error, { screen: "FoodPortfolio", action: "load_picks" });
    return { topThree: [], bests: [] };
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
