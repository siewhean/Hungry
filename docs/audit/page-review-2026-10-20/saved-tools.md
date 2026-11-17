# Saved tools expert audit — 20 October 2026

**Role:** information architect, collaborative-product UX designer, state/backend engineer, and debugger. **Scope:** all 20 assigned screen/support TSX files, their stores, key service/repository adapters, RLS/RPC migrations, navigation gates, and focused tests. Base HEAD `50b2223e3ee058618bc23db48a97fb9fafac41ee`; findings describe the current dirty working tree, not a released binary.

**Scoped verdict: No-Go for the currently enabled portfolio/solo-wheel scope until ST-01–03 are fixed and independently verified.** Collections/checklists/group parties/admin screens are gated beta/developer surfaces and their standalone defects do not block the currently configured production route set. A gated admin screen does not eliminate the production public-portfolio moderation gap (ST-11). No P0 found. No production database, store submission, or device conformance is certified here.

## Evidence and design boundary

Read shared defaults and bounded startup/reference sections in README, CLAUDE, WORKFLOW, environment, backlog, verification, lessons, data contracts; applied `hungry-release-readiness` and its release-gates reference. Actual `featureFlags.ts:24–56`, `ProfileStack.tsx:88–110`, `ProfileHomeScreen.tsx:603–623`, and `RootNavigator.tsx:770–790` supersede historical broad launch claims. Portfolios and their signed-out public links are enabled; solo Wheel is enabled; group parties, checklists, editorial collections, and admin portfolio flags are disabled in production. Profile access is authenticated, while public shared-list viewing and solo Wheel are public root routes.

Opened `docs/audit/PROFILE_READS_SPEC.md` and `docs/handoff/SPRINT_FINAL_POLISH.md` before auditing screens. The first does not define these saved-tool layouts; the latter defines Wheel dietary warnings and entry limits. Additional relevant product/interaction source: `tasks/Roadmap/Gamification/hungry_checklist_portfolio_passport_plan.md` (especially final decisions, flows, collaboration/privacy, decimal ranking examples, moderation) and its implementation guide. `design/figma-v2/` contains no dedicated portfolio/checklist/wheel screen artifact. Thus product/interaction intent is auditable, but precise approved layout/fidelity is **missing external/design proof**. No screenshot was inspected and no simulator was navigated by this reviewer. Safe-area, clipping, screen-reader focus, contrast over imagery, reduced-motion behavior, touch ergonomics, and Android keyboard behavior remain runtime checks.

## Per-file coverage — 20/20

Paths are relative to the repo. `Prod` means route/entry enabled, not functionality proven. `Beta` means production route/entry gate off. `G` = Gamification product plan; `W` = approved Final Polish wheel section; no dedicated pixel design for either.

