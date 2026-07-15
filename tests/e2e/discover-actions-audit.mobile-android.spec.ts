import { test } from "./fixtures";
import {
  runCraveActionAudit,
  runDecideForMeActionAudit,
  runWheelActionAudit,
} from "./helpers/discoverActionAudit";

test.describe("Discover action journeys", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-android", "Runs on the Android-like viewport.");
  });

  test("loads a source-backed Decide for Me result and supports another pick", async ({
    page,
  }, testInfo) => {
    await runDecideForMeActionAudit(page, testInfo);
  });

  test("hosts a Hungry Wheel room, adds options, and produces a winner", async ({
    page,
  }, testInfo) => {
    await runWheelActionAudit(page, testInfo);
  });

  test("renders truthful Crave cards and advances through explicit controls", async ({
    page,
  }, testInfo) => {
    await runCraveActionAudit(page, testInfo);
  });
});
