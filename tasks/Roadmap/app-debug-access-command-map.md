# Hungry App Debug Access Command Map

Purpose: keep one command-first map for opening Hungry app pages and exercising buttons from Playwright, Maestro, or the simulator without hunting through screen code.

Last updated: 2026-06-24

## Ground Rules

- Use the Developer Launcher for fast page access in debug/E2E builds.
- Prefer Playwright role/test-id selectors over coordinates.
- Prefer the existing helpers in `tests/e2e/helpers/app.ts` and `tests/e2e/helpers/pageAgent.ts`.
- Do not run destructive actions such as delete account, sign out, publish, submit, send, or confirm unless the test case explicitly requires it.
- If native smoke scripts are used, keep Metro running first.

## Quick Start

### Expo Web + Playwright

```bash
E2E_PORT=8099 npm run test:e2e -- tests/e2e/home-feed.agent.spec.ts --project=chromium --reporter=line
E2E_PORT=8099 npx playwright test tests/e2e/discovery.agent.spec.ts --project=chromium --headed
E2E_PORT=8099 npm run test:e2e:ui
```

Use this helper pattern inside a focused spec:

```ts
import { expect, test } from "./fixtures";
import { clickDevButton, startOnboardedMockSession } from "./helpers/app";

test("debug discovery", async ({ page }) => {
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Discover", "Core app flow");
  await expect(page.getByText("Popular right now")).toBeVisible();
});
```

### Native Simulator

```bash
npm run ios
npm run smoke:native:ios:prepared
npm run smoke:native:ios:guest
npm run smoke:native:ios:review-post
npm run smoke:native:ios:media:prepared
npm run smoke:native:ios:chat:prepared
```

Android equivalents:

```bash
npm run android
npm run smoke:native:android:prepared
npm run smoke:native:android:guest:prepared
npm run smoke:native:android:media:prepared
```

## Developer Launcher Test IDs

Test ID generation rule:

```ts
devButtonTestId("Launch V2 Composer") === "dev-button-launch-v2-composer"
openDevSection(page, "Post Composer V2 Settings") opens "dev-section-toggle-post-composer-v2-settings"
```

Direct Playwright pattern:

```ts
await page.getByTestId("dev-section-toggle-core-app-flow").click();
await page.getByTestId("dev-button-discover").click();
```

Helper pattern:

```ts
await clickDevButton(page, "Discover", "Core app flow");
```

## Page Access Map

