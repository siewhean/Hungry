# Lunch shortlist — 13 November 2026

Extension of `design/figma-v2/discover-search.html` and `design/stitch/STITCH_BRIEFS.md` §12. Keep the existing hero, explanation, two alternative cards and Directions/Save dock.

- Add a neutral constraints card before result content. Label maximum item price with S$5 / S$8 / S$10 controls and show the effective maximum when the profile budget is lower. Never relax profile dietary requirements or budget implicitly.
- Add 500 m / 1 km / 3 km search-radius controls. These are straight-line distances from the selected location, not walking routes or meal completion times. State that queue and preparation times are unknown.
- Require GPS permission or a selected map coordinate; never claim the default coordinate is the user's location. Provide a location permission action when unavailable.
- Show one recommended dish and up to two alternatives, with an explicit count if fewer than three qualify. Prices describe listed items, not verified dine-in complete meals.
- Keep constraints available during loading, error/retry and empty results. Latest request wins. Changing controls clears old choices. Try another changes only the dish; radius expansion requires an explicit labelled action.
- Accessible selected states, wrapping controls, minimum shared Button touch targets, theme tokens and Nunito / DMMono typography. No new route or dependency.

Acceptance: positive finite prices and finite in-radius distances only; effective budget and dietary requirements applied before requesting ranked candidates and checked on response; duplicate IDs removed; unavailable location never fetches a nearby slate; no total-time guarantee or synthetic meal/price evidence. Native and live service acceptance remain required before a production release.
