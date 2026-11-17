# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-browsing.spec.ts >> signed-out entry >> signed-out normal app flow starts at login while explicit public details remain openable
- Location: tests/e2e/guest-browsing.spec.ts:14:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Welcome back', { exact: true })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByText('Welcome back', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e15]:
  - generic [ref=e16]:
    - img "Hungry logo" [ref=e17]:
      - img "Hungry logo" [ref=e19]
    - generic [ref=e20]: Hungry
    - generic [ref=e21]: Singapore's dish-first food app
  - generic [ref=e23]: Find the dish. Not just the restaurant.
  - generic [ref=e24]:
    - generic [ref=e25]:
      - generic [ref=e27]: 🍜
      - generic [ref=e28]: Discover dishes, not just restaurants
    - generic [ref=e29]:
      - generic [ref=e31]: 📍
      - generic [ref=e32]: Find the best hawker stalls near you
    - generic [ref=e33]:
      - generic [ref=e35]: 🎯
      - generic [ref=e36]: Personalised to your taste
  - generic [ref=e37]:
    - button "Get started" [ref=e38] [cursor=pointer]:
      - generic [ref=e40]: Get started
    - button "Sign in to existing account" [ref=e41] [cursor=pointer]:
      - generic [ref=e42]: Already have an account? Sign in
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures";
  2  | import { assertNoCrashVisible, clickDevButton, resetAppState } from "./helpers/app";
  3  | 
  4  | const CONTENT_TIMEOUT_MS = 30_000;
  5  | 
  6  | test.describe("signed-out entry", () => {
  7  |   test.beforeEach(async ({}, testInfo) => {
  8  |     test.skip(
  9  |       testInfo.project.name !== "chromium",
  10 |       "Guest browsing route smoke is covered once on desktop Chromium.",
  11 |     );
  12 |   });
  13 | 
  14 |   test("signed-out normal app flow starts at login while explicit public details remain openable", async ({
  15 |     page,
  16 |   }) => {
  17 |     await resetAppState(page);
  18 | 
  19 |     await page.getByRole("button", { name: "Open normal app flow" }).click();
> 20 |     await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({
     |                                                                   ^ Error: expect(locator).toBeVisible() failed
  21 |       timeout: CONTENT_TIMEOUT_MS,
  22 |     });
  23 | 
  24 |     await resetAppState(page);
  25 |     await clickDevButton(page, "Dish", "Core app flow");
  26 |     await expect(page.getByText("Chicken Rice", { exact: true }).first()).toBeVisible({
  27 |       timeout: CONTENT_TIMEOUT_MS,
  28 |     });
  29 |     await assertNoCrashVisible(page);
  30 |   });
  31 | 
  32 |   test("protected create action redirects guests to login", async ({ page }) => {
  33 |     await resetAppState(page);
  34 | 
  35 |     await clickDevButton(page, "Composer", "Core app flow");
  36 |     await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({
  37 |       timeout: CONTENT_TIMEOUT_MS,
  38 |     });
  39 |     await assertNoCrashVisible(page);
  40 |   });
  41 | });
  42 | 
```