| File | Purpose / reachability / design | Inspected evidence and findings | Runtime checks still needed |
|---|---|---|---|
| `src/app/screens/checklist/ChecklistsHomeScreen.tsx` | Private planning lists; Beta; G | Auth branch, load/create, FlatList, cached counts; ST-03,04,16 | Offline first load, back affordance, long names and counts after fresh install |
| `src/app/screens/checklist/ChecklistDetailScreen.tsx` | Name, tried state, ordered food plan; Beta; G | Blur save, service label hydration, move/delete, schedule row; ST-04,08,09,16 | Keyboard/back save, rapid reorder/tried, stale/deleted IDs |
| `src/app/screens/checklist/ChecklistItemPickerScreen.tsx` | Add dish/stall/custom with dates; Beta; G | Calendar validation, +08:00 reminder, query lifecycle, six-building truncation, save; ST-04,09,16 | Invalid/past date, keyboard obscuring results, retry and duplicate taps |
| `src/app/screens/discover/CollectionListScreen.tsx` | Curated editorial lists; Beta; no dedicated design | Repository/store load, empty state, nested card pressables, FlatList; ST-04,15 | Initial loading vs genuinely empty, nested focus/taps, refresh |
| `src/app/screens/discover/CollectionDetailScreen.tsx` | Editorial collection, stalls and progress; Beta; no dedicated design | Skeleton, no-result, repository resolution, save/tried, IDs and images; ST-04,09,15 | Cold cache, failed request, rapid route changes, safe-area overlay |
| `src/app/screens/portfolio/AdminPortfolioFlagsScreen.tsx` | Moderation queue; Beta/developer + authenticated route; G | Pending load, dismiss/remove, data fields, service + admin RLS; ST-04,11 | Unauthorized user denial, actual content removal, repeated actions, pagination |
| `src/app/screens/portfolio/PortfolioCollaboratorsScreen.tsx` | Grant viewer/editor roles; Prod authenticated; G | Raw user ID input, roles, add/remove, missing role checks/error paths; ST-04,06,08 | Owner/editor/viewer roles, unknown/self/duplicate user, revoke and two accounts |
| `src/app/screens/portfolio/PortfolioCreateScreen.tsx` | Create private/public food list; Prod authenticated; G | Default private, metadata and type/visibility selectors, save finally; ST-04,08,10,13 | Title >100 chars, offline submit, double submit, discard/back, keyboard |
| `src/app/screens/portfolio/PortfolioDetailScreen.tsx` | Curate/share/follow/report ordered list; Prod authenticated; G | All owner/nonowner branches, autosave, conflicts, items, share channels; ST-01–11,13 | Cold load, conflict preservation, publish/share, revoked access, deep linking |
| `src/app/screens/portfolio/PortfolioEditScreen.tsx` | Metadata/visibility edit; Prod authenticated; G | Store hydration overwrite effect, error alert, conflict card, clearing description; ST-07,08,10,13 | Draft vs remote update, visibility reversal, keyboard and safe area |
| `src/app/screens/portfolio/PortfolioItemPickerScreen.tsx` | Add scored food with public/private note; Prod authenticated; G | Score parsing, private-note promise, searches, bounded stalls, save alerts; ST-01,04,07,09,12,13 | Decimals/malformed score, duplicate IDs, private-note permissions, large catalog |
| `src/app/screens/portfolio/PortfolioPublicViewScreen.tsx` | Signed-out shared food-list page; Prod public; G | Public RPC and mounted guard, login return route, follow, dish/stall links, photos; ST-04,05,13 | Signed-out → login return, offline retry, private/deleted link, long text |
| `src/app/screens/portfolio/PortfolioSearchScreen.tsx` | Search public lists; Prod authenticated; G | Search submit, pending/empty/results, navigation, search RPC filters; ST-04,05,11,13 | Racing keyboard submissions, failure then retry, >1000 rows |
| `src/app/screens/portfolio/PortfoliosHomeScreen.tsx` | Mine/Following/Discover list hub; Prod authenticated; G | Safe-area inset, tab semantics, local filter, item counts, load; ST-03–05,09 | Fresh account/device follow restoration, revoked cached lists, long list performance |
| `src/app/screens/wheel/WheelEntryAddSheet.tsx` | Nominate options by search/random/category/favourites; Prod solo; W | Full modal/tab/selection tree, cache repository, dietary checks, match score; ST-09,13,14 | Cold catalog, categories, favourite mapping, duplicate weights, focus + keyboard |
| `src/app/screens/wheel/WheelHomeScreen.tsx` | Start solo wheel or join beta party; Prod solo / Beta party; W | Flag gating, host creation, join input and failure paths, copy; ST-02,04,14 | Deep-link invitation in production, bad beta code, prior-session state |
| `src/app/screens/wheel/WheelLobbyScreen.tsx` | Nominate/remove/start/close; Prod solo / Beta party; W | Dedupe by entry ID, host permission, >=2 gate, invite and close; ST-02,13,14 | Background/process restart, back after leave, deletion focus and small screen |
| `src/app/screens/wheel/WheelSpinScreen.tsx` | Animated fair selection; Prod solo / Beta party; W | Seed/index math, animation and completion, haptics, host state; ST-02,13,14 | Native animation completion, interruption/resume, Reduce Motion, pointer/winner agreement |
| `src/app/screens/wheel/WheelResultModal.tsx` | Winner food detail and finish/next round; Prod route, ordinary result unreachable under ST-02; W | Repository media, target navigation, modal animation, done/reset, absent classic repeat CTA; ST-02,09,13,14 | Correct live winner, modal focus, tall text, repeated solo spin, removed venue |
| `src/app/screens/wheel/WheelStack.tsx` | Home→lobby→spin→result registration; Prod; W | All four static routes, hidden headers, transparent result modal; no distinct confirmed defect beyond ST-02/13 | Back stack after close/reset, deep-link state restoration, modal dismissal |

## Findings, ordered by severity

### ST-01 — P1 — Overbroad private-note read authorization; successful disclosure unproven

**Location:** `supabase/migrations/20260527103000_checklist_portfolio_passport.sql:299` and `:1126`; `supabase/migrations/20260527104500_checklist_portfolio_passport_grant_fix.sql:8`; `src/lib/services/supabase/supabaseService.ts:6703`; `src/app/screens/portfolio/PortfolioItemPickerScreen.tsx:164`.

**Independent cross-check qualification:** the portfolio/collaborator SELECT policies form a recursive graph that may deny the table read before any row is returned. This is an overbroad source authorization boundary conditional on a readable policy path, not demonstrated live extraction. Fixing recursion must also protect private notes. See `crosscheck-merchant-tools.md`, ST-01.

