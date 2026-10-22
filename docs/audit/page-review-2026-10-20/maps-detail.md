# Maps, dish/stall detail and recovery expert review — 20 October 2026

Reviewer: maps/place-detail UX designer, geospatial/data/backend engineer, accessibility reviewer and debugger. **8/8 assigned TSX files inspected**, with relevant shared components, stores, repository/service paths and navigation gates. Scope is the current dirty mobile tree based on `50b2223e3ee058618bc23db48a97fb9fafac41ee`. No app edits, builds, simulator interaction, provider writes or release operation performed.

## Judgment and evidence boundaries

Independent reachability correction: DiscoverMap/MapZoomedIn are production-registered, but the inspected ordinary consumer Home/Discover entries hide the map buttons or route to StallDetail. Registration does not prove a normal production entry. MD-01 is P1 for exposing/shipping the live-map journey; current mainstream consumer impact remains conditional. MD-02 applies when a token-backed map is displayed. See `crosscheck-discovery-social.md` for final per-ID scope.

The dish-first concept is strong: dish → stall → full address, taste information, prices, saves and reviews form a useful decision chain. The current implementation breaks trust at several points: map chips can promise filters they never apply, purported stall positions are fabricated, a dish-level Tried control toggles a venue, and menu cards change the dish they represent. These deserve correction before decorative polish.

Governing design sources read before source critique: `docs/audit/MAPS_SPEC.md`, `DETAIL_SPEC.md`, `OFFLINE_SPEC.md`; relevant `design/figma-v2/building-layout.html` and `stall-detail.html` structures. The HTML offers several design variants rather than an unambiguous approved final layout. Offline spec still prescribes forced navigation; current `RootNavigator.tsx:367` explicitly replaced that with a non-destructive banner. Do not restore the stale spec or claim pixel fidelity. Catalog raw detail, claim popup and NotFound lack an identified dedicated approved design in these sources.

Source-backed defects below are not live exploit or on-device reproductions. No screenshots were inspected by this reviewer. Root's `runtime-evidence.md` records current gate failures, bounded browser checks and an existing native artifact whose source equivalence is unknown. Native gesture capture, focus, map camera behavior, exact rendered contrast/large-type layout and external app launch remain unverified. No full test suite was rerun by this reviewer.

## Complete per-file coverage

| Assigned file under `src/app/screens/` | Purpose / actual reachability | Design and inspection | Findings / remaining runtime checks |
|---|---|---|---|
| `catalog/CatalogRawDetailScreen.tsx` | Catalog dish/venue record; registered and auth-protected; useful entry is catalog-v2 opt-in plus Supabase | No specific approved design identified; complete fetch/effect/error/skeleton/image/source/status/back UI inspected | MD-16/17; release switch, overlapping requests, long source URLs and native Back unverified |
| `detail/DishDetailScreenV2.tsx` | Current production `DishDetail`, not gated just because filename says V2 | Detail spec/stall prototype partial; hydration, shared save/share/list actions, tried/review gate, taste/price/hours, all rendered sections inspected | MD-06/07/10/11/12/14; cold-link, auth return, rejected writes, assistive tech and narrow viewport unverified |
| `detail/MerchantClaimExplainerScreen.tsx` | Transparent claim-information popup; registered only when merchant claim CTA flag enabled (false in production) | No dedicated design; every text/action/backdrop and modal geometry inspected | MD-15; screen-reader modal confinement and large-type/short-screen dismissal unverified |
| `detail/NotFoundScreen.tsx` | Registered production recovery page | No dedicated design identified; title/body/feed reset/search state/width inspected | MD-13; actual bad-link dispatch and keyboard/large-type clipping unverified |
| `detail/OfflineStateScreen.tsx` | Registered production diagnostic/recovery route; automatic offline UX now uses banner | Offline spec conflicts with deliberate current navigation model; refresh/store update/copy inspected | MD-18; NetInfo failure, route exit and reconnection behavior unverified |
| `detail/StallDetailScreen.tsx` | Current production place/menu/review/address page; claim/replies separately gated | Detail spec + variant-based stall prototype; hydration, menu categories/pagination/cycling, every public action, promotions/reviews/replies/claim inspected | MD-05/06/08/09/10/11/12/14; live menu/review volumes, failed writes, share/deep-link and focus unverified |
| `discover/HomeMapScreen.tsx` | Current production `DiscoverMap`; legacy default and opt-in raw-catalog branches | Maps spec/building-layout partial; marker construction, filters, camera, list/carousel, pan responders, search/recenter/legend inspected | MD-01/02/03/05/11/14; real map/permission-denied/gesture/viewport behavior unverified |
| `discover/MapZoomedInScreen.tsx` | Production root route reached from Discover place cards; not behind floorplan flag | Maps/building-layout partial; fallback building resolver, markers, venue/open subset, sheet and back inspected | MD-03/04/14; unknown catalog building, closed/empty building, assistive-tech and zoom interactions unverified |

