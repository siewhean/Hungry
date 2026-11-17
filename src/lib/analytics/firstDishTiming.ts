// "Time to first dish" (retention plan): seconds from app start to the first
// dish detail or Decide For Me result in this app session. Module load is
// close enough to app open for a seconds-level metric.
let sessionStartedAt = Date.now();
let hasSeenFirstDish = false;

/** Extra event properties for the first dish of the session; empty afterwards. */
export function firstDishTimingProps(now = Date.now()): Record<string, number | boolean> {
  if (hasSeenFirstDish) return {};
  hasSeenFirstDish = true;
  return {
    is_first_dish_of_session: true,
    seconds_since_app_open: Math.max(0, Math.round((now - sessionStartedAt) / 1000)),
  };
}

export function resetFirstDishTimingForTests(startedAt = Date.now()) {
  sessionStartedAt = startedAt;
  hasSeenFirstDish = false;
}
