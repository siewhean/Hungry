import { test } from "@playwright/test";

import { runProductionBoundaryAudit } from "./helpers/productionBoundaryAudit";

test.describe("Production source boundary", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      process.env.HUNGRY_PRODUCTION_BOUNDARY_E2E !== "1" ||
        testInfo.project.name !== "mobile-android",
      "Runs only against the static production export on the Android-like viewport.",
    );
  });

  test("fails closed without mock food data and offers recovery", async ({ page }, testInfo) => {
    await runProductionBoundaryAudit(page, testInfo);
  });
});
