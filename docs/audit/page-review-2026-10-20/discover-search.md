# Discover and Search — page expert review

Reviewer: discover_search_expert, acting as food-discovery product/UX designer, search/recommendation engineer, backend reviewer, accessibility reviewer and debugger. Date: 20 October 2026 (Singapore). Scope: all **7/7** assigned TSX files, current dirty working tree based on HEAD `50b2223e3ee058618bc23db48a97fb9fafac41ee`. Review only; no application edits or deployment.

## Verdict and evidence boundary

**No-Go for production discovery/search sign-off in this reviewed source**, primarily because selected dietary constraints can silently admit excluded dishes (DS-01/02), and successful Supabase search does not implement the advertised taste adjustment (DS-04). These are scoped audit findings, not proof that the currently installed binary reproduces them. Catalog v2 is environment-selected; DS-02 concerns the legacy branch, DS-03/10 the raw-catalog branch. Crave is development/staging gated and its defects do not block the current production surface.

Design read before implementation inspection: `docs/audit/SEARCH_SPEC.md` and `design/figma-v2/discover-search.html` (three directions; A recommended, not evidence of a formally approved final selection), plus `PROJECT_INSTRUCTIONS.md` and `tasks/design-system.md`. The design calls for prominent food intent, discoverable map entry, meaningful taste sliders, result recovery, and dish/venue grouping. No dedicated approved final artifact was located for Crave, Quick Bites full-screen grid or Decide result. Design fidelity for those surfaces remains unproven. I inspected HTML/spec source, not a rendered Figma canvas.

Read startup/workflow/environment/backlog/verification/lessons/data-contract pointers and the invoked `hungry-release-readiness` skill/gates. Followed navigation, feature flags, search/profile/location/discovery stores, recommendation/search helpers, browse index, Supabase repository/service/RPC SQL, raw catalog service, `SearchResultsView`, `CyclingGridImage`, and screen/layout primitives. No live authenticated API, RLS execution, writes, simulator navigation, full build or broad tests. Store-policy conclusions are deferred to the parent release review.

I opened `runtime/installed-discover.png`, captured by the parent. It visibly shows an offline banner covering the location heading. This is **installed-artifact evidence only** (binary dated Oct 19; equivalence to this dirty source unknown). See DS-16. Food imagery, clear local dish labels, strong orange/navy actions and generous primary cards look coherent in this one screenshot; it does not prove the remaining pages, dynamic type, dark mode or interactions.

## Per-file coverage