| Page / state | Playwright helper command | Direct test ID |
|---|---|---|
| Developer Launcher | `await gotoLauncher(page)` | `Developer Launcher` text |
| Signed out | `await clickDevButton(page, "Signed out", "Session presets")` | `dev-button-signed-out` |
| Auth only | `await clickDevButton(page, "Auth only", "Session presets")` | `dev-button-auth-only` |
| Auth + onboard | `await clickDevButton(page, "Auth + Onboard", "Session presets")` | `dev-button-auth-onboard` |
| Auth + onboard User A | `await clickDevButton(page, "Auth + Onboard User A", "Session presets")` | `dev-button-auth-onboard-user-a` |
| Auth + onboard User B | `await clickDevButton(page, "Auth + Onboard User B", "Session presets")` | `dev-button-auth-onboard-user-b` |
| Developer mode | `await clickDevButton(page, "Developer", "Developer mode")` | `dev-button-developer` |
| Merchant mode | `await clickDevButton(page, "Merchant", "Developer mode")` | `dev-button-merchant` |
| User mode | `await clickDevButton(page, "User", "Developer mode")` | `dev-button-user` |
| Home tab | `await clickDevButton(page, "Home", "Core app flow")` | `dev-button-home` |
| Discover tab | `await clickDevButton(page, "Discover", "Core app flow")` | `dev-button-discover` |
| Search | `await clickDevButton(page, "Search", "Core app flow")` | `dev-button-search` |
| Map | `await clickDevButton(page, "Map", "Core app flow")` | `dev-button-map` |
| Decide wheel result | `await clickDevButton(page, "Wheel", "Core app flow")` | `dev-button-wheel` |
| Stall detail v1 | `await clickDevButton(page, "Stall", "Core app flow")` | `dev-button-stall` |
| Dish detail v1 | `await clickDevButton(page, "Dish", "Core app flow")` | `dev-button-dish` |
| Dish detail v2 | `await clickDevButton(page, "Dish V2", "Core app flow")` | `dev-button-dish-v2` |
| Review tab | `await clickDevButton(page, "Review", "Core app flow")` | `dev-button-review` |
| Blog article | `await clickDevButton(page, "Article", "Core app flow")` | `dev-button-article` |
| Post entry | `await clickDevButton(page, "Composer", "Core app flow")` | `dev-button-composer` |
| Offline screen | `await clickDevButton(page, "Offline", "Core app flow")` | `dev-button-offline` |
| Not found screen | `await clickDevButton(page, "404", "Core app flow")` | `dev-button-404` |
| Login | `await clickDevButton(page, "Login", "Auth & Onboarding")` | `dev-button-login` |
| Sign up | `await clickDevButton(page, "SignUp", "Auth & Onboarding")` | `dev-button-signup` |
| Email verification | `await clickDevButton(page, "Verify", "Auth & Onboarding")` | `dev-button-verify` |
| Forgot password | `await clickDevButton(page, "Forgot", "Auth & Onboarding")` | `dev-button-forgot` |
| Reset password | `await clickDevButton(page, "Reset", "Auth & Onboarding")` | `dev-button-reset` |
| Onboarding intro 1 | `await clickDevButton(page, "Intro 1", "Auth & Onboarding")` | `dev-button-intro-1` |
| Onboarding intro 2 | `await clickDevButton(page, "Intro 2", "Auth & Onboarding")` | `dev-button-intro-2` |
| Taste quiz | `await clickDevButton(page, "Quiz", "Auth & Onboarding")` | `dev-button-quiz` |
| Location permission | `await clickDevButton(page, "Perms", "Auth & Onboarding")` | `dev-button-perms` |
| Profile tab | `await clickDevButton(page, "Profile", "Profile & Review")` | `dev-button-profile` |
| Edit profile | `await clickDevButton(page, "Edit", "Profile & Review")` | `dev-button-edit` |
| Favourites | `await clickDevButton(page, "Favs", "Profile & Review")` | `dev-button-favs` |
| Review history | `await clickDevButton(page, "History", "Profile & Review")` | `dev-button-history` |
| Settings | `await clickDevButton(page, "Settings", "Profile & Review")` | `dev-button-settings` |
| Quick review flow | `await clickDevButton(page, "QuickRate", "Profile & Review")` | `dev-button-quickrate` |
| Seed composer media | `await clickDevButton(page, "Seed sample media", "Post Composer V2 Settings")` | `dev-button-seed-sample-media` |
| Launch V2 composer | `await clickDevButton(page, "Launch V2 Composer", "Post Composer V2 Settings")` | `dev-button-launch-v2-composer` |
| Activity inbox | `await page.getByTestId("dev-button-activity").click()` | `dev-button-activity` |
| Quick Bites | `await clickDevButton(page, "Quick Bites", "V1 vs V2 Comparison")` | `dev-button-quick-bites` |
| Design Gallery | `await clickDevButton(page, "Design Gallery", "V1 vs V2 Comparison")` | `dev-button-design-gallery` |
| Merchant tabs | `await clickDevButton(page, "Merchant Mode", "V1 vs V2 Comparison")` | `dev-button-merchant-mode` |

## Page Button Maps

### Home Feed

```ts
await startOnboardedMockSession(page);
await clickDevButton(page, "Home", "Core app flow");
await expect(page.getByTestId("home-social-feed")).toBeVisible();
await page.getByRole("button", { name: /Save / }).first().click();
await page.getByRole("button", { name: /Like / }).first().click();
await page.getByRole("button", { name: /Open .* profile/i }).first().click();
await page.getByRole("button", { name: /Open activity inbox/i }).click();
```

### Discovery

```ts
await startOnboardedMockSession(page);
await clickDevButton(page, "Discover", "Core app flow");
await page.getByPlaceholder("Laksa, satay, Tian Tian...").fill("laksa");
await page.getByRole("button", { name: /View search results/i }).click();
await page.getByRole("button", { name: /Open .*laksa/i }).first().click();
await clickDevButton(page, "Discover", "Core app flow");
await page.getByRole("button", { name: /Open Tian Tian Chicken Rice stall details/i }).click();
```

### Dish Detail

```ts
await startOnboardedMockSession(page);
await clickDevButton(page, "Dish V2", "Core app flow");
await expect(page.getByText(/Food Centre|Opening hours|Address/i)).toBeVisible();
await page.getByRole("button", { name: /Add to checklist/i }).click();
await page.getByRole("button", { name: /Add to portfolio/i }).click();
```

### Stall Detail

```ts
await startOnboardedMockSession(page);
await clickDevButton(page, "Stall", "Core app flow");
await page.getByRole("button", { name: /Share stall/i }).click();
await page.getByRole("button", { name: /Open .* at/i }).first().click();
```

### Review

```ts
await startOnboardedMockSession(page);
await clickDevButton(page, "Review", "Core app flow");
await page.getByRole("button", { name: /Select Stall & Dish/i }).click();
await page.getByText("Tian Tian Chicken Rice").click();
await page.getByRole("button", { name: /4 star/i }).click();
await page.getByPlaceholder("What made this dish special?").fill("Tender chicken and fragrant rice.");
await page.getByRole("button", { name: /Publish Review/i }).click();
```

