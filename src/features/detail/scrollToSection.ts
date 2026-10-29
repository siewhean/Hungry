export type SectionLayout = { y: number; height: number };

/**
 * Scroll offset that puts a section just under the collapsed header: the section's own y is
 * measured inside the content body, which is itself placed below the hero.
 * Undefined while either has not been measured, so a tap before layout does nothing.
 */
export function sectionScrollOffset(
  body: SectionLayout | null | undefined,
  section: SectionLayout | null | undefined,
  topInset: number,
): number | undefined {
  if (!body || !section) return undefined;
  return Math.max(0, body.y + section.y - topInset);
}