| File | Purpose and reachability | Governing design | Inspected and finding IDs | Still needs runtime proof |
|---|---|---|---|---|
| `src/app/screens/discover/DiscoverHomeScreen.tsx` | Production Discover tab; intent chips, food rails, decide, browse entry, local stalls. Crave CTA is non-user-mode plus `craveEnabled`. | Discover/search HTML; SEARCH_SPEC | Entire file: data mappings, memoized lookup, area requests/cancellation, dietary predicates, cache-based decide, rail slicing, skeletons, refresh, nested gesture/scroll transforms, every card/CTA. DS-01/05/06/11/12; DS-16 installed artifact. | GPS denial/revocation/manual selection, large text, nested scroll recovery, dark theme, real slow/offline transport, actual image provenance. |
| `src/app/screens/discover/DecideForMeResultScreen.tsx` | Production recommendation result; save, share, directions, alternates, radius expansion. | Discover concept only; no dedicated final result artifact found. | Entire file: candidate query/memo, selection effect, radius ladder, budget preference, score explanation, impression analytics, address/deep-link/save/share, sticky dock and alternatives. DS-05/12. | Cold Supabase cache, changed location/profile, signed-out save return, missing venue/address, reduced motion, large text dock. |
| `src/app/screens/discover/QuickBitesScreen.tsx` | Production collection route for quick/trending/editor/budget/late-night. | Discover rails concept only; no dedicated full-grid artifact found. | Entire file: repository fallback, live search, cuisine filters, async lifecycle, distances, images/failure handling/cross-venue cycling, viewability, FlashList/footer, collapsed rail/search. DS-03/06/07/08/09/12/14. | Slow/out-of-order requests, empty/error distinction, image failures, touch-down during auto-advance, assistive labels, performance with many results. |
| `src/app/screens/discover/CraveScreen.tsx` | Swipe save/pass. Route gated by `craveEnabled`; production false. | No dedicated final artifact found. | Entire file: random initial pool, stable PanResponder closure, auth return, favourite toggle, animation callbacks/end state, overlays/buttons. DS-06/12/13. | Sequential swipes/auth changes, rapid taps, undo, screen-reader actions and completion back destination. |
| `src/app/screens/search/DishSearchScreen.tsx` | Production SearchHome, categories/taste, inline suggestions, recommendations. | SEARCH_SPEC; Discover/search HTML. | Entire file: local/store query, 250ms debounce/cancellation, Supabase v2 exclusion, categories, submit, recommendation copy/images/links. DS-03/04/09/14. | Query restore/keyboard behavior, long text, suggestions returning/failing, real v2 landing state. |
| `src/app/screens/search/SearchResultsScreen.tsx` | Production results plus BrowseDishes/BrowseStalls exports; raw-v2 or legacy provider branch. | SEARCH_SPEC; Discover/search HTML. | Entire file: both grids, release/cursor paging, auth guard, request versions, card identity, raw request mapping, legacy index/filter, async results/mood search, shared result component. DS-02/03/04/07/09/10/12. | Exact release-version paging, expired auth, stale page/query transitions, image failures, mood RPC races, Android/iOS search focus. |
| `src/app/screens/search/TasteFilterScreen.tsx` | Production six sliders + reset/apply. | SEARCH_SPEC §3. | Entire file: integer steps, generic endpoint legends, immediate persisted store mutation, profile reset, unlabeled native sliders, apply navigation. DS-04/12/15. | VoiceOver/TalkBack names/values, back/cancel expectation, count feedback, long text and smallest supported screen. |

## Findings

No P0 identified. Classification distinguishes confirmed source defect, source-supported product critique, runtime-only observation and external proof gap.

### DS-01 — P1 — “Dietary Needs” uses any-match for multiple requirements

- **Class:** confirmed source defect; dietary filtering/data integrity. **Where:** `src/app/screens/discover/DiscoverHomeScreen.tsx:1720`; supporting SQL `supabase/migrations/20260621114541_search_dishes_restore_fast_guarded.sql:255`.
- **Trigger/consequence:** a profile selecting vegetarian AND nut-free taps Dietary Needs; a vegetarian-only dish passes because the screen uses `discoverDietaryFlags.some(...)`. At the SQL layer, array overlap on availability/venue dietary tags can also pass only one requested flag before the all-flags relation check. This is unsuitable for presenting multiple selected needs as satisfied.
- **Evidence:** executed the extracted current-source predicate in an isolated AST harness: vegetarian-only returned `true` for `['vegetarian','nut_free']`. No live SQL claim. Profile-empty fallback also silently treats halal/vegetarian/pork-free as interchangeable choices; user-facing meaning is undefined.
- **Recommendation/owner:** search + data/backend: enforce every selected constraint, retain unknown/unverified states, use only authoritative dietary fields, and require the same semantics in UI and RPC. Let users configure their needs rather than silently selecting defaults.
- **Close with:** combination/unknown-tag unit cases and live signed-in RPC + UI checks showing a missing requirement is excluded. Dietary source verification is separate from matching correctness.

### DS-02 — P1 — Zero-result Halal filter restores all legacy browse dishes

- **Class:** confirmed source defect. **Where:** `src/app/screens/search/SearchResultsScreen.tsx:850` and `:871`.
- **Trigger/consequence:** Browse Dishes/Stalls, empty text, select Halal with no match. `filtered.length || query ? filtered : feedItems` returns the full unfiltered set while Halal remains selected. The free-text `searchText.includes('halal')` check also treats names/captions containing “non-halal” as matches.
- **Evidence:** isolated execution of the actual extracted `filteredFeedItems` initializer returned a pork-noodles item with no dietary flags under selected Halal. Production legacy branch is registered; applicability depends on v2 environment flag.
- **Recommendation/owner:** search engineer: remove fallback-to-all for explicit constraints; match canonical flags and show a truthful zero state with clear-filter action.
- **Close with:** behavior tests for zero halal matches, non-halal text, no active filter, query present/absent; device verification that the active chip never contradicts returned data.

