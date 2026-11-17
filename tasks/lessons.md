# Lessons

- In Firecrawl local self-hosted Docker instances, the open-source Playwright service container handles browser crawling and client-side JS rendering, but proprietary cloud features like browser `actions` return `SCRAPE_ACTIONS_NOT_SUPPORTED` without the proprietary `fire-engine`. For single-page web applications (SPAs) requiring client-side hydration, pass the native `"waitFor": <ms>` scrape parameter (e.g. `"waitFor": 5000`) instead of `actions: [{"type": "wait", ...}]`.

- In PostgreSQL, an `UPDATE target_table v ... FROM ... LEFT JOIN other_table s ON s.col = v.col` is rejected with `ERROR: invalid reference to FROM-clause entry for table "v"`, because the target table cannot be referenced in an `ON` clause within the `FROM` list. To update a table from multiple joined CTE aggregates without invalid outer-join references to the target table, materialize the target entity keys into an initial CTE (`target_venues`), join the secondary CTEs to that key CTE in a `merged_updates` CTE, and perform the final update via `UPDATE target_table v SET ... FROM merged_updates mu WHERE v.id = mu.id`.

- In openpyxl, calling `ws.cell(row=r, column=c, value=None)` ignores `value=None` due to the method's parameter guard (`if value is not None:`). To clear a cell or set its value to `None`, access the cell object directly and assign `cell.value = None`. Never overwrite large Excel workbooks in-place with `wb.save(path)` on the same path being read; always save to a temporary file (`*_tmp.xlsx`), verify ZIP integrity via `zipfile.ZipFile.testzip() == None`, and atomically replace (`os.replace`) to prevent XML stream truncation or CRC-32 errors.

- Never present diagnostic hypotheses, structural grouping patterns, or plausible causes (e.g., brand catalogue availability, SFA renewal suffix increments, postal digit typos, or central kitchen linkages) as verified resolutions until confirmed row-by-row against authoritative, dated outlet evidence. Distinguish clearly between structural/syntactic validity (ZIP CRC, schema, host-URL parity) and factual semantic accuracy (live operation, current branch identity, item availability, in-store pricing). When standardizing semi-structured text fields (such as dual-delivery labels), audit for secondary attributes (e.g. `Min order: SGD 16.00`) to prevent unintentional information loss.

- When queue and audit-resolution summaries disagree on cohort totals, reconcile the row-level evidence and current stable IDs before carrying a count forward; update all canonical summaries together and keep cohort memberships separate from the number of evidence-backed matches.

- In food database and menu ingestion pipelines:
  1. Never emit synthetic or placeholder stall names (e.g. 'Authentic Local Kitchen') or boilerplate dish sets when enrichment data is absent; unverified fields must strictly remain blank (`""`).
  2. Price summaries in directory workbooks must be deterministically recalculated from the child menu catalogue (actual min/max prices of itemized dishes), not left as stale or decoupled estimates.
  3. Enforce strict dietary hierarchy and mutually exclusive rules: `Vegan == Yes => Vegetarian = Yes`, `Halal == Yes => Pork-free = Yes`, and dishes containing dairy/pork must never be tagged with conflicting dietary flags.
  4. Singapore postal codes must be strictly formatted with 6 digits using zero-padding (`str.zfill(6)`), as numeric representations drop leading zeros.
  5. Ingestion drivers must enforce exact tuple-deduplication before appending records to prevent duplicate dish rows.


