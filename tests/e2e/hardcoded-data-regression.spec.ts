import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

const ROOT = process.cwd();

test.describe("hardcoded data regression guard", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Static source guard only needs one browser project.",
    );
  });

  test("production screens do not import raw mock data directly", () => {
    const allowedDevOnly = new Set(["src/app/screens/dev/DeveloperLauncherScreen.tsx"]);
    const files = [
      "src/app/screens/dev/DeveloperLauncherScreen.tsx",
      "src/app/screens/discover/QuickBitesScreen.tsx",
      "src/app/screens/detail/DishDetailScreenV2.tsx",
      "src/app/screens/search/SearchResultsScreen.tsx",
      "src/app/screens/profile/ProfileHomeScreen.tsx",
    ];

    const directMockImports = files.filter((file) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      return source.includes("@/lib/services/mock/data") && !allowedDevOnly.has(file);
    });

    expect(directMockImports).toEqual([]);
  });
});