**Trigger/consequence:** Owner writes a “Private note — Only for you and collaborators,” then makes the portfolio public (or followers-only). The table grants authenticated whole-row SELECT; the item SELECT policy permits anyone who can view the portfolio. `getPortfolioItems()` requests `*` and `mapPortfolioItem()` retains `private_notes`. If the row-read policy path succeeds, the whole-row projection would expose these notes to a permitted authenticated reader, despite `PortfolioItemRow.tsx:112` hiding them for nonowners. The anonymous `get_public_portfolio` RPC correctly omits private notes, but does not fix the authenticated table path.

**Recommendation:** separate protected notes from public rows or revoke whole-table reads and expose audience-aware projections/RPCs, with explicit owner/collaborator checks. Do not rely on UI filtering. **Owner:** backend/security. **Close:** two normal authenticated users plus viewer/editor collaborator and anon negative tests against an applied staging schema; prove public items readable while private notes are inaccessible, including direct REST queries. This is source exposure evidence, not a claim that live production exploitation was tested.

### ST-02 — P1 — Confirmed source defect + isolated runtime repro: the production solo Wheel cannot resolve a normal spin

**Location:** `src/store/useWheelStore.ts:273`; `src/app/screens/wheel/WheelSpinScreen.tsx:95`, `:117`; `src/lib/services/realtime/MockRealtimeChannel.ts:40`.

**Trigger/consequence:** Add two options and spin. Store seed is `Math.random()` (fraction in [0,1)); screen treats `seed % activeEntries.length` as an array index. For normal nonzero seeds the selected entry is undefined, and the completion callback returns before navigating/resetting. Party remains `spinning`, disabling the button. A zero seed is skipped by the truthiness guard at `WheelSpinScreen.tsx:87`. In addition, no production of a `party_resolved` event/winner exists in this mock channel/store path; merely flooring the index would still leave the winner contract unfinished.

**Evidence:** isolated imported real store repro: `{count:2, seed:0.7416778173027898, index:0.74167781730279, indexIsInteger:false, selectedEntry:null, winnerEntryId:null, status:"spinning"}`. No simulator action or network mutation.

**Recommendation:** choose a bounded integer winner index from the frozen active-entry snapshot, record resolved winner/round state deterministically, derive animation from that choice, and reset for repeat spins. **Owner:** Wheel/state engineer. **Close:** deterministic seeds including 0 and near 1 for 2/3/many entries, native result navigation, repeat spins, interruption/back/resume, and pointer/winner agreement. This blocks production solo Wheel, independently of beta multiplayer limitations.

### ST-03 — P1 — Confirmed source defect: private saved-tool cache survives logout and can be shown to another account

**Location:** `src/store/useSessionStore.ts:100` and `:268`; `src/store/usePortfolioStore.ts:202`, `:219`, `:541`; `src/store/useChecklistStore.ts:227`; `src/app/screens/portfolio/PortfoliosHomeScreen.tsx:35`.

**Trigger/consequence:** Account A loads private portfolios/items; sign out, sign in as B on the same install. Session cleanup resets many other stores but never portfolio/checklist/collection/Wheel stores. Portfolio persistence uses a global key without account identity. Before reload, B can see A's private list metadata under Discover; if reads fail the store deliberately reuses cached portfolios/items without checking current audience. Follow state also crosses accounts. Revoked collaboration/private visibility can remain accessible offline within the old cache.

**Recommendation:** scope cache to authenticated subject, clear sensitive state on account transition/sign-out/deletion, reject responses started for an old subject, and define permitted offline retention/revocation semantics. **Owner:** auth/store + security. **Close:** A→sign-out→B tests online/offline/cold restart, pending A request resolving after B login, no leaked titles/notes/follows; verify all persisted keys and in-memory state. Source confirms missing cleanup; live two-account native repro remains pending.

### ST-04 — P2 — Confirmed source defect: failed reads/writes are often unhandled or misreported as empty/missing

**Location:** `PortfolioCreateScreen.tsx:25–38`, `PortfolioCollaboratorsScreen.tsx:25–38`, `PortfolioSearchScreen.tsx:22–30`, `PortfolioDetailScreen.tsx:62–65`, `PortfolioPublicViewScreen.tsx:35–43`, `AdminPortfolioFlagsScreen.tsx:19–35`; analogous checklist load/save handlers and `CollectionDetailScreen.tsx:71–86` (all under `src/app/screens/`).

**Trigger/consequence:** Cold network/service failure leaves hub loading indefinitely, sends async rejection to the runtime logger, leaves an add operation with no actionable message, or public view says “List not found / may be private” for connectivity failure. Detail initially renders “not found” before its load completes. Public follow/report and several collaborator operations fire promises without catches. React error boundaries do not provide async promise recovery. Public view's mounted guard is good but the error classification remains wrong.