## Findings (severity ordered)

### MD-01 — P1 — The default map's filters and pin selections have no outcome

**Class:** confirmed source behavior defect, current production default path. **Evidence:** `HomeMapScreen.tsx:158` derives visible buildings without `mapFilters`; `:169` derives dishes from that unfiltered set; `:433` passes `onMarkerPress={... : undefined}` outside catalog-v2. The chip rail updates flags at `:520–527`, but flags are only applied to the opt-in catalog network path at `:206–227`. Default list cards at `:667` are also unfiltered.

**Trigger / consequence:** tap Open Now, Hawker or Top Rated, or tap a displayed pin with catalog-v2 disabled. The chip visually changes but visible results do not; pins cannot select a building/stall. The app's map cannot reliably answer the user's basic open/nearby constraint. This is source confirmation, not a native gesture reproduction.

**Recommendation / owner / closure:** discovery/map engineer: implement one predicate/result set shared by chips, markers and list/carousel, and provide an actual default marker handler. Verify each filter against fixtures including closed/non-hawker/low-rated entries, then tap every marker type in native mock/live modes. Existing catalog-v2 logic must not be treated as fixing the default path.

### MD-02 — P1 — Native Mapbox configuration removes required map credits

**Class:** confirmed integration configuration gap; runtime applicability requires token-backed Mapbox map. **Evidence:** shared `src/components/map/MapSurface.tsx:479–482` uses `mapbox://styles/mapbox/streets-v12` with both `attributionEnabled={false}` and `logoEnabled={false}`. No replacement attribution is rendered in this component or either assigned map screen.

Mapbox's current [attribution guidance](https://docs.mapbox.com/help/dive-deeper/attribution/) requires logo and text attribution for Mapbox styles/data, including Streets. Hiding the built-in information UI also creates a telemetry-opt-out obligation; an approved alternative arrangement was not evidenced. This finding is conditional on shipping this configured Mapbox integration; no contractual exception was established.

**Recommendation / owner / closure:** mobile/maps owner: retain the supported credits UI and place it clear of sheets, or document an approved compliant alternative. Verify credits, links and required opt-out on iOS/Android with the exact live map artifact. No legal certification is claimed by this audit.

### MD-03 — P2 — Pin coordinates fabricate stall precision

**Class:** confirmed source data-integrity defect. **Evidence:** `HomeMapScreen.tsx:367–374`, `MapZoomedInScreen.tsx:65–77` calculate stall coordinates from array index with `0.00007` offsets around a building. These are neither surveyed coordinates nor geometry-derived store polygons; the user sees ordinary stall markers with no approximation disclosure. Index order can change a stall's purported location.

**Trigger / consequence:** zoom above 16.5/17.0. A spatial-looking stall position is displayed without supporting geometry, risking a wrong in-building destination. The source comments acknowledge a temporary spread strategy, which does not inform the user.

