// The story behind one Passport stamp trail: which visited stalls count towards it, when each
// level was earned and which stall earned it. Pure: the caller says which stalls match.

import type { PassportCategory, PassportStampDefinition } from "@/types/domain";

export interface StampHistoryStall {
  stallId: string;
  /** The stall's name, when it is known. */
  name?: string;
  /** When the diner marked it visited (ISO), when it is known. */
  triedAt?: string;
}

export interface StampHistoryLevel {
  stamp: PassportStampDefinition;
  /** When this level was reached: the visit that brought the count to its threshold. */
  earnedAt?: string;
  /** The visit that reached it. */
  unlockedBy?: StampHistoryStall;
}

export interface StampHistory {
  /** Every visited stall that counts, the most recent first. */
  stalls: StampHistoryStall[];
  /** The levels earned, first level first. */
  earned: StampHistoryLevel[];
  /** The next level and how many more stalls it needs, unless the trail is complete. */
  next?: { stamp: PassportStampDefinition; remaining: number };
}

function visitTime(stall: StampHistoryStall): number {
  const time = stall.triedAt ? Date.parse(stall.triedAt) : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export function buildStampHistory({
  category,
  stamps,
  triedStalls,
  matches,
  nameOf,
}: {
  category: PassportCategory;
  /** All stamp definitions; only this category's are used. */
  stamps: readonly PassportStampDefinition[];
  triedStalls: readonly { stallId: string; triedAt?: string }[];
  matches: (stallId: string) => boolean;
  nameOf: (stallId: string) => string | undefined;
}): StampHistory {
  // Oldest visit first, so the nth visit is the one that reached a threshold of n.
  const counted = triedStalls
    .filter((stall) => matches(stall.stallId))
    .map((stall) => ({ ...stall, name: nameOf(stall.stallId) }))
    .sort((a, b) => visitTime(a) - visitTime(b) || a.stallId.localeCompare(b.stallId));
  const levels = stamps
    .filter((stamp) => stamp.categoryId === category.id)
    .sort((a, b) => a.threshold - b.threshold);
  const earned: StampHistoryLevel[] = [];
  let next: StampHistory["next"];
  for (const stamp of levels) {
    if (counted.length >= stamp.threshold) {
      const unlockedBy = counted[stamp.threshold - 1];
      earned.push({ stamp, earnedAt: unlockedBy?.triedAt, unlockedBy });
    } else if (!next) {
      next = { stamp, remaining: stamp.threshold - counted.length };
    }
  }
  return { stalls: [...counted].reverse(), earned, next };
}

/** "3 Nov 2026", or null when the date is missing or unreadable. */
export function formatStampDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}
