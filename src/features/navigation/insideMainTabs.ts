export type NavLike = {
  getState?: () => { routeNames?: string[] } | undefined;
  getParent?: () => NavLike | undefined;
};

/** True when a navigator at or above `navigation` is the diner or merchant tab bar. */
export function isInsideMainTabs(navigation: NavLike | undefined): boolean {
  let current = navigation;
  while (current) {
    const names = current.getState?.()?.routeNames ?? [];
    const diner = names.includes("Discover") && names.includes("Review");
    const merchant = names.includes("Dashboard") && names.includes("Menu");
    if (diner || merchant) return true;
    current = current.getParent?.();
  }
  return false;
}
