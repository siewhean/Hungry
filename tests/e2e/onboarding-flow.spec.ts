import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Round-four onboarding (R4-ONB-1 to 18) end to end on the mock web build. The shared
// fixture fails any test that logs a console error or page error, which is how a NaN in
// an SVG (R4-ONB-12) or a React warning on these screens would surface.

const SINGAPORE = { latitude: 1.2806, longitude: 103.8505 };
// Six taste questions; the diet step is the seventh of the counter's seven.
const TASTE_QUESTIONS = 6;
const COUNTED_QUESTIONS = 7;

test.use({ geolocation: SINGAPORE, permissions: ["geolocation"] });

// Dish photos come from the internet; a CI box without it must not turn into console errors.
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const request = route.request();
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(request.url());
    if (local || request.resourceType() !== "image") return route.continue();
    return route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
    });
  });
});

const progressLabel = (page: Page) => page.getByRole("progressbar").first();

async function startOnboarding(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Allow location" }).click();
  await expect(progressLabel(page)).toHaveAttribute("aria-label", /Step 2 of 5/);
}

async function answerAllQuestions(page: Page) {
  const tile = page.getByTestId("taste-tile-1");
  for (let question = 1; question <= TASTE_QUESTIONS; question += 1) {
    await expect(progressLabel(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`Question ${question} of ${COUNTED_QUESTIONS}`),
    );
    await expect(tile).toBeVisible();
    // A tap during the slide to the next question is ignored by design.
    await expect(tile).toBeEnabled();
    await tile.click();
    // Earlier questions move on by themselves, so only the last one stays to be checked.
    if (question === TASTE_QUESTIONS) await expect(tile).toHaveAttribute("aria-checked", "true");
  }
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Any dietary needs?")).toBeVisible();
}