### DS-03 — P2 — Profile constraints and cuisine chips diverge across search entry points

- **Class:** confirmed request/filter mapping defects. **Where:** `src/app/screens/search/SearchResultsScreen.tsx:270`, `:651`, `:680`, `:1275`; `src/app/screens/discover/QuickBitesScreen.tsx:393`; `src/store/useSearchStore.ts:51`.
- **Trigger/consequence:** raw-v2 search only sends Halal when that chip is selected and otherwise sends `[]`; it does not read profile needs, taste, or budget, and text search removes the radius. Legacy normal search reads store dietary flags initialized empty, while only the query-scoped browse path explicitly reads profile dietary preferences. Unqueried legacy browse bypasses them. SearchHome offers five categories, but raw-v2 only carries noodles/rice, and combines category with the single filter selection. Quick Bites “Halal/Japanese/Western” searches dish name/caption strings rather than canonical dietary/cuisine fields. A dish can be mislabeled by text or incorrectly disappear.
- **Evidence:** executed `rawCatalogRequest`: text “laksa” + All produced `dietaryFlags: []` and `radiusMeters: undefined`; traced store/provider mappings. Nationwide search can be a valid product choice, but there is no displayed radius-mode explanation.
- **Recommendation/owner:** product + search/backend: define persistent hard needs versus session taste/cuisine preferences, merge them consistently, carry typed cuisine metadata, make nationwide expansion explicit. If a backend does not support a visible control, hide it or explain the limitation.
- **Close with:** same user/query/constraints across Discover → SearchHome → results → See All in both provider branches; verify categories, diet, budget and radius request/response contracts independently.

### DS-04 — P2 — Taste sliders do not change successful Supabase search ranking

- **Class:** confirmed integration defect; core differentiator. **Where:** `src/app/screens/search/TasteFilterScreen.tsx:46`; `src/lib/services/supabase/supabaseRepository.ts:832`; `src/features/search/search.ts:39`; `supabase/migrations/20260621114541_search_dishes_restore_fast_guarded.sql:292`.
- **Trigger/consequence:** adjust spicy/rich, apply, successful Supabase search returns the same ranking: the RPC accepts no taste-vector argument; `filters.tasteValues` is omitted. SQL ranks text/rating/distance. The async adapter discards score, and `best_match` sort returns a clone without taste re-ranking. Raw-v2 requests also contain no taste fields. This differs from mock/local repository behavior, which does use tasteValues.
- **Recommendation/owner:** recommendations/backend + search: implement server-side taste scoring over bounded eligible candidates, or explicitly label taste adjustment unavailable for that catalog. Do not merely re-rank 20 arbitrary results and imply full-catalog personalization.
- **Close with:** fixed dietary/location candidate set, opposite extreme taste vectors, demonstrated rank changes plus relevance quality cases; confirm actual deployed RPC version. Source tests passing does not close it.

### DS-05 — P2 — Decide relies on a partial synchronous cache and stored distances

- **Class:** confirmed source architecture defect; cold/partial-cache consequence requires runtime acceptance. **Where:** `src/app/screens/discover/DecideForMeResultScreen.tsx:134`, `:256`; `src/app/screens/discover/DiscoverHomeScreen.tsx:2001`; `src/lib/services/supabase/supabaseRepository.ts:749`, `:1080`, `:1112`.
- **Trigger/consequence:** direct/cold entry or changed location: `getCandidates` calls synchronous `repository.searchDishes` with no latitude/longitude. Supabase `ensureHydrated` starts background hydration and immediately returns cached arrays; there is no completion subscription in the candidates memo. Empty partial cache can appear as “No match found,” and expanding radius operates on stored `distanceMeters` rather than the current coordinate. Nearby server feed does not fix this result path.
- **Recommendation/owner:** recommendations/search: use awaited location-scoped recommendation service with loading/error/empty states, valid candidate IDs and request cancellation. Key cached slates by relevant preferences and location; revalidate cached candidates before display. Preserve useful explicit radius expansion and alternative picks.
- **Close with:** cold direct entry, empty cache → populated RPC, movement across areas, profile change, stale slate, no match versus failure, all radius steps, valid address/directions.