**Recommendation:** model loading/success/empty/not-found/forbidden/offline/error separately; catch every user command, show retained draft and retry, mark stale cache honestly, serialize submissions and prevent stale search results overwriting newer ones. **Owner:** saved-tools frontend. **Close:** fault injection per read/write (401/403/404/offline/timeout), no unhandled rejection, clear feedback, retry without losing user input; keyboard double-submit and rapid query sequence tests. Existing happy-path contracts do not prove this.

### ST-05 — P2 — Confirmed source defect: “Following/Saved” is device-local state with no backend restoration; hub item counts falsely show zero

**Location:** `src/store/usePortfolioStore.ts:249`; `src/app/screens/portfolio/PortfoliosHomeScreen.tsx:35–42`, `:143–150`; `PortfolioDetailScreen.tsx:56`; `PortfolioPublicViewScreen.tsx:20`.

**Trigger/consequence:** A user follows a list on device A, then opens device B/fresh storage. No screen invokes `checkFollowStatus` and there is no followed-list hydration path, so Following is empty and saved public lists show “Save this list.” Also the hub loads portfolio metadata only; it derives counts from `items[id]?.length ?? 0`, showing zero until each list is visited. `getPortfolios` does not return aggregate counts; search aggregates are discarded by `mapPortfolio`.

**Recommendation:** hydrate follows for the current account and return authoritative summary counts in the hub read model. Show unknown/loading counts rather than zero. **Owner:** state/backend + frontend. **Close:** follow/unfollow across two installs, account switch, zero/nonzero unread list summaries, revoked/removed followed list.

### ST-06 — P2 — Confirmed source defect + UX critique: editor collaboration has no usable editing UI and adding people requires raw user IDs

**Location:** `src/app/screens/portfolio/PortfolioDetailScreen.tsx:55`, `:218`, `:325`; `src/components/portfolio/PortfolioItemRow.tsx:112–122`; `PortfolioCollaboratorsScreen.tsx:69`.

**Trigger/consequence:** Owner grants editor role; collaborator sees the same read-only branches as a stranger. Add/reorder/delete controls require `isOwner`, and collaborator private notes are hidden even though the creation form promises collaborator access. The database RPC allows editors, so client capability is narrower than the advertised role. Requiring a pasted internal Hungry user ID gives users no practical identity-confirmation/invitation route and risks mistaken grants.

**Recommendation:** derive canViewPrivateNotes/canEditItems/canManageSharing from current role; retain owner-only permission/visibility administration. Add searchable verified recipient identity or expiring invitation flow, role explanation, identity confirmation, revoke/leave actions. **Owner:** product/UX + collaboration engineer. **Close:** owner/editor/viewer/stranger matrix, actual edit/revoke, no privilege escalation, wrong/self/unknown recipient feedback and invitation acceptance.

### ST-07 — P2 — Confirmed source defect: portfolio editing promises exceed available actions; descriptions cannot be cleared

**Location:** `src/app/screens/portfolio/PortfolioItemPickerScreen.tsx:142`; `PortfolioEditScreen.tsx:47`; `PortfolioDetailScreen.tsx:112`; `src/lib/services/supabase/supabaseService.ts:6645`; `src/components/portfolio/PortfolioItemRow.tsx:55–160`.

**Trigger/consequence:** User is told “Score and notes can be edited later,” but no item editing control/route exists in the assigned screens or row; store `updateItem` is unused there. List deletion exists in store/service but has no screen affordance. Removing description text passes `undefined`, which the Supabase adapter omits, retaining the old description after refresh. Users cannot complete normal correction/cleanup tasks.

**Recommendation:** provide an item editor, explicit delete-list with confirmation/recovery decision, and distinguish omitted update from deliberate null/empty clear. **Owner:** saved-tools frontend/service. **Close:** add→edit score/public/private note→clear each→reload; clear description→reload; delete populated list and confirm cascade/follow cleanup. Do not add a backend feature merely to match competitor scope; complete the existing contract.

### ST-08 — P2 — Confirmed source defect/race: conflict refresh and ordinary reload can overwrite unsaved edits

**Location:** `src/app/screens/portfolio/PortfolioEditScreen.tsx:33–40`; `PortfolioDetailScreen.tsx:67–70`, `:104–120`; `src/store/usePortfolioStore.ts:152–186`.

**Trigger/consequence:** User starts editing while mount `loadPortfolios()` is pending, or attempts save after another device edits. The effect resets form state whenever the portfolio object changes; conflict handling loads the remote portfolio, which replaces local fields before the user can review/merge. “Latest version loaded” announces the overwrite rather than preserving the user's text. Blur autosave can race with field changes/navigation/publish. Create/edit/picker drafts have no persistence or unsaved-exit guard.

