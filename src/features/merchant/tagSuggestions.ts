/** Adds tags to a list: trimmed, blanks dropped, and a tag already there (any case) is not added again. */
export function addTags(current: readonly string[], additions: readonly string[]): string[] {
  const next = [...current];
  const seen = new Set(next.map((tag) => tag.toLowerCase()));
  for (const raw of additions) {
    const tag = raw.trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      next.push(tag);
    }
  }
  return next;
}

/** The tags used on the most dishes of this menu, most used first, ties in the order first seen. */
export function mostUsedTags(
  dishes: readonly { tasteTags?: readonly string[] }[],
  limit = 5,
): string[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const dish of dishes) {
    for (const raw of new Set((dish.tasteTags ?? []).map((tag) => tag.trim()))) {
      if (!raw) continue;
      const key = raw.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { tag: raw, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.tag);
}
