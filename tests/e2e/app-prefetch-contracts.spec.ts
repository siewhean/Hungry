import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

const ROOT = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test.describe("page-agent prefetch contracts", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Static prefetch gate only needs Chromium.");
  });

  test("high-traffic page surfaces prefetch on intent without render-time overfetch", () => {
    const prefetch = read("src/features/navigation/prefetch.ts");
    const home = read("src/app/screens/home/HomeFeedScreen.tsx");
    const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
    const search = read("src/app/screens/search/SearchResultsScreen.tsx");
    const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");

    for (const expected of [
      "ExpoImage.prefetch",
      "schedulePrefetchWork",
      "MAX_IDLE_PREFETCH_WORK_PER_TICK",
      "export function prefetchDishDetail",
      "export function prefetchStallDetail",
      "export function prefetchPostDetail",
      "export function preloadRoute",
    ]) {
      expect(prefetch).toContain(expected);
    }

    expect(home).toContain("onPressIn={() => prefetchFeedCardRoute(item)}");
    expect(discover).toContain("onPressIn={() => prefetchBiteCard(bite)}");
    expect(search).toContain("onPressIn={() =>");
    expect(tabs).toContain("onPressIn={onPressIn}");
    expect(prefetch).not.toContain("repository: DataRepository = getDataRepository()");
  });
});