### DS-06 — P2 — Discovery labels assert evidence the selection logic does not possess

- **Class:** confirmed source-supported product/data-integrity critique. **Where:** `src/app/screens/discover/DiscoverHomeScreen.tsx:245`, `:1775`, `:1783`, `:2725`; `src/features/discover/bites.ts:217`, `:354`; `src/app/screens/discover/QuickBitesScreen.tsx:228`; `src/app/screens/discover/CraveScreen.tsx:156`.
- **Trigger/consequence:** browse normal rails: “<15 MIN” is applied to all quickBites with no prep/queue/duration input. “Editor's Choice” means rating >=4.4, falling back to trending; MUST ORDER overlay does not check an editorial/mustOrder field. “Trending” is cumulative review counts or score-derived `cravingCount`, without a trend window. Quick Bites shows that count beside a heart, implying a different event. Late Night admits dinner flags or dish-name substrings (satay/laksa/mala), without verified late opening hours. Crave says the profile gets sharper although pass records nothing and save only toggles a favourite.
- **Recommendation/owner:** product/content + data: rename rails to truthful rules (e.g. highly rated), separate review/like/save counts, require real duration/editorial/trend/opening provenance before stronger claims, and describe Crave as saving dishes unless real learning is wired.
- **Close with:** provenance-backed fixtures for each label and click-through match; inspect closed/unknown-hours stalls at 23:00 and low-review items. No inference of regulatory noncompliance is made here.

### DS-07 — P2 — Failed cycling images can display one dish and open another

- **Class:** confirmed cross-component identity defect. **Where:** `src/components/discover/CyclingGridImage.tsx:47`, `:59`; `src/app/screens/discover/QuickBitesScreen.tsx:159`; `src/app/screens/search/SearchResultsScreen.tsx:140`.
- **Trigger/consequence:** images A/B, image A fails. Child removes failed A from `safeImages` and reports compacted numeric indices; parent still indexes original frames/slides. Displayed B is at child index zero while caption/press/prefetch target remains original A. Auto-cycling across venues increases the impact. Even without failures, four-second changes during touch can change the selected item between press-in and press.
- **Evidence:** isolated current-source safeImages initializer gave `[B]` after A failed; parent source retains original `frames[0]`/`slides[0]`. This is not a rendered gesture test.
- **Recommendation/owner:** shared discovery UI: carry stable frame/item identity through filtering, report selected frame ID, freeze active identity during touch/focus, and preferably keep each grid tile tied to one dish/venue. Deduplicate Quick Bites cross-stall/fallback arrays (isolated helper output for two items was A,B,B).
- **Close with:** fail first/middle/all images, blank URL, duplicate URLs, delayed network image errors, cycling during press, data refresh; assert image/caption/accessibility label/route always agree.

### DS-08 — P2 — Older Quick Bites requests can overwrite newer needs/location

- **Class:** confirmed async lifecycle defect. **Where:** `src/app/screens/discover/QuickBitesScreen.tsx:354`.
- **Trigger/consequence:** slow request A, then change location/diet/profile/collection, request B finishes first, A later calls `setBites`. The effect has neither active guard nor request version; old content replaces the correct new result. Especially consequential when dietary preferences change.
- **Recommendation/owner:** discovery engineer: cancel or version requests; associate loading/error/data with the request key and retain only validated same-request cached content.
- **Close with:** deliberately inverted completion order for location, collection and diet changes, plus unmount while loading. Contrast: DiscoverHome's location request and DishSearch inline suggestions already have active guards; keep those.