### Post Composer

```ts
await openComposerFromLauncher(page, { seedMedia: true });
await page.getByPlaceholder("Write your masterpiece... Use @ to tag or # for topics.").fill(
  "Great chicken rice at Maxwell today.",
);
await page.getByRole("button", { name: /Add CTA Button/i }).click();
await page.getByRole("button", { name: /View Menu/i }).click();
await page.getByRole("button", { name: /Publish Both/i }).click();
```

Useful composer controls:

```ts
await page.getByRole("button", { name: /Save Draft/i }).click();
await page.getByRole("button", { name: /Edit with AI/i }).click();
await page.getByRole("button", { name: /Auto-Enhance media/i }).click();
await page.getByRole("button", { name: /Open publish options/i }).click();
await page.getByRole("button", { name: /Schedule Post/i }).click();
await page.getByRole("button", { name: /Select Review Only publish mode/i }).click();
await page.getByRole("button", { name: /Select Post and Review publish mode/i }).click();
```

### Profile, Checklists, And Portfolio

```ts
await startOnboardedMockSession(page);
await clickDevButton(page, "Profile", "Profile & Review");
await page.getByRole("button", { name: /Open quick access/i }).click();
await page.getByRole("button", { name: /My Checklists/i }).click();
await page.getByRole("button", { name: /Create Checklist|Create/i }).click();
await clickDevButton(page, "Profile", "Profile & Review");
await page.getByRole("button", { name: /Hungry Portfolios/i }).click();
await page.getByRole("button", { name: /Create portfolio/i }).click();
```

### Merchant Surface

```ts
await gotoLauncher(page);
await clickDevButton(page, "Merchant", "Developer mode");
await page.getByRole("button", { name: /Switch outlet/i }).click();
await page.getByRole("button", { name: /Add menu item/i }).click();
```

### Activity / Chat

```ts
await startOnboardedMockSession(page);
await page.getByTestId("dev-button-activity").click();
await page.getByRole("button", { name: /Open chat with/i }).first().click();
```

## Native / Maestro IDs

Use these IDs in Maestro YAML or native smoke debugging:

```yaml
- tapOn:
    id: "dev-button-user"
- tapOn:
    id: "dev-button-review"
- tapOn:
    id: "dev-button-activity"
- tapOn:
    id: "dev-section-toggle-post-composer-v2-settings"
- tapOn:
    id: "dev-button-launch-v2-composer"
```

Known smoke files:

```bash
.maestro/ios-guest-browse-smoke.yaml
.maestro/ios-review-post-smoke.yaml
.maestro/ios-chat-smoke.yaml
.maestro/ios-media-picker-permission.yaml
.maestro/android-guest-browse-smoke.yaml
```

## Page-Agent Helpers

Use these helpers when doing broad page QA/QC loops:

```ts
import {
  assertNoBrokenImages,
  assertNoCrashOrMissingData,
  collectNetwork500s,
  gradeInteractiveElements,
  visibleButtonInventory,
} from "./helpers/pageAgent";
```

Recommended debug skeleton:

```ts
test("debug current page", async ({ page }, testInfo) => {
  const networkIssues = collectNetwork500s(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Discover", "Core app flow");
  await assertNoCrashOrMissingData(page);
  await assertNoBrokenImages(page);
  await gradeInteractiveElements(page, 1);
  await expect(networkIssues).toEqual([]);
});
```

## Verification Commands

Run a focused page:

```bash
E2E_PORT=8099 npx playwright test tests/e2e/discovery.agent.spec.ts --project=chromium --reporter=line
```

Run all page agents:

```bash
E2E_PORT=8099 npx playwright test \
  tests/e2e/home-feed.agent.spec.ts \
  tests/e2e/discovery.agent.spec.ts \
  tests/e2e/review.agent.spec.ts \
  tests/e2e/post.agent.spec.ts \
  tests/e2e/profile.agent.spec.ts \
  --project=chromium --reporter=line
```

Run production flag and prefetch contracts:

```bash
E2E_PORT=8099 npx playwright test \
  tests/e2e/app-feature-flags-production.spec.ts \
  tests/e2e/app-prefetch-contracts.spec.ts \
  --project=chromium --reporter=line
```

## Troubleshooting

- If Expo asks to use another port, set `E2E_PORT=8099` and rerun. `scripts/run-expo.cjs` preflights the port.
- If a page opens with missing dish/stall data, verify the test starts with `startOnboardedMockSession(page)` before using launcher shortcuts.
- If a button is not found, first inventory visible buttons:

```ts
console.log(await visibleButtonInventory(page));
```

- If native smoke cannot find a launcher button, confirm the app is in a debug/dev-client build and not a production build.
- If a flow is feature-flagged off in production, validate the disabled route with `tests/e2e/app-feature-flags-production.spec.ts` instead of forcing it open.
