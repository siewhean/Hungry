# Discovery/map/detail remediation interaction design

Sources: docs/audit/SEARCH_SPEC.md, MAPS_SPEC.md, DETAIL_SPEC.md, OFFLINE_SPEC.md and design/figma-v2/discover-search.html/stall-detail.html. Preserve orange/navy tokens and current layout.

- Dietary selections are hard ALL requirements; no match displays a truthful empty state with edit/clear control, never unrestricted substitutions. Taste sliders edit local draft; Apply commits once, Back cancels. Each slider announces its dimension/value.
- Every card retains one dish/venue identity and price. Remove cross-dish timed carousels. Images may fail into a neutral placeholder without changing tap destination. Use accurate review count/highly-rated/available-data language, no unsupported duration/trend/editor claims.
- Async query/detail/slate resources visibly distinguish loading, empty/missing, failure and retained stale content. Version async responses; Retry repeats the current request without losing filters/input. Invalid IDs never resolve unrelated places.
- Decide awaits the existing recommendation slate, carries profile diet/current location/radius/exclusions, and retains empty/error/retry/radius affordances.
- Maps use sourced building coordinates, no fabricated interior/stall precision. Pins and filters select the actual displayed candidates. Keep Mapbox SDK attribution visible. Sheet adjustment has named expand/collapse actions, gesture only on the handle, and large-text-safe scrolling.
- Detail visit control is Visited this stall, backed by explicit desired venue state; never writes reviewed dish IDs. Stall save controls save the stall. Portfolio and checklist actions honor their individual production flags.
- Review rows have contextual safety actions with canonical author identity. A successful block/hide causes mounted content to refresh/filter through the shared safety state.
- Source attribution is an accessible trusted link. Recoverable errors, modal dismissal, Back, price text and offline retry use shared accessible components; do not promise queued submission without actual queue.

Source/UI changes require focused behavior checks; native layout/screen-reader and source-equivalent installed artifact acceptance remain separate.