**Recommendation / owner / closure:** map/data engineer: show a building-level group/list until approved polygon/point geometry exists; label approximate locations explicitly. Preserve JSON/SVG geometry contracts. Test that unsupported stalls never acquire precise pins and that imported geometry determines any precise location.

### MD-04 — P2 — An unrecognized building silently resolves to Maxwell

**Class:** confirmed source fallback defect. **Evidence:** `MapZoomedInScreen.tsx:19–30` resolves a passed ID in static `singaporeBuildings`, then selected name, then unconditionally `hc-maxwell`; `:65`/`:85` synchronously query building venues with no async loading/error path. Discover passes `card.venue.buildingId` (`DiscoverHomeScreen.tsx:2194`, `:3339`), including data IDs not established to share this static namespace.

**Trigger / consequence:** open an unknown/new catalog building ID or a cold Supabase cache. The user can see the wrong centre or an empty/Closed now view rather than an unavailable record. This audit does not assert all actual live IDs fail.

**Recommendation / owner / closure:** discovery/data engineer: resolve passed identity at the repository boundary, asynchronously hydrate required records, and show explicit unknown/empty/retry states. Verify unknown ID, canonical/static alias, cold cache, zero venues and all venues closed; never substitute an unrelated building.

### MD-05 — P2 — Network failures masquerade as absent places, menus and reviews

**Class:** confirmed source recovery defect. **Evidence:** `HomeMapScreen.tsx:235–240` catches catalog failures by clearing all results without loading/error UI; `StallDetailScreen.tsx:279` marks a failed venue request loaded, then renders Stall not found; menu catch `:381` sets `[]` and UI `:1067` says no menu; per-dish review catch `:463–465` returns `[]` and UI `:1238` says no community reviews. `DishDetailScreenV2.tsx:281` similarly marks failed detail loaded and renders unavailable/removed copy at `:361`.

**Trigger / consequence:** transient timeout/permission/provider error is indistinguishable from a deleted listing or genuinely empty menu/review collection. Users cannot retry in place, and cached Supabase menu data is deliberately replaced by `EMPTY_DISHES` while requests are unresolved (`StallDetailScreen.tsx:288–290`).

**Recommendation / owner / closure:** detail/discovery engineer: model pending, not found, forbidden, stale and failed states separately; preserve last known data with freshness indication and retry. Test failures for each independent resource without treating another resource's success as full page health.

### MD-06 — P2 — Dish Tried toggles an entire venue and can undo another dish's visit

**Class:** confirmed source state-model defect. **Evidence:** dish checkbox reflects `profile.reviewedDishIds` (`DishDetailScreenV2.tsx:486`), but handler calls `markTried(profile.id, dish.venueId)` at `:503`. Store `src/store/useStallInteractionStore.ts:127–168` toggles one `isTried` per stall; returning false removes only the current dish's reviewed ID at `DishDetailScreenV2.tsx:526`.

**Trigger / consequence:** mark dish A at venue V, open unchecked dish B at V and tap Tried. The handler unmarks V rather than adding B; A's checkbox can remain checked. Dish-level taste/history and venue visitation diverge. A Tried action also populates a collection called reviewedDishIds despite no written review.

**Recommendation / owner / closure:** profile/detail domain owner: use explicit idempotent dish tried state and derive venue visit separately, keeping actual reviews distinct. Test A/B at the same venue, removal, app reload, account switch and server hydration.

### MD-07 — P2 — Failed Tried writes leave optimistic state without recovery

**Class:** confirmed source async/error-handling defect. **Evidence:** `useStallInteractionStore.ts:142–152` commits local state before awaiting remote upsert and has no rollback; `DishDetailScreenV2.tsx:502–541` uses try/finally without catch. A rejection skips dish-state reconciliation and error feedback while the venue mutation remains visible.

