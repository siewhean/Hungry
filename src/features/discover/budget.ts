/** Listed item prices only: this does not establish portion or dine-in pricing. */
export const BUDGET_OPTIONS = [5, 8, 10] as const;

export function resolveBudgetMaximum(selected: number, profileMaximum?: number): number {
  if (!Number.isFinite(selected) || selected <= 0) return 0;
  if (profileMaximum === undefined) return selected;
  return Number.isFinite(profileMaximum) && profileMaximum > 0
    ? Math.min(selected, profileMaximum)
    : 0;
}

export function isWithinBudget(price: number, maximum: number): boolean {
  return (
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(maximum) &&
    maximum > 0 &&
    price <= maximum
  );
}
