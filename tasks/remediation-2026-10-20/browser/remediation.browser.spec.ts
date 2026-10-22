import { test, expect } from "@playwright/test";
import {
  resetAppState,
  clickDevButton,
  startOnboardedMockSession,
} from "../../../tests/e2e/helpers/app";
import fs from "node:fs/promises";
import path from "node:path";
const artifactDir = __dirname;
let issues: { type: string; message: string }[] = [];
test.beforeEach(async ({ page }) => {
  issues = [];
  page.on("pageerror", (error) => issues.push({ type: "pageerror", message: error.message }));
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type()))
      issues.push({ type: msg.type(), message: msg.text() });
  });
});
test.afterEach(async ({ page }, info) => {
  const slug = info.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await fs.writeFile(
    path.join(artifactDir, `${slug}-runtime.json`),
    JSON.stringify(issues, null, 2),
  );
  await page
    .screenshot({ path: path.join(artifactDir, `${slug}.png`), fullPage: true, timeout: 5000 })
    .catch(() => undefined);
  if (info.title.includes("onboarding selection"))
    await fs.writeFile(
      path.join(artifactDir, "quiz-final-settled-draft.json"),
      JSON.stringify(
        await page.evaluate(() =>
          Object.fromEntries(
            Object.entries(localStorage).filter(([key]) => key.includes("onboarding-draft")),
          ),
        ),
        null,
        2,
      ),
    );
  await info.attach("runtime-issues", {
    body: JSON.stringify(issues, null, 2),
    contentType: "application/json",
  });
  expect(issues.filter((issue) => issue.type === "pageerror" || issue.type === "error")).toEqual(
    [],
  );
});
test("fresh Welcome reaches existing-account login with real validation", async ({ page }) => {
  await resetAppState(page);
  await page.getByRole("button", { name: "Open normal app flow" }).click();
  await expect(page.getByRole("button", { name: "Get started", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Email address").fill("invalid");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/valid email/i)).toBeVisible();
  await expect(page.getByText(/password is required/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});
test("onboarding selection and quiz answer resume after a browser reload", async ({ page }) => {
  const snapshots: unknown[] = [];
  const capture = async (stage: string) => {
    const snapshot = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) => key.includes("onboarding-draft")),
      ),
    );
    snapshots.push({ stage, snapshot });
    await fs.writeFile(
      path.join(artifactDir, "quiz-resume-draft-snapshots.json"),
      JSON.stringify(snapshots, null, 2),
    );
  };
  await resetAppState(page);
  await page.getByRole("button", { name: "Open normal app flow" }).click();
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByRole("button", { name: "Select Local", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Pick your sweetness mood", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Sweet-forward Pick your sweetness mood", exact: true })
    .click();
  await capture("after-sweet-forward-click");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("How spicy tonight?", { exact: true })).toBeVisible();
  await capture("spicy-before-reload");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Developer Launcher", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open normal app flow" }).click();
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deselect Local", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("How spicy tonight?", { exact: true })).toBeVisible();
  await capture("resumed-spicy");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Pick your sweetness mood", { exact: true })).toBeVisible();
  await capture("after-back");
  await expect
    .poll(async () => {
      const box = await page
        .getByRole("button", { name: "Sweet-forward Pick your sweetness mood", exact: true })
        .boundingBox();
      return box ? Math.abs(box.x + box.width / 2 - 195) : 1000;
    })
    .toBeLessThan(20);
});
test("mock profile Settings exposes supported preferences and readonly auth email", async ({
  page,
}) => {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Settings", "Profile & Review");
  await expect(page.getByText("Authentication email", { exact: true })).toBeVisible();
  await expect(page.getByText("weiming@example.sg", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Save search history/ })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Haptic feedback/ })).toBeVisible();
  const haptics = page.getByRole("switch", { name: /Haptic feedback/ });
  const original = await haptics.locator("input[type=checkbox]").isChecked();
  await haptics.click();
  await expect(haptics.locator("input[type=checkbox]")).toBeChecked({ checked: !original });
  await fs.writeFile(
    path.join(artifactDir, "settings-profile-before-reload.json"),
    JSON.stringify(
      await page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage)
            .filter(([key]) => key.includes("hungry-profile") || key === "hungry-session-v1")
            .map(([key, value]) => {
              const state = JSON.parse(value).state;
              return [
                key,
                key === "hungry-session-v1"
                  ? { isAuthenticated: state.isAuthenticated, userId: state.authenticatedUserId }
                  : { id: state.profile?.id, email: state.profile?.email },
              ];
            }),
        ),
      ),
      null,
      2,
    ),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Developer Launcher", { exact: true }).first()).toBeVisible();
  await clickDevButton(page, "Settings", "Profile & Review");
  await fs.writeFile(
    path.join(artifactDir, "settings-profile-after-reload.json"),
    JSON.stringify(
      await page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage)
            .filter(([key]) => key.includes("hungry-profile") || key === "hungry-session-v1")
            .map(([key, value]) => {
              const state = JSON.parse(value).state;
              return [
                key,
                key === "hungry-session-v1"
                  ? { isAuthenticated: state.isAuthenticated, userId: state.authenticatedUserId }
                  : { id: state.profile?.id, email: state.profile?.email },
              ];
            }),
        ),
      ),
      null,
      2,
    ),
  );
  await expect(page.getByText("weiming@example.sg", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: /Haptic feedback/ }).locator("input[type=checkbox]"),
  ).toBeChecked({ checked: !original });
  await expect(page.getByRole("textbox", { name: /email/i })).toHaveCount(0);
  await fs.writeFile(
    path.join(artifactDir, "settings-inventory.txt"),
    await page.locator("body").innerText(),
  );
});

