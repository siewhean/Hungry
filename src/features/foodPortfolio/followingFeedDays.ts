// The Following feed's day groups: "Today", "Yesterday", then "Mon 3 Nov", newest first.

import type { Bite } from "@/lib/services/types";

export interface FeedDay {
  key: string;
  label: string;
  posts: Bite[];
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Groups posts (already newest first) by the local day they were posted. */
export function groupPostsByDay(posts: readonly Bite[], now: Date = new Date()): FeedDay[] {
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = dayKey(yesterdayDate);
  const days: FeedDay[] = [];
  const byKey = new Map<string, FeedDay>();
  for (const post of posts) {
    const created = new Date(post.createdAt);
    const valid = !Number.isNaN(created.getTime());
    const key = valid ? dayKey(created) : "unknown";
    let day = byKey.get(key);
    if (!day) {
      const label = !valid
        ? "Earlier"
        : key === today
          ? "Today"
          : key === yesterday
            ? "Yesterday"
            : created.toLocaleDateString("en-SG", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
      day = { key, label, posts: [] };
      byKey.set(key, day);
      days.push(day);
    }
    day.posts.push(post);
  }
  return days;
}
