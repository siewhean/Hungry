// Menu sections ride on dishes.availability_flags as "section:<Name>" so they reach
// every consumer read path (search_dishes, get_venue_detail, the legacy cache)
// without a schema change.

const SECTION_PREFIX = "section:";
const MAX_SECTION_LENGTH = 32;

function normalizeFlag(flag: string): string {
  return flag.toLowerCase().replace(/[\s-]+/g, "_");
}

export function hasAvailabilityFlag(flags: readonly string[] | undefined, target: string): boolean {
  const normalizedTarget = normalizeFlag(target);
  return flags?.some((flag) => normalizeFlag(flag) === normalizedTarget) ?? false;
}

export function isSoldOut(flags: readonly string[] | undefined): boolean {
  return hasAvailabilityFlag(flags, "sold_out");
}

export function isFeatured(flags: readonly string[] | undefined): boolean {
  return hasAvailabilityFlag(flags, "featured");
}

/** A featured dish a diner can order now: sold-out dishes lose their place at the top. */
export function isStallsPick(flags: readonly string[] | undefined): boolean {
  return isFeatured(flags) && !isSoldOut(flags);
}

export function isSectionFlag(flag: string): boolean {
  return flag.toLowerCase().startsWith(SECTION_PREFIX);
}

export function getDishSection(flags: readonly string[] | undefined): string | undefined {
  const flag = flags?.find(isSectionFlag);
  const section = flag?.slice(SECTION_PREFIX.length).trim();
  return section || undefined;
}

export function normalizeSectionName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SECTION_LENGTH);
}

export function withDishSection(flags: readonly string[], section: string | undefined): string[] {
  const withoutSection = flags.filter((flag) => !isSectionFlag(flag));
  const normalized = section ? normalizeSectionName(section) : "";
  return normalized ? [...withoutSection, `${SECTION_PREFIX}${normalized}`] : withoutSection;
}

export function listMenuSections(flagLists: readonly (readonly string[] | undefined)[]): string[] {
  const seen = new Map<string, string>();
  flagLists.forEach((flags) => {
    const section = getDishSection(flags);
    if (section && !seen.has(section.toLowerCase())) seen.set(section.toLowerCase(), section);
  });
  return Array.from(seen.values());
}

export interface DishSectionGroup<T> {
  /** null when no dish on the menu has a section: the list shows no headers. */
  title: string | null;
  data: T[];
}

/**
 * Groups dishes by menu section, sections A to Z and unsectioned dishes last under "Other".
 * Order inside a section is kept. A menu with no sections at all is one untitled group.
 */
export function groupDishesBySection<T extends { availabilityFlags?: string[] }>(
  dishes: readonly T[],
): DishSectionGroup<T>[] {
  if (dishes.length === 0) return [];
  const bySection = new Map<string, T[]>();
  const unsectioned: T[] = [];
  dishes.forEach((dish) => {
    const section = getDishSection(dish.availabilityFlags);
    if (!section) {
      unsectioned.push(dish);
      return;
    }
    const key = section.toLowerCase();
    const existing = bySection.get(key);
    if (existing) existing.push(dish);
    else bySection.set(key, [dish]);
  });
  if (bySection.size === 0) return [{ title: null, data: unsectioned }];
  const titles = new Map<string, string>();
  dishes.forEach((dish) => {
    const section = getDishSection(dish.availabilityFlags);
    if (section && !titles.has(section.toLowerCase())) titles.set(section.toLowerCase(), section);
  });
  const groups = Array.from(bySection.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, data]) => ({ title: titles.get(key) ?? key, data }));
  return unsectioned.length > 0 ? [...groups, { title: "Other", data: unsectioned }] : groups;
}