**Trigger / consequence:** denied/offline upsert or FoodCred failure leaves inconsistent local versus persisted state and may surface an unhandled rejection. Busy exclusion is present and worth keeping; it does not repair failed state.

**Recommendation / owner / closure:** store/detail engineer: roll back or retain an explicit unsynced state; catch and show actionable failure. Verify rejected upsert and subsequent retry/refresh with matching dish/venue state; test points once separately.

### MD-08 — P2 — Menu cards rotate into different dishes while users read or tap them

**Class:** confirmed source interaction/data-identity defect; UX judgment on impact. **Evidence:** `StallDetailScreen.tsx:179–200` builds each card's slides from the original dish plus other dishes, not additional photos of that dish; `:213–235` changes accessibility name, tap destination, visible name and price to `activeDish`. Every visible row therefore repeats overlapping dishes while changing its target on a timer.

**Trigger / consequence:** a user identifies a menu item and the timer advances before the tap, or compares cards/prices. The target and price change without deliberate selection. This undermines a stable menu and screen-reader focus even if image/text remain synchronized.

**Recommendation / owner / closure:** menu designer/mobile engineer: keep one stable dish identity per card; optionally cycle only that dish's gallery with pause/reduced-motion support. Test a delayed tap across a cycle and verify dish ID, price and accessible name remain stable.

### MD-09 — P2 — Stall save and add-to-list behavior is inconsistent with its label and feature gates

**Class:** confirmed source product/action mismatch. **Evidence:** stall header at `StallDetailScreen.tsx:797–805` advertises saving this stall but toggles only `leadDish` favourite; if the menu is empty it silently does nothing. The actual stall interaction save exists separately below. The `DetailSaveActionsCard` containing portfolio action is gated by `collectionsEnabled` at `:916`, although `portfoliosEnabled` is true in production and collections are false.

**Trigger / consequence:** header save is different from the stall save control; changing first menu dish can change apparent saved status, and production hides the explicit stall-to-portfolio action alongside disabled checklists.

**Recommendation / owner / closure:** product/detail engineer: choose clear entity-specific save semantics, disable/explain unavailable actions, and gate independent actions with their own flags. Verify empty/reordered menus, saved stall vs dish, and production portfolio creation from a stall.

### MD-10 — P2 — Public detail reviews omit contextual safety controls

**Class:** confirmed source affordance gap, production UGC surface. **Evidence:** `DishDetailScreenV2.tsx:930–970` renders author/rating/text only; `StallDetailScreen.tsx:1090–1245` adds gated local replies but no report/block action. Neither file invokes the shared community safety action helper. The existence of a report action elsewhere does not make these individual reviews reportable here.

**Trigger / consequence:** a user reads abusive/infringing content on its detail page but has no contextual route to report that review/author or block the author. Root's policy/safety review owns overall adherence and cross-user enforcement; this finding alone is not a full compliance judgment.

**Recommendation / owner / closure:** trust & safety/detail engineer: add accessible review-specific report/author block controls with canonical IDs, clear failure paths and backend enforcement. Verify the exact displayed review can be reported and that a blocked author is filtered across all surfaces after restart.

### MD-11 — P2 — Live/precision labels exceed the data evidence

**Class:** confirmed source presentation mismatch; freshness must be assessed against real data. **Evidence:** `DishDetailScreenV2.tsx:182–186` maps coarse crowd levels to fixed minute bands; `src/lib/services/dataTrustDisclosure.ts:32` calls any Supabase mode a Live wait estimate/map status regardless of timestamp/source. `HomeMapScreen.tsx:836` rounds dish prices to a whole dollar, while detail uses fixed cents (`DishDetailScreenV2.tsx:189`).

**Trigger / consequence:** an old/unknown crowd field is presented as live estimated waiting and S$4.50 becomes S$5 on the map. A user comparing budget or travel choices receives inconsistent precision. The report does not claim the actual live crowd values are always stale.