**Recommendation:** initialize once per record, track dirty fields and a stable base version, keep the local draft on conflict with compare/reload/merge actions, serialize autosaves and expose pending/saved/error state. Add explicit discard or recovery where input loss is meaningful. **Owner:** frontend/state. **Close:** delayed mount fetch while typing, two-device conflict, rapid field blur+publish/back, app interruption, server refresh failure after a successful mutation.

### ST-09 — P2 — Confirmed bounded-catalog defects + performance concern: results are partial and cache readiness is invisible

**Location:** `src/app/screens/portfolio/PortfolioItemPickerScreen.tsx:63–74`; `src/app/screens/checklist/ChecklistItemPickerScreen.tsx:108–121`; `src/app/screens/wheel/WheelEntryAddSheet.tsx:231–276`; `src/lib/services/supabase/supabaseRepository.ts:749`, `:1048–1069`.

**Trigger/consequence:** Stall pickers search only venues in the first six buildings, then truncate to sixteen, so a valid exact stall query elsewhere returns no results. Wheel gathers the synchronous repository snapshot and memoizes by stable repository/profile taste identity; repository background hydration has no subscribed revision, so cold-open empty results need not refresh when the cache arrives. Collection detail similarly resolves venues synchronously. Wheel match/category/favourite calculation repeatedly scans dishes per venue; portfolio/checklist detail label hydration performs per-item async lookups and displays “Deleted” even while labels are merely loading. Long ScrollView `.map` lists have no virtualization/pagination.

**Recommendation:** use service-backed paginated dish/stall search with explicit scope/loading/error, subscribe to catalog readiness/revisions, batch entity summaries, distinguish unresolved/deleted, and profile nomination cost with production-sized data. **Owner:** discovery/data + performance/frontend. **Close:** target outside the first six buildings, cold hydration, large live catalog, query debounce/cancellation, missing references, and measured render/query budgets. No production-sized latency measurement was made here.

### ST-10 — P2 — Confirmed source/design-contract mismatch: “Draft/Publish” does not control public visibility

**Location:** `src/app/screens/portfolio/PortfolioCreateScreen.tsx:78–87`; `src/components/portfolio/PortfolioCard.tsx:38–48`; `supabase/migrations/20261018050000_public_portfolio_photos_maps.sql:51`; `src/lib/services/supabase/supabaseService.ts:6561–6577`.

**Trigger/consequence:** Choose public visibility at creation or edit a private unpublished list to public. It is publicly readable immediately, including through the anonymous RPC, although the card labels it Draft and the detail still offers Publish. Conversely an already-published list made private can retain its Published label. Explicit public selection is consent to that setting, but the separate Publish/Draft state creates a misleading expectation of a later publication boundary.

**Recommendation:** decide whether visibility is the publication action or publication is an independent gate; implement one consistent rule in table reads/RPC/search/share and explain audience before confirmation. **Owner:** product + backend. **Close:** create-public-unpublished, publish, private-after-publish, followers-only, anonymous link, search, existing shares and collaborator matrix. Do not silently change privacy policy with a UI-only fix.

### ST-11 — P2 — Confirmed source defect: portfolio “Remove” resolves a flag without removing/hiding its public content

**Location:** `src/app/screens/portfolio/AdminPortfolioFlagsScreen.tsx:29–32`, `:96–102`; `src/lib/services/supabase/supabaseService.ts:6880–6892`; `supabase/migrations/20261018050000_public_portfolio_photos_maps.sql:51`; `supabase/migrations/20260527103000_checklist_portfolio_passport.sql:49–59`.

**Trigger/consequence:** Admin presses Remove. Adapter only updates `portfolio_flags.status`, reviewer ID/time; it never deletes or hides the portfolio. Public reader/search checks no moderation state. Queue item disappears while reported content remains readable. Product plan §11.2 promises pending/approved/rejected visibility/search treatment, but no portfolio moderation column or equivalent enforcement was found. The admin screen is gated beta, but enabled production public lists still need an operational abuse/removal path. Public app view also has no report action while authenticated detail has one, hardcoded to “inappropriate” with no reason/details or completion receipt.

**Recommendation:** implement a privileged audited moderation action that actually enforces hidden/removed state across table/RPC/search/web cache; provide usable report entry and reason/feedback, and identify the operational queue owner. **Owner:** trust/safety + backend + product. **Close:** report as ordinary user, admin remove, anon/direct REST/search/shared-link denial, dismiss without hiding, abuse/rate limit, audited restore if supported. This is an engineering/release finding; root owns official store-policy interpretation.

### ST-12 — P2 — Confirmed source contract mismatch: fractional ranking scores conflict with integer database/RPC types

