# Budget discovery — bounded design addendum, 13 November 2026

Extends `design/figma-v2/discover-search.html` and Stitch search-result brief (§11).

- Keep Quick Bites header, two-column dish grid, detail navigation, and existing token styling.
- Budget collection adds a persistent maximum-price rail: “S$5 max”, “S$8 max”, “S$10 max”. Default S$8. Accessible buttons expose their selected state through existing FilterChipRail/Chip.
- Display the effective maximum immediately below the rail. A stricter saved profile maximum continues to apply and is stated explicitly. Controls never silently change the profile. Invalid persisted budgets fail closed with an update-profile message.
- All limits are inclusive and apply before production search ranking; mirror the same positive finite-price guard on returned results and demo collections. Production budget results bypass repository rehydration so an older cached price cannot replace the search result. Unknown, zero, negative and non-finite prices are excluded.
- Copy says “Listed item prices; portions and dine-in prices may vary.” No verified/current-price, complete-meal or live-availability claim without evidence.
- Require an explicit manual coordinate or granted GPS location before searching the budget surface; otherwise show Enable location / Back to Discover while retaining budget controls. Never label the default coordinate as the user’s location.
- Loading clears previous budget results; cancellation ignores older responses. Failure exposes Retry; empty results name the effective maximum and retained dietary filters. Never silently widen a cap or remove dietary constraints.
- Other collection layouts and limits remain unchanged. No new routes, backend changes, or production mock fallback.

Acceptance: exact-cap dishes included; above-cap/unknown prices excluded; both stricter-profile and higher selected caps work; no stale result flash under a changed maximum; controls fit narrow widths using the existing horizontal rail and theme tokens.

Discover entry rail: use “Budget up to S$8” and “Budget dish” labels to match the inclusive default maximum without asserting meal completeness.
