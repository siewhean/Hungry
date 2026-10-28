/** How many dishes the grid screen shows. */
export const GRID_SIZE = 12;
/** How many dishes the swipe screen shows. */
export const SWIPE_SIZE = 5;
/** How many dishes the results screen shows. */
export const RESULT_SIZE = 3;
/** How many hearts the grid needs before Continue turns on. */
export const MIN_GRID_LIKES = 3;

type WithId = { id: string };

/** The grid: the best-ranked dishes first. */
export function gridDishes<T extends WithId>(pool: readonly T[]): T[] {
  return pool.slice(0, GRID_SIZE);
}

/**
 * The swipe cards: dishes the grid did not show come first; if the pool is short, grid dishes the
 * person did not heart fill the rest, so the screen is never empty while a pool exists.
 */
export function swipeDishes<T extends WithId>(
  pool: readonly T[],
  likedIds: readonly string[],
): T[] {
  const shownInGrid = new Set(gridDishes(pool).map((dish) => dish.id));
  const fresh = pool.filter((dish) => !shownInGrid.has(dish.id));
  const refills = gridDishes(pool).filter((dish) => !likedIds.includes(dish.id));
  return [...fresh, ...refills].slice(0, SWIPE_SIZE);
}

/**
 * The top picks: never a dish the person passed on, and dishes they have not hearted yet come
 * before ones they have (they already know those). Ranking order is otherwise kept.
 */
export function resultDishes<T extends WithId>(
  pool: readonly T[],
  signals: { liked: readonly string[]; passed: readonly string[] },
): T[] {
  const allowed = pool.filter((dish) => !signals.passed.includes(dish.id));
  const unseen = allowed.filter((dish) => !signals.liked.includes(dish.id));
  const hearted = allowed.filter((dish) => signals.liked.includes(dish.id));
  return [...unseen, ...hearted].slice(0, RESULT_SIZE);
}