test("Discover cards keep their dish identity across the former cycle interval", async ({
  page,
}) => {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Discover", "Core app flow");
  await expect(page.getByText("Popular right now", { exact: true })).toBeVisible();
  const card = page.getByRole("button", { name: /^Open .+ at .+/ }).first();
  await expect(card).toBeVisible();
  const label = await card.getAttribute("aria-label");
  expect(label).toBeTruthy();
  await page.waitForTimeout(4500);
  await expect(card).toHaveAttribute("aria-label", label!);
  await card.click();
  const dishName = label!.replace(/^Open /, "").split(" at ")[0];
  await expect(
    page.getByText(dishName, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await fs.writeFile(
    path.join(artifactDir, "discover-opened-dish.txt"),
    await page.locator("body").innerText(),
  );
});
test("supported composer opens a deliberate dish and preserves entered draft", async ({ page }) => {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Launch V2 Composer", "Post Composer V2 Settings");
  await expect(
    page.getByText("Create post", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  const caption = "Bounded browser durable draft.";
  await page
    .getByPlaceholder("What makes this worth the queue?")
    .filter({ visible: true })
    .first()
    .fill(caption);
  await page.reload({ waitUntil: "domcontentloaded" });
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Launch V2 Composer", "Post Composer V2 Settings");
  await expect(
    page.getByPlaceholder("What makes this worth the queue?").filter({ visible: true }).first(),
  ).toHaveValue(caption);
  await fs.writeFile(
    path.join(artifactDir, "composer-inventory.txt"),
    await page.locator("body").innerText(),
  );
});

test("valid mock login establishes the authenticated account rather than a guest session", async ({
  page,
}) => {
  await resetAppState(page);
  await page.getByRole("button", { name: "Open normal app flow" }).click();
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await page.getByPlaceholder("Email address").fill("weiming@example.sg");
  await page.getByPlaceholder("Password", { exact: true }).fill("BrowserPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const value = localStorage.getItem("hungry-session-v1");
        const state = value ? JSON.parse(value).state : null;
        return state?.isAuthenticated ? state.authenticatedUserId : null;
      }),
    )
    .toBe("user-1");
});