### DS-09 — P2 — Several screens turn request failure/loading into false empty or silent stale data

- **Class:** confirmed source state-model defect. **Where:** `src/app/screens/discover/QuickBitesScreen.tsx:378`, `:573`; `src/app/screens/search/SearchResultsScreen.tsx:1292`, `:1314`, `:1399`; `src/app/screens/search/DishSearchScreen.tsx:84`.
- **Trigger/consequence:** Quick Bites live search rejects → `[]` and “No … nearby,” with no retry; first load can expose repository fallback before live eligibility is known. Legacy results set null while fetching or failing and immediately fall back to synchronous cache, without passing `isLoading` to a component that supports it. Inline suggestion failures silently remove suggestions. Users cannot distinguish no food from no connection, and cached results are not marked stale.
- **Recommendation/owner:** discovery/search UX + engineer: explicit loading/empty/error/offline/cached states, bounded retry, preserve query/filters, avoid asserting zero results on failure. Keep DiscoverHome's explicit retry and raw catalog first-page error handling.
- **Close with:** delayed response, timeout, offline/reconnect, auth expiry, zero valid results, retry success, same-query stale cache. Check accessibility announcements and skeleton timing.

### DS-10 — P2 — Raw-catalog pagination failures are invisible with existing items

- **Class:** confirmed source defect. **Where:** `src/app/screens/search/SearchResultsScreen.tsx:434`, `:537`, `:551`.
- **Trigger/consequence:** page one succeeds, page two fails: error is only rendered in `ListEmptyComponent`, while existing items prevent it from rendering; footer only handles loading. The list looks complete, cursor remains, and scrolling may silently repeat requests. New query/filter also leaves old items visible while loading; release ID is cleared before old tiles disappear.
- **Recommendation/owner:** catalog UI: append-error footer with Retry and end-of-results state; clear or explicitly mark old-query tiles during replacement; keep each rendered item paired with its originating release until replaced.
- **Close with:** page-two transport/auth/release error, retry without duplication, query/filter during pagination, changed release, one-item last page. Good existing behavior: request-version guard and release pinning for successful append.

### DS-11 — P2 — Discover filters only the first six candidates and can falsely show zero

- **Class:** confirmed source ordering defect. **Where:** `src/app/screens/discover/DiscoverHomeScreen.tsx:1775`, `:1803`, `:1814`.
- **Trigger/consequence:** seventh dish meets Halal/Spicy/Value but first six do not. Each rail slices before `filterDiscoverBites`, so “No matching results” appears although eligible dishes exist in the collection. The same selected chips are not passed to See All; page-level constraints are lost on navigation.
- **Recommendation/owner:** discovery engineer: filter full eligible collection before presentation limits; pass current constraints to collection routes and show shared state. Use backend filtering when the collection is paginated.
- **Close with:** only candidate 7 matching, multi-chip combination, no matches globally, See All consistency, raw-v2/provider parity.

### DS-12 — P2 — Accessible control identity and motion behavior need explicit implementation

- **Class:** confirmed missing semantics in source; impact on device remains unverified. **Where:** `src/app/screens/search/TasteFilterScreen.tsx:38`; `src/app/screens/discover/CraveScreen.tsx:180`, `:363`, `:389`; `src/app/screens/discover/DecideForMeResultScreen.tsx:497`; `src/app/screens/discover/QuickBitesScreen.tsx:173`; `src/components/discover/CyclingGridImage.tsx:112`.
- **Trigger/consequence:** six native sliders lack per-axis accessibilityLabel/value semantics (nearby text is not an explicit label association); Crave icon-only back/pass/save and Decide back lack button role/name; Quick Bites primary grid card lacks role/meaningful label. Automatic multi-venue cycling has no pause/reduced-motion/screen-reader preference handling. Most primary Discover and legacy browse buttons do have useful labels; preserve them.
- **Recommendation/owner:** accessibility + shared UI: axis-specific adjustable names/values, named actions and selected/disabled states, deterministic focus/press identity, reduced-motion behavior and explicit pause/static imagery. Audit small text actions and raw back target size; do not declare contrast failures from code alone.
- **Close with:** VoiceOver/TalkBack navigation and slider changes, Switch Control/keyboard where supported, 200% text, reduced motion, touch-target measurement, dark/light image overlays. No claim of full WCAG/store certification.

