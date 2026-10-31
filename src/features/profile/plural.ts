/** "1 Review", "2 Reviews": the noun agrees with the count. A non-number (loading, "20+") keeps the plural. */
export function pluralLabel(count: number | string | null, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
