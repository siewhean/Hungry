import { test, expect } from "./fixtures";
import {
  assertNoCrashVisible,
  clickDevButton,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

const ROUTE_SMOKES = [
  { label: "Home", expectedText: "Chicken Rice" },
  { label: "Discover", expectedText: "Dishes near you" },
  { label: "Search", expectedPlaceholder: "Try laksa or chicken rice" },
  { label: "Dish", expectedText: "Chicken Rice" },
  { label: "Stall", expectedText: "Tian Tian Chicken Rice" },
  { label: "Review", expectedText: "Reviews" },
] as const;

const ROUTE_CONTENT_TIMEOUT_MS = 30_000;

test.describe("routes", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Route inventory smoke is covered once on desktop Chromium.",
    );
  });

  for (const route of ROUTE_SMOKES) {
    test(`loads ${route.label} from the Developer Launcher`, async ({ page }) => {
      await resetAppState(page);
      await startOnboardedMockSession(page);
      await clickDevButton(page, route.label, "Core app flow");
      if ("expectedPlaceholder" in route) {
        await expect(page.getByPlaceholder(route.expectedPlaceholder).first()).toBeVisible({
          timeout: ROUTE_CONTENT_TIMEOUT_MS,
        });
      } else {
        await expect(page.getByText(route.expectedText, { exact: true }).first()).toBeVisible({
          timeout: ROUTE_CONTENT_TIMEOUT_MS,
        });
      }
      await assertNoCrashVisible(page);
    });
  }

  test("documents Mapbox-backed routes as environment-dependent on web", async () => {
    test.info().annotations.push({
      type: "blocked",
      description:
        "Map and location-picker routes require Mapbox web token/runtime support and are better covered by native smoke tooling.",
    });
  });
});