- In Python `xlsxwriter`, writing workbooks with >65,530 URL strings triggers an Excel worksheet hyperlink limit warning and can cause memory explosion or truncation. Always initialize `xlsxwriter.Workbook(path, {'constant_memory': True, 'strings_to_urls': False})` when writing large tabular catalogues with URLs.
- In menu extraction pipelines, promotional/discounted prices must strictly never fall back to fill base price columns when `originalPrice` is missing. Missing base prices must remain blank (`""`) with an explicit review flag (e.g. `missing_base_has_promo`) to prevent contaminating base pricing data with temporary promotions.
- In menu parsing and ingestion, free modifiers, loyalty rewards (e.g. "Earn points"), or unpriced options often present with `$0.00` in raw schemas. To strictly enforce the zero synthetic placeholder rule without discarding valid dishes, sanitize all prices with a clean_price validator that maps `<= 0.0` or non-numeric values to blank (`""`).
- Figma is the visual source of truth for any screen that already exists there; do not preserve an older in-app layout when it conflicts with the approved design.
- Do not leave guest browsing branches in the runtime once product direction changes to auth-first; remove them from the session model, soft-gate copy, and debug presets together.
- Avoid colored pills and emoji-driven UI copy in Hungry. Use warm neutral surfaces, restrained semantic color, and icon/text hierarchy instead.
- When auth becomes mandatory, delete or fully retire the old soft-gate surface instead of leaving an unused auth sheet in the runtime path.
- Do not silently fall back to arbitrary mock entities on compose flows. If the selected record is missing, stop the flow and send the user back to a safe picker state.
- When discovery data comes from both Singapore geo datasets and older mock fixtures, bridge building IDs at the repository boundary instead of letting map, floor-plan, and venue flows each guess their own alias mapping.
- Mall drill-down UX cannot be list-first if the requirement is store-directory realism; use polygon-first floor maps with synced selection state and a vertical floor selector.
- For map+sheet composition, keep the map canvas as the constant background and use a real draggable bottom sheet; static overlays that only look like sheets fail UX expectations immediately.
- For mall drill-down realism, never freehand synthetic grids: anchor polygons to official mall floor-map assets, preserve real unit numbers, and keep list-map IDs one-to-one.
- For directory maps, rely on computed fit-to-viewport base scale plus explicit zoom controls; fixed hardcoded scale values break cross-mall standardization and make alignment QA unreliable.
- For mixed single-tap and double-tap UX in feed cards, use exclusive gesture recognizers on the text region so like and expand actions never fire together.
- For repeated form flows (auth/reset), centralize validation rules in shared helpers and test those helpers directly so every screen stays consistent when requirements change.
- When product direction removes a UX pattern (for example soft-gate browsing), remove both runtime code and stale harness docs in the same batch to avoid backlog drift.
- If a screen needs true edge-to-edge media, avoid wrapping it in shared max-width containers; use a full-width shell and then apply horizontal padding only to non-hero content blocks.
- For swipe-driven UI cues (carousel dots, selected-state visuals), bind visuals to live scroll position rather than `onMomentumScrollEnd` so feedback stays continuous during gesture.
- When syncing local derived selection back into Zustand, guard updates by stable IDs; unconditional `set()` inside effects can create render/update loops even when values look unchanged.
- Do not reapply default mock profile data on app bootstrap when persisted profile state exists; only run profile sync when auth state actually changes.
- For optional native modules in Expo Dev Client, avoid hard imports in leaf UI components that can crash the app on stale binaries; use lazy module loading with graceful fallback messaging until the app is rebuilt.
- When a design artifact exists, implementation must start from that file and end with a design-source check; code-first improvisation causes drift.
- Loading feedback must follow wait-time rules: skeletons only for known-shape waits over 300ms and must reserve the exact space of the final button/card/row/component, spinners for brief unknown waits under 300ms, no indicator for sub-300ms updates, progress bars for measurable uploads over 3 seconds, and optimistic UI only for 99% reliable actions with rollback.
- Never read theme tokens (`spacing`, `radii`, `palette`) at module scope inside `StyleSheet.create()`. Always access them inside the component body via `useHungryTheme()` — module-scope access runs before the theme provider mounts and causes TypeScript errors.
- All data access in `src/app/` and `src/features/` must go through `getDataRepository()` or `getHungryService()` from `serviceProvider.ts`. Never import from `src/lib/services/mock/` directly in screen or feature files — doing so silently breaks the mock-to-Supabase swap path.
- Any persisted Zustand state keyed by user identity (reviewEntries, favourites, tasteVector) must be cleared in `clearProfile()`. `clearProfile()` must always be called from `signOut()`, not `syncProfile(false)` alone.
- No backlog item is done without evidence, but evidence should match risk: small iterative changes can use a focused check or explicit skip note, while broad/risky/release changes need stronger gates such as typecheck, tests, or simulator smoke.
- On retry requests after partial work, re-validate the workspace state and run hard verification gates (`typecheck` + tests) before reporting completion.
- Do not create sibling planning documents (war-room reports, audit reports, sprint plans) alongside `tasks/todo.md` — always fold into `tasks/todo.md` as a dated section. Two sources of truth drift. The master task list is the single source.
- Before authoring a sprint audit, verify the sprint checklist against the code. Reconstructing a sprint's scope from a compacted conversation summary is unreliable — the real checklist lives in main's `tasks/todo.md`. Read that first.
- When consolidating multiple roadmap drafts, keep source files on disk as an audit trail and introduce a single `roadmap.md` entry point — do not delete historical docs. Consolidation is about a single READ-FIRST surface, not erasing the paper trail.
- Two-sided marketplace gating: do not ship the supply side before consumer demand exists. Prime supply passively (OCR on consumer photos, "Claim this stall" waitlist CTA) during consumer-only V1; launch the merchant portal to a warm waitlist, not a cold start.
- Singapore merchant verification tiering matters: UEN holders get SingPass Myinfo Business (instant, 0 ops touch); hawker stalls get NEA licence lookup + video walkaround; never force postcard as primary — it's a US pattern that performs poorly in SG hawker context (shared addresses, operator-not-at-mailing-address).
- Developer launcher merchant shortcuts must seed merchant state before navigation; do not route directly into MerchantTabs from dev mode or the merchant sign-in gate will appear.
- If a dev shortcut depends on persisted merchant state, add an explicit dev-only bypass flag instead of relying on account hydration timing or service sync order.
- When a runtime red screen persists after a Metro transformer/config fix, inspect the live bundle URL before changing code again. If the live bundle still shows old output, kill stale Metro/Expo processes and restart with a cleared cache before judging the patch.
- For full-screen story/media viewers, never let the gesture responder claim every touch on start; keep header/footer controls above the navigation layer and use bounded tap zones plus swipe-only responder capture.
- When adding double-tap media actions, delay the single-tap navigation until the double-tap window closes; otherwise the first tap navigates away before the like gesture can complete.
- Persist story viewed state independently from the loaded story payload; service reloads can otherwise restore `hasUnseen` and turn grey viewed rings orange again.
- Promote repeated top-of-screen custom title rows into the shared header component before tweaking individual font sizes; otherwise Discover, Review, and Composer headers drift again.
- Do not wrap `ZoomableMedia` in another `Pressable` for feed image taps; pass `onPress` into `ZoomableMedia` so its inner responder owns the tap path.
- Do not standardize separate V1/V2 screen variants into the same layout when product direction intentionally keeps them distinct; preserve the variant contract in tests.
- When a V1/V2 screen still appears unchanged after editing the component, inspect the navigation mount point before making more layout changes.
- Page-level side padding must use `semanticSpacing.screenEdge`; keep smaller `spacing[3]` horizontal padding for internal controls only, not screen containers.
- For tap-origin animations, thread the native press event coordinates through the component boundary; do not infer the origin from the media container center.
- Feed reaction animations should separate acknowledgement from destination travel: show a brief upward bounce near the user's tap before moving the icon toward the persistent action target.
- Activity/notification rows must carry a concrete target id and route to that target; type labels alone are not enough for an interactive inbox.
- Do not assign single-tap navigation to Home feed media when double-tap liking is the primary gesture; single tap should stay inert unless product explicitly asks for a detail route.
- Modal composer exits should reset to a known app route after draft state is cleared; do not replay stored back actions when the underlying tab/navigation stack can change while the composer is open.
- Feed comment creation must update the same social interaction store used by the visible counter; local-only sheet state makes the comment appear while leaving the Home feed metric stale.
- Small iterative app changes should not trigger full QA/QC, `npm run ios`, the full test suite, or default `npm run typecheck`; choose the smallest useful check and reserve broad gates for broad/risky/release changes.
- Plant-based or vegetarian restaurant chains like Greendot that do not hold an official MUIS certificate must be marked `Halal Certified: No` while setting `Vegan: Yes`. Absence of meat, pork, or lard does not constitute official MUIS Halal certification.
- When processing Google Places identifiers from legacy Excel sheets, beware of truncated 64-bit CIDs (due to 53-bit float limitations in spreadsheets) and synthetic place IDs ending in placeholder strings like `googleplaceid`. Direct place queries via official `ChIJ...` IDs or name + address Google Maps search (`maps.google.com/search?q=...`) reliably surface authentic Google business cards and schedules.
- When comparing tab headers, use simulator screenshots from the same rebuilt bundle before adding offsets; do not add a second safe-area inset to a list header already inside `SafeAreaView`.
- Do not add skeletons for visual reassurance alone. Skeletons must be tied to a real pending/loading condition and the documented known-shape wait threshold; local synchronous filters should render updated content or contextual empty states.
- For bottom-sheet controls that must remain visible while the list scrolls, verify with a simulator screenshot; absolute children inside scroll content can sit below the visible viewport instead of behaving like a floating overlay.
- For Expo Web E2E, set both private and `EXPO_PUBLIC_` mock data-source flags in the Playwright web server; bundled web code cannot read private env vars, and tests should prove the rendered read path rather than only the composer success state.
- Contract tests should not depend on Prettier-only formatting details such as trailing commas in collapsed arrays; assert the behavioral source dependency instead.
- Press-intent handlers (`onPressIn`) must never synchronously resolve repositories, build large result sets, or preload heavy routes; schedule those prefetch/analytics/search-history tasks as deduped idle work so the actual `onPress` navigation can commit immediately.
- Pull-to-refresh on an already loaded feed should use the native refresh indicator and preserve visible ready content; do not switch the whole feed back to a skeleton during manual refresh.
- On dense Discover surfaces, keep major section gaps tighter than the global section token when many horizontal rails stack on one screen; use one named content-gap constant so heading-to-card spacing stays consistent.
- For app-wide corner-radius requests, add a semantic theme contract first (`componentRadii`) and migrate shared primitives before individual screens; leave true circles explicit for avatars, logos, wheel graphics, progress dots, and checkmark badges.
- After app-wide UI sweeps, re-check dense first-viewport screens like Discover for spacing regressions; global section tokens can create excessive gaps when applied to stacked rails and paired action cards.
- When animating React Native UI with `requestAnimationFrame`, use the RAF timestamp as the cycle clock; mixing it with `Date.now()` can freeze derived animations at their first frame.
- Search placeholder motion should be step-based when product expects one letter at a time; elapsed-time interpolation can skip characters under JS load and make the text appear in chunks.
- When a worker edits the same contract surface, re-read the post-worker diff before continuing; normalize duplicate interfaces immediately so shared domain types do not diverge under parallel implementation.
- Badge or achievement visuals must have an explicit unlock source before rendering as earned; do not treat missing unlock metadata as a default pass.
- For web-v2 audience-card image feedback, pick images with the requested subject clearly visible in the card crop; a restaurant exterior or window-only shot is not a substitute for visible diners eating, and generic kitchen imagery is not a substitute for a Singapore hawker stall.
- For web-v2 hero mockups, keep the phone frame as the top local stacking layer across tablet breakpoints; food orbit images and proof chips should sit behind the phone when the composition narrows.
- For static web-v2 phone previews, fill the visible lower viewport with real preview content instead of leaving blank flex space; users read blank screen area as incorrect mockup sizing.
- Skip-safe smoke wrappers should be real executable scripts, not direct package aliases to networked CLIs. Run `node --check` before declaring the wrapper fixed, and avoid top-level `return` in ES modules.
- When extending a staging table to match a CSV, cover both newly added and pre-existing mapped columns in smoke/tests; otherwise the importer can silently depend on columns the new migration contract never verifies.
- Large Supabase CLI SQL imports can fail through the management API even when individual SQL statements are valid. Keep a chunked SQL generation/apply path in addition to one-file SQL and REST import paths, then smoke the remote import summary after chunked loads.
- When a Supabase advisor flags a security-definer view used for safe public display fields, replacing it with an RLS-enabled safe-column table can clear the advisor without widening raw profile-table access.
- Supabase Advisor cleanup should distinguish project-owned RPC grants from extension-owner grants. A revoke migration can apply cleanly but still emit `WARNING 01006` and leave Supabase-admin-granted PostGIS ACLs unchanged; always verify `proacl` and rerun Advisor before claiming a warning is resolved.
- In PL/pgSQL migration generators, do not reuse the outer `do $$` delimiter for inner string literals, and do not feed `pg_get_function_identity_arguments()` output to `to_regprocedure()` because named arguments are not valid regprocedure input; resolve function OIDs through `pg_proc` when you need replay-safe dynamic `ALTER FUNCTION`/grant SQL.
- Do not rerun mutating Supabase owner-action SQL from the project role when current metadata already proves the target extension objects are owned by `supabase_admin`; refresh Advisor/owner evidence and hand off the documented owner/support action instead.
- For stories, do not mark a rail item seen on tap or initial viewer mount. Gate seen-state writes behind the completed opening transition and current media readiness so the unseen ring cannot visibly turn grey before the full-screen story covers the Home rail.
- For story progress bars, do not rely on transform-origin scaling or mid-playback global store writes; use a left-anchored UI-thread width animation and commit seen state only on advance/close after the viewer is ready.
- In Supabase-backed mode, never use a synthetic non-UUID profile id for an authenticated session. If the real session UUID is not available yet, keep the app unauthenticated or use a temporary profile keyed by the real Supabase user id only.
- For verification/review-style flows, do not set a final submitted status before the required evidence write has succeeded or at least been attempted; prepare draft state first, then promote after evidence insertion.
- Keep merchant-only workflow/story sections on merchant-owned pages; the web-v2 homepage should stay focused on consumer-facing discovery unless the brief explicitly asks for merchant storytelling there.
- For same-axis nested React Native pagers, lock the parent scroll while the inner pager is touched and contract-cover any animated scroll reset when the filtered card set changes.
- When product asks for snap scrolling that still feels free, prefer `snapToInterval` without `pagingEnabled` or interval momentum locking, then tune the snap interval around the visible card row height.
- For scroll-coupled horizontal card motion, tie travel distance to the full rendered card width when product expects a complete swipe, not a small proportional nudge.
- For nested vertical Discover sections, keep the parent scroll unlocked at the inner section's top boundary so upward gestures can return to the main page instead of trapping the user in the nested list.
- For mock scroll-effect testing, expand the source data pool into distinct populated cards before cycling items; repeating a small source set makes the interaction feel under-tested even when the list length is technically longer.
- For full-page nested Discover sections, use the measured parent viewport height instead of subtracting a spacing token from screen height; otherwise the previous or next section can peek when the page settles.
- For nested scroll-driven image motion, start each row's interpolation when the row first enters the viewport, not only when it becomes fully visible; partially visible entering cards still need to animate.
- For full-page nested Discover sections, focus the parent ScrollView to the nested section's measured top before locking parent scroll; otherwise the inner list can scroll while the parent is still between sections.
- For full-page nested Discover sections, add a parent scroll-end snap on downward entry if a previous section can settle in the same viewport as the nested section; gesture-start focus alone does not fix rest positions.
- For full-page tab-screen sections, calculate page height against the visible area above the custom bottom tab bar, then floor row heights after subtracting gaps so stacked rows cannot accumulate fractional clipping.
- In dense 3x2 card grids, move compact metadata such as ratings into image overlays when possible; freeing the text area gives the row-height clamp more room to keep all rows visible.
- When a full-page card grid technically fits but feels visually short, check width-based max-height caps before adding padding; an overly conservative cap can prevent the rows from filling the reserved viewport.
- In dense 3x2 card grids above a custom tab bar, keep secondary metadata on the primary label line before raising card height; extra text rows accumulate quickly and can push the last row under the tab bar.
- Do not claim an accessibility audit complete from source contracts alone; runtime accessibility hierarchy or real assistive-tech smoke can still expose generic controls after tests are green.
- When remediating third-party modal/sheet accessibility, audit direct third-party component usages as well as the shared wrapper; otherwise raw `BottomSheetModal` call sites can bypass the wrapper's label/backdrop semantics.
- In runtime accessibility hierarchy checks, custom carousel cards and result cards can look readable while still being announced as static text or generic elements; make every tappable card explicitly expose role, label, hint, and selected/disabled state at the Pressable boundary.
- In PL/pgSQL event-recording RPCs that select into `record` variables across conditional branches, track explicit `*_loaded` booleans; reading fields from an unassigned record can turn a missing optional target into a runtime error instead of a no-op.
- For full-page tab-screen sections inside a top `SafeAreaView`, do not fall back to raw `screenHeight`; subtract the top inset or wait for measured layout, otherwise the nested section can be one safe-area height too tall and clip under the bottom tab bar.
- For merchant promotion validation, do not trust `Date` parsing or a `target_dish_id` foreign key by itself; validate date-only strings by calendar round-trip, require explicit timezones for datetimes, and enforce existing-menu-item targets against the outlet's linked venue/menu.
- For dense 3x2 Discover grids, treat text rows as part of the height budget. If the third row still clips, reduce secondary text rows and let the image take the remaining card height before increasing the card cap.
- Search placeholder animation must be controlled at the shared hook level, not only at individual input callers. Screen-reader and reduced-motion fallbacks need to apply to every consumer of `useMovingSearchPlaceholder`.
- Shared dialog fixes do not cover direct React Native `Modal` call sites. Audit raw modal usage separately for `accessibilityViewIsModal`, labelled dismiss controls, and a header.
- Generated onboarding food photos should be professional restaurant/menu-style assets, not homemade-looking phone shots; keep provenance and asset-audit coverage tied to the local onboarding image bucket before adding or replacing food options.
- Developer Launcher mock-auth presets must seed both the Zustand session/profile state and the mock service's private auth profile before running owner-scoped flows; otherwise newly created mock records can be owned by `guest-user` while the UI compares against `user-1`.
- Header-owned dropdowns need the shared header layer to be overflow-visible and stacked above scroll content; raising only the dropdown child can still leave body-level close scrims intercepting menu-row taps on React Native Web.
- Before applying a new Supabase migration, compare local migration versions against `supabase migration list --linked`; duplicate numeric versions such as a second `0043` can appear locally valid but collide with an already-applied remote migration.
- After applying a Supabase migration, run the smoke SQL before marking the phase complete; static grants can look correct in the migration but inherited/default privileges may still leave direct table writes open.
- Moving search placeholders should be explicit opt-in behavior. Discover is the approved animated search prompt surface; keep other search bars static unless product asks for motion there too.
- Explicit user sign-out should not reset first-run onboarding completion. Clear auth/session data, send completed-but-signed-out splash sessions to `AuthStack/Login`, then reset visible sign-out actions to the same root route so returning users do not see onboarding again.
- When a contribution form grows from one photo to multiple photos, update the domain/service/storage contract in the same pass; otherwise a polished carousel can silently collapse back to a single persisted image.
- When adding integration tables or service methods, update the UI read/write paths and source contracts in the same pass; otherwise the schema can look complete while production surfaces still use local-only state.
- In this repo, `npm run test -- <files>` still runs the package's full test discovery path; use direct `node --import tsx --test <files>` for focused source-contract proof.
- Cookie-authenticated web mutations should not rely on `SameSite` cookies alone; pair them with an explicit CSRF header and same-origin check, and guard login/session cookie issuance against cross-site or non-JSON requests before treating the surface as production-exposable.
- Source-contract regexes for navigation branches must be scoped to the exact branch block; broad `[\s\S]*` assertions can cross into unrelated auth/reset code and report false failures.
- Do not import service-local DTOs from `src/types/domain.ts` just because they look domain-shaped; check `src/lib/services/types.ts` first for feed/post service types such as `Bite`.
- When linked Supabase Advisor reports a SECURITY DEFINER RPC that does not exist in repo source or migrations, treat it as live database drift: record it as an external owner-approved cleanup blocker rather than adding a pretend source fix or applying production SQL without approval.
- A paged-catalog flag must guard every active entry point, including search landing recommendations and intent prefetchers; replacing only the visible Browse grid still permits a legacy full-catalog hydration before navigation.
- When Expo Web or Metro keeps prompting for an alternate port in this sandbox, verify local TCP bind with a minimal Node server before debugging routing; `EPERM listen` means the E2E/native smoke needs a port-capable environment, not another app patch.
- MVP production gates need both route registration and entry-point coverage. If an advanced surface is flag-disabled, lazy-gate the route/module and hide profile/detail/settings entry points; in Supabase mode, failed reads should show an honest empty state instead of silently falling back to fixture arrays.
- Signed-out onboarding profile setters must not call Supabase in production mode. Keep guest taste/dietary choices local until auth, then merge only meaningful guest choices into the signed-in profile so neutral defaults cannot overwrite real account data.
- When E2E needs to publish through a media-required composer, seed deterministic media through a dev/test-only control instead of bypassing validation; also keep selected-media action buttons as siblings, not nested inside an outer pressable button, to avoid React Native Web hydration errors.
- Review surfaces are not post surfaces. In Supabase mode, do not send review ids through post engagement tables, and do not fall back from failed review service reads to persisted local profile arrays.
- A safe failure state is not a complete MVP flow. If a production tab or primary CTA exists, verify it has a working source-backed path; for example, the Create tab needs a real dish selector when no route context is provided, not only protection against fake fallback publishing.
- When a narrower launch scope supersedes an older broad release posture, add an explicit status-surface scope note; otherwise historical rows can look current and contradict the active feature-flag policy.
- In native smoke flows, distinguish app-owned pre-permission dialogs from OS permission sheets. For media picker denial coverage, tap the app's pre-permission "Allow" action first, then assert the app's denied-permission fallback after the real permission request resolves.
- If product direction says sign-in is the app entry point, keep authentication at Splash/root navigation and remove Profile-local sign-in cards; Profile should redirect unauthenticated self access to Login instead of becoming the auth surface.
- Developer Launcher mode switches must not clear real Supabase auth when entering User mode. Preserve UUID-backed sessions or restore `auth.getCurrentSession()` first; only reset to Login when no live Supabase session exists.
- Developer Launcher mock-auth presets must set developer/mock mode after any `clearSession()` call; clearing the session also clears account-scoped merchant/developer state.
- Web E2E for non-map flows should force the mock map branch and keep Mapbox lazy-loaded; a live token or top-level Mapbox import can crash unrelated composer/feed tests before assertions run.
- Mock cross-account E2E identities should be deterministic per email, and profile sync should preserve an already-hydrated matching profile id; time-based mock user ids and broad profile rehydration can make ownership/follow assertions unstable.
- A credentialed Brandfetch render URL or matching domain proves only that an icon-render request can be made. It does not prove the image loads, matches the current local brand mark, is the icon rather than a wordmark, or has HD source pixels. Keep render links labeled as candidates until visually checked; 2048px requests do not enlarge smaller raster assets.