**Location:** `src/app/screens/portfolio/PortfolioItemPickerScreen.tsx:15–19`, `:149–155`; `src/store/usePortfolioStore.ts:83–89`; `supabase/migrations/20260527103000_checklist_portfolio_passport.sql:76`, `:621`; `supabase/migrations/20260527144633_advisor_security_cleanup_public_rpc_wrappers.sql:96`.

**Trigger/consequence:** Enter 8.25; client parses it and store rounds to 8.3, and its mock test explicitly accepts 8.3. Table score and RPC `p_score` are integer. The live boundary can reject or coerce a value the app accepts; exact PostgREST behavior is not asserted without live proof. `parseFloat` also accepts malformed suffixes such as `8abc`. Product plan includes decimal ranking examples.

**Recommendation:** agree numeric precision and strict parsing, then align UI, types, mock, SQL, wrappers and import/export/test contracts. **Owner:** domain/backend + frontend. **Close:** 1, 10, 8.25/8.3, blank, 0/11, locale decimal, malformed suffix through applied staging RPC and read-back; avoid relying only on the mock test.

### ST-13 — P2 — Confirmed accessibility omissions + runtime-only layout risk

**Location:** `src/app/screens/wheel/WheelLobbyScreen.tsx:95–107`; `WheelSpinScreen.tsx:291–326`; `WheelEntryAddSheet.tsx:375–383`; portfolio screens' root ScrollViews (e.g. `PortfolioDetailScreen.tsx:153–156`); `src/app/screens/profile/ProfileStack.tsx:75`.

**Evidence/consequence:** Wheel delete option is an icon-only Pressable without label/role; spin CTA lacks button role/disabled accessibility state; sheet category/tab selectors omit selected state. Portfolio back/icon actions and shared row reorder controls generally have explicit labels and 44pt minima, which should be retained. Most portfolio children use hidden native headers and plain ScrollView without a safe-area top inset (unlike PortfoliosHome), risking notch/status overlap; this is a source risk requiring device confirmation, not a measured overlap. Wheel uses fixed 300px wheel, long animation/haptic listeners with no local Reduce Motion branch, and a non-scroll result card with fixed 240px image, risking small-screen/large-text clipping and motion discomfort. Theme-level motion adaptation has not been proven here.

**Recommendation:** contextual row labels and action roles/states; selected tabs; announced loading/errors/results; safe-area/keyboard-aware consistent shell; adaptive wheel/result sizing and reduced-motion/haptic behavior. **Owner:** accessibility/mobile frontend. **Close:** real VoiceOver/TalkBack traversal, focus entering/leaving both modal types, disabled actions, largest text, compact phone/landscape, notched device, keyboard and Reduce Motion. Source contracts are not screen-reader proof.

### ST-14 — P2 — Confirmed wheel correctness/copy issues beyond ST-02; multiplayer gaps remain beta-only

**Location:** `src/app/screens/wheel/WheelEntryAddSheet.tsx:181–215`, `:218–226`, `:258–260`; `src/store/useWheelStore.ts:197–234`; `WheelHomeScreen.tsx:54–61`, `:89`; `WheelResultModal.tsx:195–200`.

**Trigger/consequence:** Search/category/favourite nominations do not filter already-added venue IDs, and store dedupes entry IDs only; the same venue gets multiple wedges and disproportionately wins. Only random excludes existing venues. Surprise copy says “nearby” but samples all cached venues with no location/radius/open filter. Category labels like “noodles/local favourites” are matched to `tasteTags`, which may not be the category domain; catalog coverage requires verification. Taste “BEST MATCH” is a raw dot product with threshold 120 (high richness generally wins), not the app's established taste similarity measure. Production intro still advertises groups. Host dietary restrictions are not passed by the home create call, so the approved warnings normally have no preferences to check; when present, checking only first dish is not stall-wide suitability evidence. Classic result has no “Spin again” despite its documented CTA. Beta join stores errors in `connectionError` but home does not render them and can reuse a previous party; in-memory member/entry state is not a cross-device session.

**Recommendation:** one option per venue or explicit displayed weights; honest locality/filtering and match provenance; seed dietary preferences and communicate uncertainty; repeat-spin flow; preserve group production gate until real presence/auth/host enforcement/expiry is implemented and tested. **Owner:** Wheel product/state + discovery. **Close:** duplicate venue across all nomination tabs, remote/closed venue, category known examples, high-match counterexamples, dietary missing metadata, repeat spin, beta unknown code and expiry. Group transport gaps do not independently block solo production; nomination fairness/locality do.

### ST-15 — P2 — Confirmed gated-beta defect: editorial collection saves are not durable or account-scoped

**Location:** `src/store/useCollectionStore.ts:84–118`; `src/app/screens/discover/CollectionListScreen.tsx:36–38`; `CollectionDetailScreen.tsx:71–86`.