### DS-13 — P2 — Crave's permanent PanResponder retains the first dish/auth snapshot

- **Class:** confirmed closure defect, **gated beta only**. **Where:** `src/app/screens/discover/CraveScreen.tsx:55`, `:64`, `:78`, `:92`.
- **Trigger/consequence:** PanResponder is stored in `useRef(...).current`; handlers retain first-render `swipeRight`, whose closure retains first currentDish and auth state. After card index advances, gesture save can toggle the first dish repeatedly instead of the visible dish; sign-in changes do not update the gesture's auth decision. Button onPress receives fresh handlers, so button and swipe behaviors diverge.
- **Recommendation/owner:** gesture/UI engineer: stable gesture handlers reading current refs or safely recreated dependencies; use idempotent save rather than toggle for a positive swipe, lock advancement during animation, add undo. Keep route gated until verified.
- **Close with:** three sequential gesture saves target three displayed IDs, sign-in while mounted, pass then save, rapid actions, existing favourite, animation interruption. Production gating verified from `featureFlags.ts` and route registration.

### DS-14 — P2 — SearchHome can show a blank query while submitting an old stored query

- **Class:** confirmed state divergence; associated suggestion copy is unsupported. **Where:** `src/app/screens/search/DishSearchScreen.tsx:56`, `:144`, `:223`, `:272`; `src/app/screens/discover/QuickBitesScreen.tsx:312`.
- **Trigger/consequence:** SearchHome always initializes local `searchText` empty but reads store filters; Quick Bites writes a query then navigates there. Reopen SearchHome or arrive from that launcher: input/CTA appear empty, yet “View search results” submits the previous stored query. No recent-search chips expose the persisted last five terms despite SEARCH_SPEC. Recommendation card says best within 2km but `getDiscoverStallCollections` ranks proximity softly with no 2km cutoff; v2 deliberately supplies no suggestions but still renders a disabled “Craving something special?” card.
- **Recommendation/owner:** search UX/engineer: one intentional query owner, restore or clear consistently at entry, submit the visible query, show manageable recent history; hide unavailable suggestion block and derive proximity claims from real constraints.
- **Close with:** previous search → back → reopen; Quick Bites launcher → SearchHome; empty-query action; query clear; v2 landing; >2km only candidate.

### DS-15 — P2 — “Apply filters” does not define a commit boundary

- **Class:** confirmed interaction/state inconsistency. **Where:** `src/app/screens/search/TasteFilterScreen.tsx:46`, `:75`; `src/store/useSearchStore.ts:93`.
- **Trigger/consequence:** slider movement immediately updates/persists global search state and emits `taste_filter_applied` for each movement. Back navigation leaves these edits applied even without Apply; result loads/analytics may fire repeatedly. The design promised real-time match count and dimension-specific legends, but only generic LOW/HIGH and a static Apply label are present.
- **Recommendation/owner:** product + search: either use a local draft committed on Apply with discard/back rules, or explicitly present a live filter screen and rename the exit action. Announce meaningful axis endpoints and show a debounced real count only when supported.
- **Close with:** slider then back versus apply versus reset; restart persistence; event count; supported live count and no full-network request on every slider tick.

### DS-16 — P2 — Installed Discover's offline banner obscures location context

- **Class:** observed installed-artifact UX defect; **current-source reproduction unverified**. **Where:** `docs/audit/page-review-2026-10-20/runtime/installed-discover.png`; underlying page heading at `src/app/screens/discover/DiscoverHomeScreen.tsx:2239` is the source reference, not a proven cause.
- **Trigger/consequence:** captured offline screen shows a large dark offline Retry banner over “YOU ARE AT” and the location name. The numeric area count survives below it, making the current location harder to verify when offline.
- **Recommendation/owner:** app shell/offline banner + discovery UI: reserve layout space or use a non-overlapping banner area with safe-area handling.
- **Close with:** reproduce on exact current-source native artifact, narrow/large-text screen, offline/reconnect, all tabs; validate header is readable and Retry tappable. The screenshot's lower image placeholders alone do not prove broken image loading.

