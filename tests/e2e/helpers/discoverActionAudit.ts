import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { clickDevButton, resetAppState, startOnboardedMockSession } from "./app";
import { assertRenderedImagesAreHealthy, captureVisualEvidence } from "./visualAudit";

async function openDiscover(page: Page) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Discover", "Core app flow");
  await expect(page.getByText("Popular right now", { exact: true }).first()).toBeVisible();
}

async function openRandomWheelOption(page: Page) {
  await page.getByRole("button", { name: "Add Option" }).click();
  await expect(
    page.getByText("Add an Option", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Surprise tab" }).click();

  const randomPicker = page.getByRole("button", { name: "Pick a random stall for me" });
  await expect(randomPicker).toBeVisible();
  await expect(randomPicker).toBeEnabled();
  await randomPicker.click();
  await expect(page.getByText("Add an Option", { exact: true })).toHaveCount(0);
}

async function visibleHeroImage(page: Page): Promise<Locator> {
  const hero = page.locator("img:visible").first();
  await expect(hero).toBeVisible();
  return hero;
}

async function imageIdentity(image: Locator) {
  return image.evaluate((node) => {
    const element = node as HTMLImageElement;
    return element.getAttribute("aria-label") ?? element.alt ?? element.currentSrc ?? element.src;
  });
}

export async function runDecideForMeActionAudit(page: Page, testInfo: TestInfo) {
  await openDiscover(page);

  const decide = page.getByRole("button", { name: "Decide for me" });
  await decide.scrollIntoViewIfNeeded();
  await captureVisualEvidence(page, testInfo, "decide-entry");
  await decide.click();

  await expect(
    page.getByText("Recommended", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Another Pick" })).toBeVisible();
  await expect(
    page.getByText("WHY THIS DISH?", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/^S\$\d+\.\d{2}(?: – S\$\d+\.\d{2})?$/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("S$0.00", { exact: true })).toHaveCount(0);
  await assertRenderedImagesAreHealthy(page);

  const firstHero = await visibleHeroImage(page);
  const firstLabel = await imageIdentity(firstHero);
  expect(firstLabel).toBeTruthy();
  await captureVisualEvidence(page, testInfo, "decide-first-pick");

  const tryAnother = page.getByRole("button", { name: "Try Another Pick" });
  await tryAnother.scrollIntoViewIfNeeded();
  await tryAnother.click();
  await expect
    .poll(async () => imageIdentity(await visibleHeroImage(page)), {
      message: "Try Another Pick should replace the current recommendation",
    })
    .not.toBe(firstLabel);
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "decide-alternate-pick");

  const openStall = page.getByRole("button", { name: "View Stall Details" });
  await openStall.scrollIntoViewIfNeeded();
  await openStall.click();
  await expect(
    page.getByText("Save this stall", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "decide-stall-detail");
}

export async function runWheelActionAudit(page: Page, testInfo: TestInfo) {
  await openDiscover(page);

  const wheel = page.getByRole("button", { name: "Open hungry wheel" });
  const wheelLabel = wheel.getByText("Hungry Wheel", { exact: true });
  await wheel.scrollIntoViewIfNeeded();
  await expect(wheelLabel).toBeVisible();
  expect(
    await wheelLabel.evaluate((element) => element.scrollWidth <= element.clientWidth),
    "Hungry Wheel label should fit without horizontal truncation",
  ).toBe(true);
  await wheel.click();
  await expect(
    page.getByText("Hungry Wheel", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  const hostParty = page
    .getByText("Host a Party", { exact: true })
    .filter({ visible: true })
    .first();
  await expect(hostParty).toBeVisible();
  await captureVisualEvidence(page, testInfo, "wheel-home");

  await hostParty.click();
  await expect(
    page.getByText("Party Lobby", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("The wheel is empty", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await captureVisualEvidence(page, testInfo, "wheel-empty-lobby");

  await openRandomWheelOption(page);
  await expect(
    page.getByText("The wheel is empty", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Spin Wheel" })).toBeDisabled();

  await openRandomWheelOption(page);
  const spinWheel = page.getByRole("button", { name: "Spin Wheel" });
  await expect(spinWheel).toBeEnabled();
  await captureVisualEvidence(page, testInfo, "wheel-ready-lobby");
  await spinWheel.click();

  const spinNow = page.getByText("SPIN NOW", { exact: true }).filter({ visible: true }).first();
  await expect(spinNow).toBeVisible();
  await expect(
    page.getByText("2 options active", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await captureVisualEvidence(page, testInfo, "wheel-ready-to-spin");
  await spinNow.click();

  await expect(
    page.getByText("WINNER", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 12_000 });
  await expect(
    page
      .getByText("REPRESENTATIVE · NOT EXACT PHOTO", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "View Stall Details" })).toBeVisible();
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "wheel-winner");
}

export async function runCraveActionAudit(page: Page, testInfo: TestInfo) {
  await openDiscover(page);

  const crave = page.getByRole("button", { name: "Open daily crave" });
  await crave.scrollIntoViewIfNeeded();
  await crave.click();

  await expect(page.getByText("CRAVE", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("SWIPE TO BUILD PROFILE", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/.+ · (?:\d+ m|\d+\.\d+ km) · S\$\d+/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("S$0.00", { exact: true })).toHaveCount(0);
  await assertRenderedImagesAreHealthy(page);
  await expect(
    page.getByText("Session → Fully authenticated", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await captureVisualEvidence(page, testInfo, "crave-first-card");

  const firstImage = page.locator("img:visible").last();
  await expect(firstImage).toBeVisible();
  const firstLabel = await imageIdentity(firstImage);
  expect(firstLabel).toBeTruthy();

  await page.getByRole("button", { name: "Save this dish" }).click();
  await expect
    .poll(async () => imageIdentity(page.locator("img:visible").last()), {
      message: "Saving the current Crave card should advance to the next dish",
    })
    .not.toBe(firstLabel);
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "crave-after-save");

  await page.getByRole("button", { name: "Pass on this dish" }).click();
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "crave-after-pass");
}