**Trigger/consequence:** Tap Save; UI updates count/Set and analytics, but the function has only a TODO for server persistence and no persisted local storage/user key. Restart loses saves; account transition can retain another person's in-memory save state. Load errors have no catch/retry; list shows “No collections yet” before loading, detail can remain skeleton indefinitely. `userId` is passed but unused. This is beta readiness debt because production collections are off.

**Recommendation:** implement authenticated save read/write with rollback and account reset; explicit loading/error/empty states; retain editorial collection attribution/distinguish it from user portfolios. **Owner:** collections frontend/backend. **Close:** save/reload/restart/two-account, duplicate rapid save, offline rollback, no-result and failed load, collection removed while open.

### ST-16 — P2 — Confirmed gated-beta product gaps: checklist reminder promise has no delivery/edit/undo completion path

**Location:** `src/app/screens/checklist/ChecklistItemPickerScreen.tsx:302–328`; `src/lib/services/supabase/supabaseService.ts:6493`; `src/components/checklist/ChecklistItemRow.tsx:142–147`; `src/store/useChecklistStore.ts:154–180`.

**Trigger/consequence:** Save a Reminder date/time. It is stored/displayed but no scheduling/delivery consumer of `reminderAt` was found in source, while notifications are disabled. Date parsing validates calendar format/+08:00 but accepts past dates; there is no completion/delivery explanation. An accidental “Mark tried” cannot be undone through UI (button disables permanently). Item schedule editor/list delete affordances are absent although underlying services exist. Custom item support and Singapore time disclosure are strengths.

**Recommendation:** explicitly label stored planning time until delivery exists, or complete consent/permission/scheduling/cancellation; use accessible native date/time selection; add schedule editing and tried undo where consistent with contribution semantics. **Owner:** checklist product/mobile/backend. **Close:** past/future/date-only/timezone, app restart, permission denial, cancel/edit/delete schedule and accidental tried correction. Keep production gate off until the supported scope is honest.

## Data/security and state coverage

- **Inspected backend paths:** authenticated profile → portfolio/checklist Zustand → `getHungryService` → Supabase tables/RPCs; discovery labels via service and synchronous cache adapter; public links via `webShareUrl`, `linking.ts:136–137` and anonymous safe-projection RPC; follows scoped by authenticated user in service; portfolio flags use normal user insert/admin RLS; Wheel is entirely local in-memory channel/store even in solo production.
- **Positive source controls:** private-by-default portfolio creation, explicit role/visibility types, score range checks, duplicate item unique indexes, full reorder validation, expected-version arguments for portfolio mutations, server auth/owner/editor checks, server follow upsert scoped by user, rate limits for portfolio creation/flags, approved-photo check in public RPC, public RPC omission of private notes, login return route for save, guarded public fetch/unmount, confirmation for destructive item removal, accessible explicit reorder alternatives. These do not close ST-01/03 or replace applied-schema proof.
- **Additional live-proof concerns:** current portfolio SELECT policy references `portfolio_collaborators`, whose SELECT references `portfolios` (original migration :274/:385, later policy rewrite `20260527145534_advisor_performance_policy_cleanup.sql:195–223` preserves collaborator reference). This apparent recursive RLS graph needs a real non-service-role read test for owner/collaborator/public reader before assuming any deployed query succeeds. No production recursion failure claimed. Admin route is authenticated/gated, while actual privilege rests on `app_is_current_user_ops_admin()`; test nonadmin negative cases, admin seeding and revoked role. Direct item UPDATE/DELETE grants also bypass the optimistic-version RPC contract; validate conflict behavior at the trust boundary rather than treating the client check as security.
- **Publication/contribution provenance:** plan requires tried/visited public ranking items and moderated global discovery. The inspected add-item/publish RPCs do not enforce tried/visited evidence before adding/publishing, and addition records contribution progress unconditionally. Gamification is gated, so do not advertise confirmed exploration/verified rankings from this path without a separate contract decision and proof.
- **Privacy retention:** private notes/collaborators/portfolio metadata persist in shared app storage. No account identity partition was found; platform-at-rest protection and backup behavior were not assessed. Do not describe app storage as encrypted without proof.
- **Concurrency:** expected-version machinery is a useful foundation; follow/unfollow, multiple autosaves, metadata-vs-publish, post-write refresh failure, delete vs reorder, async old-account fetch, changing query and visibility revocation all need focused state tests. Writes are service-first rather than knowingly offline-queued; UI must say when a request failed.

## Focused verification and limitations