- After filling public-facing names in a previously blank-name tail, re-sort the full directory with blank names last and independently check for sort inversions before exporting.

- Preserve timezone-bearing source observations as literal strings with the original offset (for example, `Observed YYYY-MM-DD HH:MM SGT (UTC+08:00)`) when exporting through spreadsheet tooling; automatic date parsing can silently shift an ISO timestamp to the prior UTC day.
- Mapbox Search Box results are temporary-use only. Do not persist Search Box coordinates or venue metadata in the workbook; use an open/permitted source for stored data and label account-usage estimates as conditional unless the Mapbox dashboard confirms them.
- Recompute every coverage count from the current directory before recording a workbook refresh; a previously published menu-summary total (533) did not match the installed rows (531) and was corrected to the post-update actual (534).
- For large Excel workbooks, build to a temporary candidate, raise the Node heap only after an observed default-heap failure, compare the candidate to the exact baseline, and obtain independent candidate and installed QA before replacing the canonical file. Recheck symbol/punctuation ordering with the same comparator used by the workbook contract.

- When re-saving this workbook through openpyxl, scan baseline cells whose OOXML date type is `d`: cells with General format can become numeric serials. Restore typed datetimes and apply an explicit sortable date-time format, then independently compare every existing typed date before install.

- When an operator locator shows a branch closed every day while the landlord directory still lists the exact unit, keep the venue and leave operational status/hours unresolved until direct closure evidence reconciles both sources. A transient Mapbox POI status can guide research but must not be retained as catalogue data.