**Recommendation / owner / closure:** data/product owner: use provenance/freshness-based labels and avoid numeric waits without a justified estimator; format the same monetary value consistently, including unknown/market prices. Test stale/missing crowd data and fractional prices end-to-end.

### MD-12 — P2 — Stall menus fan out a review request for every dish before the user asks

**Class:** confirmed source request pattern, performance risk not measured latency. **Evidence:** `StallDetailScreen.tsx:458–470` runs `Promise.all(dishes.map(getReviewsForDish))` for the entire menu. The visible menu uses batches of ten, but request count is not bounded by that visible pagination. Reviews are then combined client-side.

**Trigger / consequence:** a stall with hundreds of dishes produces hundreds of requests, along with menu/promotions/visitor activity. Errors turn into empty results. Actual live response times/quotas were not measured.

**Recommendation / owner / closure:** backend/detail engineer: use one bounded stall review query or lazy batched loading, preserve deterministic ordering, and cancel obsolete venue requests. Measure request count and time with realistic 10/100/1000-dish fixtures; assert a fixed small initial request budget.

### MD-13 — P2 — NotFound search discards what the user typed

**Class:** confirmed source recovery defect. **Evidence:** `NotFoundScreen.tsx:17,27–29` owns a local query, then only navigates to SearchHome and clears it; it never updates `useSearchStore` or supplies query params. Placeholder/body refer to recipes, inconsistent with actual dish/stall search.

**Trigger / consequence:** type a dish into recovery search and submit: next screen cannot receive that query, so the user repeats work.

**Recommendation / owner / closure:** navigation/search engineer: pass normalized query through the canonical search contract before navigating; retain input until handled. Verify populated, whitespace, keyboard submit and Back restoration; use dish/stall language.

### MD-14 — P2 — Map controls/sheets lack accessible equivalents for gesture-only behavior

**Class:** confirmed source semantic gaps plus native behavior needing verification. **Evidence:** HomeMap sheet `PanResponder` at `HomeMapScreen.tsx:299` claims start events and only gesture deltas resize it; `:598` applies handlers to the whole sheet; drag handle `:613` is a plain View without adjustable actions. `MapZoomedInScreen.tsx:129` back icon and `:188` stall rows are bare Pressables lacking explicit label/role; HomeMap legend icon `:548` lacks accessible name. Fixed sheet heights 60/240/620 and raw all-venue lists lack a large-type plan.

**Trigger / consequence:** assistive-tech users lack a reliable named expand/collapse control, and nested scrolling/taps may compete with the parent pan responder. Exact interception/clipping is a runtime concern, not proven from source alone.

**Recommendation / owner / closure:** accessibility/maps engineer: add named adjustable/button actions, 44+ targets, explicit focus/expanded state and constrain pan capture to the handle; adapt to available viewport. Verify VoiceOver/TalkBack, large type, scroll/tap, reduced motion, short screens and landscape.

### MD-15 — P2 — Claim popup has no bounded-scroll or modal focus treatment

**Class:** source accessibility/layout gap, gated beta. **Evidence:** `MerchantClaimExplainerScreen.tsx:23–83` centres a full instructional Card inside a plain View with no ScrollView, max-height/safe-area accommodation, modal accessibility semantics or focus management. Close icon has no minimum target size at `:52`.

**Trigger / consequence:** larger text/short screens can put instructions or dismissal offscreen; screen readers may traverse the background route. Native clipping/focus failure was not reproduced.

**Recommendation / owner / closure:** merchant UX/accessibility owner: use the approved shared modal/sheet primitives with scroll bounds, named accessible dismissal and modal focus. Verify longest text at accessibility sizes before enabling this beta route in production.

### MD-16 — P2 — Raw catalog requests can overwrite newer route state

**Class:** confirmed source race exposure, opt-in catalog-v2 route. **Evidence:** `CatalogRawDetailScreen.tsx:33–57` performs uncancelled `load()` with no request identity or active guard. It writes detail/error/loading after awaits; reused route ID/kind/release changes or rapid Retry requests can complete out of order. Its auth/data-mode precondition only says sign in with live source and offers Retry, not a sign-in/back action.

