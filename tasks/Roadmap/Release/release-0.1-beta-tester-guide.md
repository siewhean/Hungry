# Hungry Release 0.1 — Beta Tester Guide

Thank you for testing Hungry. This beta focuses on one job: reliably finding a real dish and where to get it.

## Before you start

- Install only the build link supplied by the Hungry release owner.
- Do not share the build or test account access outside the invited group.
- Use your own account unless the release owner explicitly supplies a demo account.
- Never send Hungry your password, verification code or access token.
- Screenshots must not expose other people’s personal information.

## What is included

- onboarding and account creation/sign-in;
- Discover and search;
- Browse Dishes and Browse Stalls;
- dish and stall/menu details;
- directions when location data is valid;
- profile/settings, privacy, account deletion and sign-out;
- read-only offline catalog continuity for approved outage tests.

## What is intentionally not included

- posts, reviews and comments;
- direct messages and stories;
- social Home feed and Activity;
- gamification and collections;
- merchant tools;
- Map, Wheel, Crave, floorplans and prototype features;
- favourites unless the release notes explicitly say otherwise.

A missing deferred feature is not a bug. A visible control that opens a missing feature is a bug.

## Required test journey

1. Open Hungry.
2. Complete onboarding.
3. Create an account or sign in.
4. Select or deny location; choose Jurong East when asked.
5. Open a dish from Discover.
6. Open the matching stall/menu.
7. Search for a different named dish.
8. Browse more results.
9. Open directions when available.
10. Force-quit and reopen Hungry.
11. Confirm the session restores.
12. Sign out.
13. Try reopening a protected link/screen and confirm sign-in is required.
14. Submit one report, even when it is a minor data issue.

## Report a problem

Use the supplied beta defect or catalog issue form. Include:

- implementation SHA;
- EAS build ID/version;
- device and operating system;
- route/screen;
- Supabase or Excel source when shown;
- catalog release ID when shown;
- exact reproduction steps;
- expected and actual behavior;
- redacted screenshot or video when useful.

## Severity guide

- **P0:** security/privacy issue, data loss, auth bypass, crash loop, or core journey completely blocked;
- **P1:** major function broken without a reasonable workaround;
- **P2:** degraded experience with a workaround;
- **P3:** minor polish, wording or isolated data issue.

For suspected security or privacy issues, stop testing that flow and contact the release owner privately. Do not post sensitive evidence publicly.

## Catalog feedback

Report:

- wrong dish/stall relationship;
- incorrect name, price, address, unit or coordinates;
- missing or unsafe image;
- duplicate or non-consumer listing;
- stale opening hours;
- search/location ranking that is clearly wrong.

Provide a public merchant/menu/location source where possible.

## Beta expectations

- Builds may expire or be replaced.
- Test data can be reset with notice.
- Hungry may disable a feature to protect reliability.
- Beta feedback does not guarantee a feature request will be built.
- The release owner will communicate known incidents and new builds.