## State, backend and test assessment

| State/edge | What source establishes | Remaining proof |
|---|---|---|
| Initial/slow load | Discover location request has active guard; suggestions have debounce/active cleanup; raw catalog has version guard. | Actual spinner/skeleton timing and first meaningful content latency. |
| Empty versus failure | Discover explicit error/retry; raw first page error/retry. Quick/legacy conflate states (DS-09). | Device offline/retry/no-result matrix. |
| Dietary combinations and unknown metadata | Source reproductions confirm DS-01/02; profile mappings diverge DS-03. | Canonical dietary provenance, live RPC all-flags behavior. |
| Radius/current/manual/denied location | Manual selection updates current coordinate in store; Discover uses manualCoordinate first. Decide result does not send coordinates. Discover auto-requests permission when not granted/no manual label. | Denied/revoked permission UX, stale fix, physical movement, cross-area results; no assertion that manual picks inherently use wrong coordinates. |
| Category/taste/budget | Integer taste sliders and soft-budget fallback are present; latter is an intentional preference rather than a hard cap. | Explain budget fallback, no zero/unknown-price false bargain, taste RPC parity. |
| Auth/session | Saving Decide gates sign-in and return route; raw service verifies session before RPC. | Expired session, account switch, cache clearing, return context. No unauthorized read/write or RLS bypass proven by this audit. |
| Paging and release | Raw release pinning and request versions exist; append-error UX incomplete. | Live exact-release paging, cursor tampering, RLS grants and no duplicates. |
| Image failure and identity | Discovery rail has explicit placeholder; cycling index mapping breaks after filtering failures. | Device failure/rotation/touch timing. |
| Motion/focus/large text | Multiple hardcoded animated heights/scales, nested scroll locks, dynamic item identity. | VoiceOver/TalkBack, focus traversal, reduced-motion and smallest-screen text layouts. |
| Share/save/directions | Trusted Maps URL helper and system share path; no fake cart. | Real unavailable Maps/share failure, missing venue, saved-state rollback/server sync. |
| Security/privacy/abuse | No raw credentials found/read; UI reads through provider. RPC calls and catalog service are bounded interfaces, but synchronous fallback hydrates several whole tables; no awaited subscription. | Hosted RLS, deployment schema parity, location/search telemetry consent, performance/account isolation and request rate limiting require separate evidence. |

Focused verification run (exit **0**, **17/17 passed**, zero failed):

```sh
HUNGRY_DATA_SOURCE=mock HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/features/discover/bites.test.ts src/features/search/searchSort.test.ts src/features/search/browseIndex.test.ts src/app/screens/decide-for-me-phase1-contracts.test.ts src/app/screens/search/browse-grid-contracts.test.ts
```

The process emitted Node `[DEP0205] module.register()` deprecation warnings; these are test-tooling warnings, not app crashes. Tests cover image URL choice/collections, sort modes, food tag matching and source contracts. Browse/Decide contracts mostly regex source and do not prove native gesture, async ordering, dietary safety, deployed SQL or source/binary equivalence.

Additional read-only inline `node` AST harness used TypeScript's parser/transpiler to extract actual current function/initializer text and execute it with pure dependency stubs; five assertions passed: DS-01 any-match, DS-02 zero-match restore, DS-03 raw request omission/radius expansion, DS-07 filtered-image index, and duplicate cross-stall slides. This is isolated source logic evidence, not React/native execution. An initial harness attempt mistakenly invoked a stubbed callback and failed with `TypeError: match is not a function`; the harness stub was corrected and all five assertions then passed. Two read queries had shell/no-match exit statuses (incorrect routeAccess glob and no reduced-motion matches); no app mutation or app failure resulted. No report claim hides these terminal diagnostics.

## Current first-party comparisons and honest product critique