**Trigger / consequence:** a slow previous record request can replace the newer requested record or an old rejection can replace success; a mode/auth prerequisite failure is not repaired by Retry.

**Recommendation / owner / closure:** catalog engineer: cancel or token-gate stale requests and give actionable auth/source prerequisites. Test A→B ID/kind/release transitions and retry ordering with controlled promises, plus auth expiry while loading.

### MD-17 — P3 — Catalog source attribution is visible but not inspectable as a link

**Class:** confirmed source usability issue, optional polish after correctness. **Evidence:** `CatalogRawDetailScreen.tsx:178–188` pairs an ExternalLink icon with a single-line AppText URL and no Pressable/open handler. Back at `:105` is icon-size only without a 44px target. Price uses h2 instead of the agreed price text variant (`:156`).

**Consequence / recommendation / owner / closure:** a source-status badge cannot be conveniently verified; long URLs truncate. Catalog UX engineer: provide a safe allowlisted source action and full accessible source label, correct target sizing and price style. Verify unknown/malformed URL handling and keyboard/screen-reader activation. Preserve useful source-status disclosure.

### MD-18 — P3 — Standalone Offline route does not expose a complete recovery interaction

**Class:** source handling gap/route limitation; optional relative to current automatic banner. **Evidence:** `OfflineStateScreen.tsx:8–10` awaits NetInfo.refresh with no busy guard/catch; it updates a global flag but never navigates off this explicit route. Copy says submit actions wait, but this file establishes no queue. Current RootNavigator uses a banner rather than auto-entering/leaving this route.

**Recommendation / owner / closure:** connectivity engineer: clarify the standalone route's purpose, provide safe Back/browse and refresh error/busy handling; describe only actual queue behavior. Verify explicit route entry, rejected refresh, repeated taps and restored connection without losing draft/navigation state. Do not reinstate the obsolete forced-offline redirect.

## Cross-domain privacy finding requiring live closure

**MD-PRIV-01 — P1 beta-enablement verification gap, not a proven deployed leak:** Home-based verification promises a rough 500m area or fully hidden location (`HomeBasedVerificationScreen.tsx:164–203`). `supabaseService.ts:5110` stores `location_privacy` on merchant_outlets while `:5168` still mirrors floor/unit into venues. Consumer `supabaseRepository.ts:195–214` maps unit/floor/address/postal code with no locationPrivacy field/redaction; StallDetail derives/shares full address at `:337–338`, `:629–632`, `:957`. No consumer migration/projection coupling to that privacy selector was found in the reviewed path. This establishes missing end-to-end enforcement in source, not that a real home address is currently deployed/exposed. Owner: merchant/backend/privacy. Closure: seed a synthetic home-business in staging with hidden/approximate/exact modes; query as owner, another user and anonymous through all detail/map/share/direct API paths. Verify server-side redaction of unit/address/coordinates before enabling the feature. Coordinate with merchant report rather than double-counting it.

## States, backend/data paths and design coverage