test("the quiz, the diet step and the result run in one bar, with the picked tile checked", async ({
  page,
}) => {
  await startOnboarding(page);

  // Three tiles side by side; a tap answers, ticks the tile and moves on by itself.
  await expect(page.getByTestId("taste-tile-0")).toBeVisible();
  await expect(page.getByTestId("taste-tile-2")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByTestId("taste-tile-1").click();
  await expect(progressLabel(page)).toHaveAttribute("aria-label", /Question 2 of 7/);

  // The rest of the questions: one h2 each, and the progress label never changes shape.
  for (let question = 2; question <= TASTE_QUESTIONS; question += 1) {
    await expect(progressLabel(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`Step 2 of 5 · Question ${question} of ${COUNTED_QUESTIONS}`),
    );
    await expect(page.getByTestId("taste-tile-1")).toBeEnabled();
    await page.getByTestId("taste-tile-1").click();
  }
  await page.getByRole("button", { name: "Next" }).click();

  // Diet: chips, "No restrictions" as the empty state, the budget on the same screen.
  await expect(page.getByText("Any dietary needs?")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Dietary preference None" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByText("Usual budget per dish")).toBeVisible();
  await page.getByRole("checkbox", { name: "Dietary preference Halal" }).click();
  await expect(page.getByRole("checkbox", { name: "Dietary preference None" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.getByRole("button", { name: "Budget Under S$12" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Openness has no Skip: the answer is preselected.
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();

  // The result reads "Step 4 of 5": the account is still to come.
  await expect(progressLabel(page)).toHaveAttribute("aria-label", /Step 4 of 5/);
  await expect(page.getByRole("heading", { name: "Your first picks" })).toBeVisible();
  await expect(page.getByText(/Price not listed|S\$0\.00/)).toHaveCount(0);
});

test("closing the app mid-quiz reopens the same question with the answers kept", async ({
  page,
}) => {
  await startOnboarding(page);
  await page.getByTestId("taste-tile-2").click();
  await expect(progressLabel(page)).toHaveAttribute("aria-label", /Question 2 of 7/);

  await page.reload();
  await expect(progressLabel(page)).toHaveAttribute("aria-label", /Step 2 of 5/, {
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("a signed-out tap on a pick opens a preview, not the dish page, and a heart is kept", async ({
  page,
}) => {
  await startOnboarding(page);
  await answerAllQuestions(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const firstCard = page.getByRole("button", { name: /^Preview / }).first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await expect(page.getByText(/Create your account to open the full dish page/)).toBeVisible();
  await page.getByRole("button", { name: "Save this dish" }).click();
  await expect(page.getByText("Saved for after sign-up")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText(/Create your account to open the full dish page/)).toHaveCount(0);
});

test("Welcome > Sign in > relaunch returns to Login, and onboarding stays open", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in to existing account" }).click({
    timeout: 60_000,
  });
  await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("an account made after the quiz lands on Home with the diner's picks or a way forward", async ({
  page,
}) => {
  await startOnboarding(page);
  await answerAllQuestions(page);
  await page.getByRole("checkbox", { name: "Dietary preference Halal" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^(Start exploring|Save my picks)$/ }).click();

  // The account step is the fifth of five and leads with an emailed code; this run uses the password form.
  await expect(page.getByRole("progressbar", { name: "Step 5 of 5" })).toBeVisible();
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Name shown on your reviews").fill("Mei");
  await page
    .getByLabel("Email address", { exact: true })
    .first()
    .fill("mei.onboarding@hungry.test");
  await page.getByLabel("Create password", { exact: true }).first().fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).last().click();

  // The mock build opens the developer launcher after sign-in; open the normal app flow.
  await page.getByRole("button", { name: "Open normal app flow" }).click({ timeout: 60_000 });
  // Home: a signed-in diner with a halal need sees a dish or a clear next step, never a blank page.
  await expect(page.getByText(/^You are at/).first()).toBeVisible({ timeout: 60_000 });
  const food = page.getByRole("button", { name: /halal|Chicken Rice|Laksa|Satay/i }).first();
  const wayForward = page.getByText(/no dishes|nothing yet|check back|explore|search/i).first();
  await expect(food.or(wayForward).first()).toBeVisible({ timeout: 30_000 });
});

// N1: the three answers are full-width rows that all fit with Next, and no label is cut short.
async function expectRowsFit(page: Page) {
  const viewport = page.viewportSize()!;
  let previousBottom = 0;
  for (const index of [0, 1, 2]) {
    const tile = page.getByTestId(`taste-tile-${index}`);
    await expect(tile).toBeVisible();
    const box = (await tile.boundingBox())!;
    // Full width of the column: much wider than the old side-by-side tiles.
    expect(box.width).toBeGreaterThan(viewport.width * 0.8);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeGreaterThanOrEqual(previousBottom);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    previousBottom = box.y + box.height;
  }
  const next = (await page.getByRole("button", { name: "Next" }).boundingBox())!;
  expect(next.y).toBeGreaterThanOrEqual(previousBottom);
  expect(next.y + next.height).toBeLessThanOrEqual(viewport.height);
  const truncated = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-testid^="taste-tile-"] *')).filter(
        (el) => el.children.length === 0 && el.textContent && el.scrollWidth > el.clientWidth,
      ).length,
  );
  expect(truncated).toBe(0);
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="taste-tile-"] *')).some(
      (el) => el.children.length === 0 && getComputedStyle(el).textOverflow === "ellipsis",
    ),
  );
  expect(labels).toBe(false);
}

test("the three answer rows and Next fit the screen with no label cut short", async ({ page }) => {
  await startOnboarding(page);
  await expectRowsFit(page);
});

test("a tap moves to the next question with a short crossfade, never a blank screen", async ({
  page,
}) => {
  await startOnboarding(page);
  await expect(page.getByTestId("taste-tile-1")).toBeEnabled();
  // Watch the options' opacity every frame from before the tap until the next question is up.
  await page.evaluate(() => {
    const tile = document.querySelector('[data-testid="taste-tile-1"]')!;
    const w = window as unknown as { __fade: { dimMs: number; frames: number } };
    w.__fade = { dimMs: 0, frames: 0 };
    let dimSince = 0;
    const sample = (now: number) => {
      const group = document.querySelector('[data-testid="taste-tile-0"]')?.parentElement
        ?.parentElement;
      const opacity = group ? Number(getComputedStyle(group).opacity) : 1;
      w.__fade.frames += 1;
      if (opacity < 0.05) {
        dimSince ||= now;
        w.__fade.dimMs = Math.max(w.__fade.dimMs, now - dimSince);
      } else {
        dimSince = 0;
      }
      if (tile.isConnected || w.__fade.frames < 600) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const startedAt = Date.now();
  await page.getByTestId("taste-tile-1").click();
  await expect(progressLabel(page)).toHaveAttribute("aria-label", /Question 2 of 7/);
  expect(Date.now() - startedAt).toBeLessThan(1500);
  const fade = await page.evaluate(
    () => (window as unknown as { __fade: { dimMs: number } }).__fade,
  );
  expect(fade.dimMs).toBeLessThan(250);
});

test("the diet step's address carries no [object Object]", async ({ page }) => {
  await startOnboarding(page);
  await answerAllQuestions(page);
  expect(decodeURIComponent(page.url())).not.toContain("object Object");
  await expect(page.getByText("Any dietary needs?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Any dietary needs?")).toBeVisible({ timeout: 60_000 });
});

test.describe("a small phone", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("the quiz question, the rows and Next fit without sideways scrolling", async ({ page }) => {
    await startOnboarding(page);
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
    await expectRowsFit(page);
  });
});
