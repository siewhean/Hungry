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