- After every name-enrichment batch, recompute both named and unnamed row counts and assert their sum equals the fixed directory record count; do not carry the previous blank-name count forward.

- Never copy or synchronize tabular data between sheets or workbooks using positional row indices (`for row in range(...)`). Always match using strict composite business keys (e.g. `(licence, dish_name.lower())`) or enforce guaranteed identical row sequencing beforehand. In addition, always enforce brand-domain consistency checks so official brand CDN assets (e.g., McDonald's, Starbucks, Toast Box) can never be attached to a different brand or generic stall.
- In database schemas where numeric price columns default to `0.0` for dishes scraped from marketing sites that do not publish numeric prices (such as `mcdonalds.com.sg/food-menu`), export and formatting functions must check `float(price) > 0` before formatting as currency. Never format `0.0` as `S$0.00` for commercial restaurant items; label them explicitly as `Unstated` to avoid misleading users into believing meals are free.
- For workbook QA, audit every worksheet field for literal placeholders, and compare records by stable business keys instead of row position after sorting. Keep same-name ordering stable unless a documented tie-breaker is required; blank unsupported labels instead of guessing.

- In page audits, cross-check incoming navigation before calling a screen unreachable; distinguish route registration, ordinary production entry, and feature flags. Check later SQL replacements and error prerequisites before describing a source authorization gap as a demonstrated disclosure. Keep measured runtime evidence separate from source critique.


## 2026-10-20 — Remediation verification corrections

- Account ID equality misses A→B→A; capture a monotonic account generation across hydration, mutations, callbacks and queued storage operations.
- Retiring an SDK storage adapter before `getSession()` resolves can erase the token intended for remote revocation. Snapshot the captured generation through a serialized pre-purge read; never revoke a later client/session.
- Failed credential deletion needs a durable retirement marker, strict read-back and restart recovery. Memory-only logout flags cannot prevent stale credentials restoring after restart.
- A draft subject field is not a persistence partition. Preserve inactive owner keys and guard disk hydration against account switches and newer edits; normalize legacy guest IDs deliberately.
- Do not let programmatic carousel momentum become a user answer. Test both durable values and physical option centering after reload; browser accessibility metadata alone may not prove selection.
- New native candidates and real keyboard interaction can reveal occlusion that source/contract tests miss. Preserve the failing screenshot and retest the exact rebuilt artifact.
- Update source/browser contracts to supported behavior when removing prototypes; preserve meaningful negative cases and historical failed logs instead of accepting fabricated success.

## 2026-10-21 — Halal Chain Propagation & Word Boundary Verification

- When propagating Halal certification status across multi-outlet chains, always enforce strict word-boundary matching (e.g. `\b`) and explicit brand identity verification. Naive substring matching creates dangerous false positives (such as matching "rhombUS PIZZA" when searching for "US PIZZA"). In addition, always isolate dedicated brand outlets from unrelated independent hawker stalls sharing common names (e.g. Tip Top Curry Puff kiosks vs independent hawker stalls named "Tip Top Vegetarian" or "Tip Top Western Food").

## 2026-10-24 — Large Excel Workbook URL limits with xlsxwriter

- When writing catalogues with >65,530 rows where columns include URLs (e.g. `Menu Source URL`, `Dish Image URL`), `xlsxwriter` by default converts URLs to hyperlink metadata and warns when exceeding Excel's 65,530 hyperlink limit per worksheet. Pass `{'strings_to_urls': False, 'constant_memory': True}` in `xlsxwriter.Workbook()` so that URL strings are written as plain text strings without triggering the hyperlink metadata ceiling or slow memory footprint.




## 2026-10-26 — Menu Dataset Row-Grain and Provenance Cleanup

- For menu cleanup, do not rely only on blank dish names or literal placeholder tokens. Profile blank price/source cohorts and descriptions for scraper card fragments, cross-outlet reused dish templates, explicit conflicting dietary warnings, and promotion records; remove only high-confidence wrong-grain rows with a full backup and row-level reason manifest. Keep plausible but unverified priced records in review until authoritative outlet-level sources establish them.
- Never clear an “unverified” disclaimer or stamp a verification date based only on matching a brand name or generic chain page. Require row-level source, outlet, item, and price evidence; otherwise preserve the prior qualification and record the remaining evidence gap.
- Keep URL reachability, outlet identity, item availability, and price verification as separate fields. A 404 from `HEAD` is an endpoint observation, not proof a merchant is closed; a URL-level identity heuristic must not classify every row on a mixed URL as wrong. Preserve unique row IDs and current source pointers for manual review.


## 2026-10-26 — Hungry URL and cohort evidence

- Treat the first HTTP result as an endpoint observation, not proof that an outlet or item is dead. Reopen the specific page and verify its contents before replacing a source link; a live direct item URL should be retained even when neighboring candidate URLs fail.
- Keep URL-level status counts distinct from affected menu-row totals. Label both count units in reports and calculate row overlaps before summing cohorts.
- Preserve exact prices unless outlet, item/variant, currency, and date are supported by the same source evidence.


## 2026-10-26 — Audit report reconciliation

- Before publishing an audit walkthrough, verify every quoted SHA-256 and byte count against the exact named file, and check row pointers against the current CSV line. Keep URL counts and affected-row counts distinct.
- Label historical HTTP probe results by method/date and keep them separate from later browser content review; do not infer the cause of differing results without captured evidence.
- Distinguish outlet counts from licence/address value groups, especially when rows have missing identity fields.

- When a source-evidence snapshot changes after a package is built, rebuild the QA reconciliation and rerun independent QA against the final bytes; an earlier QA pass does not cover subsequently updated evidence hashes.
- For spreadsheet remediation, append every edited field to the field-level manifest, including provenance and caveat notes; compare data-row diffs to manifest counts before QA so a correct cell edit cannot be omitted from the audit trail.
- For audit-register update manifests, snapshot each target row before applying edits and derive every `Old Value` from that snapshot; never hard-code assumed defaults. Reconcile both old and new values against the baseline and final register for every stable row ID before QA sign-off.
- Generate narrative cohort totals from the finalized row-level evidence, then compare every quoted count in audit resolutions, queues, and walkthroughs to the source manifest before packaging; correct counts before QA instead of relying on copied summaries.

- For row-level evidence, validate each asserted field against the current stable row ID and CSV line before propagating language into notes, queues, or summaries. A group-level statement like “all prices blank” can be false for one row; compare the nonblank-price distribution and preserve existing values as unverified when evidence cannot validate them.
- Evidence manifest URL fields must contain actual `http://` or `https://` source links only; keep outlet descriptions, addresses, and local evidence paths in their dedicated fields. Validate URL-shaped fields before publishing each remediation package.

- For large read-only workbook parity checks, iterate `worksheet.iter_rows(values_only=True)` once instead of calling `cell()` for every coordinate; repeated random access can reparse the whole XML sheet and make a minutes-long check unnecessarily expensive.

- For marketplace evidence, inspect the rendered outlet state separately from generic translation strings or stale crawl labels; never infer CLOSED from a text token alone. Recompute cohort overlaps from stable row-set membership and record the actual source before-value rather than trusting proposal text. Keep delivery price and in-store price scope distinct.

- When integrating review artifacts into a newer workbook, treat artifact line numbers as snapshot-scoped; join the stable review ID to its evidence row, then uniquely reconcile with current data using licence, outlet address, item, and recorded value. Record the resulting current package pointer. Have independent QA compare all repeated cohort totals in queue status and evidence-gap fields before publication.

- Before calling a review batch new coverage, compare its stable-ID/licence set with the authoritative prior subset evidence file. Do not use a same-named convenience `raw_fetch` mirror as the baseline. Record overlap explicitly and keep current-source rechecks separate from distinct-row counts.

- For older review batches, never promote snapshot line pointers or copied “current value” fields without rejoining stable IDs against the exact current CSV. Subset01 had 24/50 stale line pointers; the safe repair was a unique licence + normalized address join. Separately, five historical F&B-name snapshots were stale even though their pointers resolved; refresh both pointer and current-value snapshot, and record that the underlying dataset did not change.

- For cumulative workbook change totals, name the comparison baseline explicitly and report both cumulative and latest-increment deltas. Validate each against a direct stable-ID/cell comparison; do not label a cumulative total as “since” the immediately preceding checkpoint.

- 2026-10-27 data-package lesson: preserve each review artifact's declared pointer method (logical record index vs physical `DictReader.line_num`) and map pointers to the actual mutable rows that feed workbook output. Cross-check the complete row key before mutation; a copied lookup dictionary can pass pointer joins yet leave the output dataset unchanged.
- 2026-10-27 workbook packaging correction: after applying field proposals, assert the final serialized table contains each proposed value and compare its actual cell diff to the Change Manifest. A detached in-memory edit list can be overwritten before serialization; reject that output, preserve it as superseded, and rebuild from the last independently accepted baseline.
- Keep evidence dimensions independent: an exact menu-title match or supported outlet URL does not resolve a row's saved size, fixed SGD price, checkout availability, or in-store price. Count price claims from the price-evidence result, not from whether a URL change was held. In queue notes, label historical cohort counts separately from current row use and overlap.
- When comparing DictReader-backed workbook exports, compare row dictionaries by verified stable ID and exact full key; do not zip CSV headers against DictReader row objects, which yields keys instead of values and creates false QA failures. Treat repeated composite keys as non-unique and require stable-ID plus current physical start-line joins.
- Directory evidence-review sheets must preserve the source baseline in `F&B Name Current`; put candidates only in the recommendation field. Recheck both columns against the pre-edit workbook before package integration.
- Verify cited HTML line numbers against the retained raw response and line index after any evidence-pack rebuild; a supported claim with stale or shifted line references is not reproducible until corrected.
- For CSV-backed workbook manifests, distinguish physical text-line pointers from parsed logical record numbers; join edits by stable row ID and validate both pointers independently. After low-level XLSX XML edits or appends, update worksheet dimensions and verify the full CSV/workbook parity, since ZIP CRC alone cannot detect omitted rows.
- When patching worksheet XML, replace complete row elements directly or regenerate the whole sheetData from the authoritative CSV; do not wrap an already complete row in another row element. A clean ZIP CRC is insufficient—load the workbook and verify exact parity with OpenPyXL after every XML-level update.
# 2026-10-28 data remediation lessons

- Treat an independent QA finding as a hypothesis until it is checked against the artifact's declared pointer semantics and authoritative source. Physical CSV line starts (`csv.reader.line_num`) differ from logical record ordinals; keep both explicit and validate IDs, full keys, and current pointer values.
- Compare an adjudication export against the adjudicator's final decision set, not only its row shape. Mark conflicting exports superseded and integrate only the explicitly authoritative artifact.
- Capture every manifest old value from the immutable parent before mutating rows. After low-disk ZIP-level XLSX patching, independently verify full workbook load, ZIP CRC, zero formulas, exact sheet/CSV parity, manifest deltas, and evidence joins.
- Once independent QA has hashed a candidate package, preserve those bytes. If a package manifest or report must change after QA, create a successor package and rerun independent QA rather than editing the reviewed candidate in place.


## 2026-10-28 — Evidence package lessons

- Workbook-to-CSV parity can pass while narrative queue counts are stale; recompute counts from current row-level records before QA.
- Under tight storage, use immutable hash-pinned CSV bases plus stable-ID deltas; reconstruct and compare every workbook cell before acceptance.

## 2026-10-29 — Incremental directory workbook integration

- Reconcile workbook, exported CSV, change manifest, research source register, unresolved queue, and audit resolution summary as one transaction. Apply updates to the exact keyed row objects that are serialized to CSV; a correct workbook sheet with a stale sidecar is not a valid candidate.
- For URL removal, assert `old URL -> blank` in the manifest and compare actual clear/fill counts against the intended operation set. Do not accidentally write the evidence URL into the field being cleared.
- Before independent QA, run keyed parent-to-candidate deltas, full manifest replay with parser-derived physical lines, and workbook/export parity. QA should verify the candidate after these local checks; repair sidecar mismatches before final receipt.


## 2026-10-29 — Snapshot identity

- State frozen-baseline and accepted-candidate hashes separately in every audit task. In this run the frozen 0325 export (`1b9b…`) and accepted 2225 export (`5d597a…`) are intentionally different snapshots; compare target records by exact licence/address and current parser pointers rather than treating the hash difference as a mismatch.

- If a shared candidate changes after QA, recompute its SHA immediately and invalidate the old receipt for the current path. Continue from the immutable accepted parent until new bytes receive independent QA.
- SFA exposes `businessName` and `licenseeName` as separate fields. Do not map the legal licensee into `Registered Business Name` unless that column’s contract explicitly defines it that way; capture schema ambiguity as unresolved.

## 2026-10-30 — Candidate image source fields

- In row-keyed manifests, distinguish `source_url` from `proposed_value` before classifying an image operation. A stock-image URL may be the evidence for clearing an existing value; verify the direction (`old_value` → `proposed_value`) before treating it as an addition.
- Before dispatching a source audit, validate every supplied SHA-256 as exactly 64 hexadecimal characters and recompute it from the pinned path. If a report inherits a malformed digest, preserve the original receipt, document the correction, rebind QA to current report bytes, and rerun source-evidence QA wherever the old receipt did not bind the report hash.
- For workbook integrations, stage all candidate operations and manifest rows before opening the install path; catch script errors before persistence. Keep result counters tied to changed cells rather than candidate-row counts, then reconcile the summary JSON against the final manifest in independent QA.

## 2026-10-30 — CSV line-pointer interpretation

- For CSV manifests, `CSV Line` can mean parser-reported physical line (`csv.DictReader.line_num`), not logical record index plus the header. Quoted cells may contain embedded newlines; here 425 embedded line breaks made both counts differ. Verify the documented pointer convention and join by stable ID before declaring offsets stale or rewriting manifest history.

- Validate external capture JSON schemas before any workbook copy or sidecar mutation. A missing `stable_row_id` field caused a staged run to abort before save; assert required capture keys up front and verify the final workbook SHA differs as expected from its parent.
- Recompute `CSV Line` from `csv.DictReader.line_num` after serializing any edited field that may contain embedded newlines. A single newline inside a quoted menu summary shifts every later physical pointer even though logical row keys remain stable.


## 2026-10-31 — Reuse historical menu row identity

- When appending Change Manifest events, first match the exact menu row by Dataset, workbook CSV Line, venue, licence, and item. Reuse its existing Stable Row ID for that row; derive the deterministic ID only for rows with no history. Keep the workbook's CSV Line (Excel row) convention distinct from the legacy ID suffix (logical record). Independently verify both before installing.

- For billed API submissions, distinguish a definitive authentication rejection from a timeout or lost response. Allow retry after a definitive rejection, keep the submission lock on uncertain outcomes, and provide a read-only credential preflight. Keep pasted interactive zsh commands free of standalone comment lines unless interactive comments are enabled.
