import { trackAnalyticsEvent } from "@/lib/analytics";

/** The part of a React Navigation state this module reads. */
type NavState = {
  index?: number;
  routes: { name: string; state?: NavState }[];
};

/**
 * The name of the screen the person is on: the deepest focused route, so a tab shows as `Home`
 * or `Profile` rather than `MainTabs`. Names only: params (dish ids, search text) never leave.
 */
export function getActiveScreenName(state: NavState | undefined): string | undefined {
  let current = state;
  let name: string | undefined;
  while (current && current.routes.length > 0) {
    const route = current.routes[Math.min(current.index ?? 0, current.routes.length - 1)];
    if (!route) break;
    name = route.name;
    current = route.state;
  }
  return name;
}

/**
 * Tracks `screen_viewed` each time the focused screen changes, with the screen before it and how
 * long that one was open. Add the returned function to a NavigationContainer's `onStateChange`.
 * This is what shows the most and least used parts of the app.
 */
export function createScreenTracker(now: () => number = Date.now) {
  let current: string | undefined;
  let since = now();
  return (state: NavState | undefined): void => {
    const next = getActiveScreenName(state);
    if (!next || next === current) return;
    const at = now();
    trackAnalyticsEvent("screen_viewed", {
      screen: next,
      ...(current ? { previous_screen: current, previous_duration_ms: at - since } : {}),
    });
    current = next;
    since = at;
  };
}

/** The one tracker both navigators share, so a hand-over between them keeps its history. */
export const trackScreen = createScreenTracker();