Sources opened on 20 October 2026; claims concern their documented patterns, not hands-on app testing. I did not compare aesthetics against screenshots of apps I have not inspected.

| Comparator and official evidence | Outcome/pattern to learn from | Hungry keep/change and tradeoff |
|---|---|---|
| [Google Maps nearby search help](https://support.google.com/maps/answer/4610185/) documents nearby search around a chosen place, ratings/hours, and ranking using relevance/distance/prominence. | Make location and ranking rationale legible; “nearby” should be an inspectable context. | Keep Singapore dish-level entry and taste explanation; add a clear location/radius state, reliable hours and deliberate relevance/nearby choice. Production Discover hides its map entry for ordinary users despite design A recommending one. Restoring optional map access adds complexity but helps verify proximity. |
| [Burpple About](https://burpple.com/about-us) describes distinct community reviews, editorial content and trending data in discovery. Historical marketing metrics on that page were not treated as current facts. | Clearly distinguish recommendation evidence types. | Keep affordable local dish cards and local names; rename or substantiate Editor's Choice/Trending/Must Order. Taste explanations could differentiate Hungry, but placeholder explanations and proxies weaken trust more than a smaller truthful catalog. |
| [Grab's official Discover explainer](https://merchant.grab.com/en-sg/blog/grab-discover-page) documents food photos/reviews, engagement, restaurant discovery and actions from a post. | Connect inspiration to a stable food/venue context and next action. | Keep Directions/Save/Share and the explicit absence of an ordering fiction. Repeated multi-venue auto-cycling tiles make comparison harder than stable cards. Avoid claiming Hungry alone provides food inspiration or dish search; the current competitive baseline is broader. Do not copy Grab's ride/reservation/payment scope into this release. |

A direct fetch of the GrabFood Singapore landing returned 403; its search-result snippet was not used as hands-on or rendered product evidence. No paid services used.

**Honest assessment:** the conceptual local-food proposition is strong, and the installed Discover screenshot has recognizable hierarchy and useful primary actions. The implementation currently emphasizes abundant movement and many rails while the trustworthy decision inputs—dietary eligibility, freshness of nearby data, real hours, actual matching—remain inconsistent. I would keep the warm visual language, dish-first entry, Singapore units/SGD, clear save/directions actions, integer taste model and explicit radius recovery. I would reduce competing rails, duplicate cards and automatic cross-stall identity changes until every shown constraint and claim is dependable. A stable shortlist of three verified nearby dishes would serve “what should I eat now?” better than a larger unverified feed. That is a product judgment, not a measured conversion result.

Structured design review: information hierarchy **promising but crowded**; task completion **blocked by inconsistent constraint/state behavior**; semantics/trust **needs remediation**; accessible interaction **incomplete source semantics, runtime pending**; visual fidelity **only partial installed Discover evidence**. Full-page ratings or certification would overstate this evidence.

## Prioritized owner actions and release implications

1. **Search + backend:** fix DS-01/02; unify canonical dietary rules across UI and every successful/fallback RPC; add combination/zero-match behavior tests before release sign-off.
2. **Recommendations + discovery:** fix DS-04/05/08; await location-scoped data, honor taste consistently and reject stale request/candidate state.
3. **Shared UI + search:** fix DS-07/09/10/11; stable identity, truthful loading/error/paging, filter before truncate, preserve constraints into See All.
4. **Product/content + data:** resolve DS-03/06/14/15; define search/filter ownership and truthful editorial/time/trend labels. Replace unsupported claims with simpler accurate labels now.
5. **Accessibility + shell:** close DS-12 and reproduce/fix DS-16 on exact current-source native binary; then run focused iOS/Android acceptance. Native performance and real provider smoke remain required proof.
6. **Beta gesture owner:** keep Crave gated; fix DS-13 and its no-op learning promise before expanding reachability.

No risk was waived by this reviewer. A current-source terminal pass does not replace native, hosted API/RLS, deployment, policy or exact-artifact evidence. Independent cross-review and final QA/QC belong to the parent and remain required before audit completion.