1. Ran `HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/store/checklist-portfolio-store.test.ts src/app/screens/checklist-portfolio-phase3-contracts.test.ts src/app/screens/checklist-portfolio-phase5-contracts.test.ts` — **12/12 passed**, 0 failures. Three tests exercise mock-backed store behavior; remaining tests largely regex source contracts. This proves neither real RLS, native rendering, error handling, public deployment nor wheel completion.
2. Ran isolated CommonJS real `useWheelStore` import under `node --import tsx`, created two in-memory options, triggered spin, waited 80ms for the local bus and calculated the screen's current index formula — ST-02 output above. Store reset at end; no files/service data changed.
3. Initial ESM inline repro failed with “does not provide an export named useWheelStore” due module interop; reran through `require` successfully. Node emitted toolchain `DEP0205 module.register()` deprecation warnings in focused tests/repro. A search referenced nonexistent `src/app/AppBootstrap.tsx`, corrected to the actual session/store files; one broad zsh doc glob had no matches, corrected using `rg --files`. These are audit command/harness issues, not application runtime errors. No terminal application error was observed because no app was launched by this reviewer. Do not report “simulator clean.”
4. No build, install, broad test suite, production write, new test file, native accessibility run, staging multiuser read, device screenshot, share-recipient app test, website availability check or policy attestation. Root owns terminal/runtime QA and independent cross-review.

## First-party comparison and honest critique

Sources checked online 20 October 2026; these are documented product patterns, not claims of hands-on competitor use. Recommendations are limited to Hungry's food-list/decision outcomes.

| Comparator | First-party documented outcome | Hungry: keep / change / tradeoff |
|---|---|---|
| Google Maps | Place lists can be private/shared, shared to view or with collaborator invites; lists support following. [Google Maps list help](https://support.google.com/maps/answer/7280933?co=GENIE.Platform%3DAndroid&hl=en) | **Keep:** Hungry's dish-level scores, public/private notes, recommendation/ranking/trail distinction and Singapore price/unit context can add specificity beyond a generic place list. **Change:** make edit invitations human-usable, preserve followed lists across installs and link list items to useful food detail. An authenticated portfolio row currently has no open-detail action, unlike Hungry's own public view. Avoid adding full map scope now; reliable curation/recall is the necessary baseline. |
| Notion | Sharing exposes clear view/edit/full-access levels with per-person permission changes. [Notion sharing help](https://www.notion.com/help/sharing-and-permissions) | **Keep:** two simple collaborator roles fit casual food curation. **Change:** a granted editor needs actual item editing, private-note audience must be enforced server-side, and conflicts must preserve local drafts. Do not copy workspace/teamspace complexity; a friend invitation and visible role is sufficient. |
| Wheel of Names | Enter entries, spin and receive a random winner. [Official product page](https://wheelofnames.com/) | **Keep:** choosing real Hungry food records/favourites and linking a winner to a stall is a useful domain advantage. **Change:** first guarantee a winner and explicit repeat-spin path, prevent accidental weighted duplicates and retain readable choices. Fancy animation/host presentation currently outruns basic outcome correctness. No raffle-grade randomness/security requirement is implied for casual food choice. |

**Honest assessment:** the portfolio data vocabulary is promising, but the current UI behaves more like an early CRUD prototype than a dependable personal collection product. It asks for type/visibility/score/notes before proving easy recall, correction and collaboration; internal “portfolio/user id/followers_only” terminology increases effort for a casual diner. Dish-first content and private-by-default intent are worth preserving. A simple “Food lists” entry, progressive type options, human invitations and actionable item cards would reduce cognitive load without discarding advanced curation. Wheel is visually elaborate but fails its core decision task in the isolated real-store path. Collections/checklists carry useful intent but should retain their gates until persistence/recovery and reminder promises are complete. No visual beauty score is defensible without the governing designs/current render.

## Priorities and readiness implications

1. **Backend/security + auth/state:** fix ST-01 and ST-03; independent two-account/anonymous staging negatives, cache isolation and applied-schema evidence first. Resolve the apparent recursive RLS graph before using live read success as an assumption.
2. **Wheel/state engineer:** fix ST-02 deterministic resolution and repeat flow; cover real store and native animation, then ST-14 nomination fairness/locality. Keep multiplayer gated.
3. **Saved-tools frontend/backend:** close ST-04–08 (recoverable errors, follows/counts, truthful roles, editable items, preserved drafts); align score precision and public/draft semantics (ST-10/12).
4. **Trust/safety + backend:** close ST-11 with an operational privileged removal path that makes content inaccessible; audit all enabled public UGC surfaces. Admin beta route availability is not moderation proof.
5. **Design/accessibility + discovery:** define dedicated approved screen designs and verify ST-09/13 on actual iOS/Android with catalog-scale content, large text, assistive technology, keyboard and reduced motion.
6. **Beta owners:** ST-15/16 and multiplayer transport/access checks before removing gates. No waiver of these production blockers was supplied. Public launch/store-policy conclusion is deferred to root's release audit; source and focused local passes alone are insufficient for Go.