| Area | Inspected strengths | Still needs proof |
|---|---|---|
| Detail load | Cache-first reads, async service fallback, active flags on dish/stall effects | Distinct fetch errors, stale data, not-found, auth-expired and retry; no source-pass claim for provider behavior |
| Saved/list/visited | Protected actions preserve return route; list/save hooks reused; busy guard on Tried | Canonical entity semantics, rejected writes/rollback, server persistence, account change cleanup; shared saved-tools findings apply |
| Shares/directions | Canonical webShareUrl for dish/stall; address built centrally; trusted maps URL opener | Universal/App Links and web fallback on installed/uninstalled iOS/Android; external launch refusal feedback |
| Place/menu | Full address, explicit operating-hours section, menu category/batch controls and missing-photo support | Stable menu identity, price/source truth, unknown hours/days, fresh status, real menu sizes |
| Reviews/promotions | Promotion impression deduplication; local-only replies explicitly production-gated | Contextual safety and bounded data access; a failed resource must not become a factual empty-state claim |
| Map | List/carousel alternative and catalog-v2 viewport query with cancellation guard | Default pin/filter functionality, honest geometry, attribution, zoom/camera/focus, current location denied/unavailable |
| Raw catalog | Source-status badge and request retry; authenticated service mode boundary | User-facing detail parity, safe source linking, stale-request rejection, correct release pinning |
| Recovery | Non-destructive global offline direction preserves route/draft in current root | NotFound query handoff; standalone offline route and actual submission persistence |

Additional unverified considerations: `DishDetailScreenV2.tsx:149–161` computes day-of-week using device timezone and falls back to the first listed row when today is absent, so Singapore-time/missing-day semantics need a focused contract; `StallDetailScreen.tsx:254` imposes an 800ms skeleton even on cached records, which conflicts with the project's threshold-based loading guidance and should be removed after state modeling. These are lower-priority source observations, not hidden completed checks.

## Honest comparison with current first-party product sources

These comparisons use documentation/pages opened on 20 October 2026, not claimed hands-on sessions or pixel comparisons.

| Comparator | Verified pattern / Hungry judgment | Keep / change / tradeoff |
|---|---|---|
| [Google Maps nearby search help](https://support.google.com/maps/answer/4610185?hl=en) | Describes nearby/category exploration with selectable results and relevance/distance/prominence ranking. Hungry's dish-level taste and stall-unit context are more specific to its meal-choice purpose, but default inert pins/filters fall below basic spatial exploration expectations. | Keep dish→stall and exact unit when authorized; make every filter/pin actionable before adding spatial decoration. Avoid recreating a full navigation app. |
| [Grab Dine Out](https://www.grab.com/sg/food/dine-out/) | Presents location/cuisine/occasion filtering plus menus/photos/reviews before visiting. Hungry combines taste, SGD price and stall details well in principle; rotating menu identities and failed-load-as-no-menu undermine that decision utility. | Keep simple food-first menu/detail flow; stabilize items and show source/freshness/availability. Reservations/deals/payment are not required parity for Hungry. |
| [Burpple](https://www.burpple.com/beyond) | First-party page links discovery by location/craving/trending, community reviews and saving dining spots. Hungry's local hawker/detail depth is a credible differentiator, but confusing stall-vs-dish saves and inaccessible contextual review safety reduce trust. | Keep contextual reviews/taste evidence and useful saves; distinguish saved entity types and let users report the content where they see it. A paid membership/deals model is outside the audit recommendation. |

Visual quality cannot receive an honest numerical score from source alone. Product judgment: strong local specificity, weaker interaction reliability and evidence labeling. The best next design pass should make map/detail outcomes predictable, rather than expand the number of controls.

## Prioritized closure and verification

1. Fix MD-01 and verify production default maps, then preserve required map attribution (MD-02).
2. Remove unsupported precise geometry, unrelated fallback destinations, unstable menu identities and dish/venue Tried mismatch (MD-03/04/06/08).
3. Repair independent error/retry and mutation recovery, contextual review safety and entity-specific saves (MD-05/07/09/10).
4. Bound review requests, normalize data precision/freshness, and finish assistive-tech/gesture checks (MD-11/12/14).
5. Before enabling catalog-v2 or merchant/home-business surfaces, obtain release-pinned live data, privacy redaction and beta route-specific proof. No missing live proof is waived.

Reviewer verification: all eight assigned TSX read; governing sources inspected; supporting route/repository/store/MapSurface/privacy paths traced; current first-party comparison and Mapbox guidance read. No new automated test run or native acceptance claim. Root owns current terminal/browser/native results and independent adjudication. No P0 finding was established.
