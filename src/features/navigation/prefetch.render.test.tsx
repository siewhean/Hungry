import assert from "node:assert/strict";
import test from "node:test";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

test("routes with mount analytics or an experiment read are never preloaded", async () => {
  const { NON_PRELOADABLE_ROUTES, preloadRoute } = await import("./prefetch");
  const preloaded: string[] = [];
  const navigation = { preload: (routeName: string) => preloaded.push(routeName) };
  for (const routeName of ["WheelStack", "DecideForMeQuiz", "DecideForMeResult"]) {
    assert.ok(NON_PRELOADABLE_ROUTES.has(routeName), routeName);
    preloadRoute(navigation, routeName);
  }
  // A preloadable route does reach navigation.preload, so the check above is meaningful.
  preloadRoute(navigation, "DishDetail", { dishId: "d1" });
  // Preloads run on idle (fallback timer 160 ms, timeout 700 ms).
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.deepEqual(preloaded, ["DishDetail"]);
});
