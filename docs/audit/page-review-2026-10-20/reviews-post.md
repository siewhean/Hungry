# Reviews and posts expert audit — 20 October 2026

Reviewer: review/contribution UX designer, React Native/media engineer, backend/security reviewer, accessibility reviewer and debugger. Scope: **12/12 assigned TSX files** from `coverage-manifest.json`; current dirty working tree at base HEAD `50b2223e3ee058618bc23db48a97fb9fafac41ee`. Review only; no app implementation, native interaction, live writes, upload, account creation or deployment performed.

## Judgment and evidence boundaries

The core concept is strong: reviews belong to an explicit dish, text is optional, publishing goes through the service boundary, and retry-stable review IDs avoid a common duplicate-review failure. The implementation is less trustworthy than the product promise. Account-unscoped drafts survive session clearing; the production composer relies on a nonreactive whole-catalog snapshot; filtering promises and success/reward feedback do not consistently correspond to saved output. These need resolution before cosmetic work.

Design sources opened first: `design/figma-v2/quick-review.html` and `design/figma-v2/post-composer.html`, plus the shared accessibility/design rules already established by root. Quick review specifies a short dish/rating/taste-tag/optional-caption wizard. The composer brief specifies a concise food-first note, explicit destination and actual guardrails, rather than creator-platform features. No approved rendered designs were found for Review Feed, Soundtrack or the current single-page Review editor. Their exact visual fidelity is **not certified**; the textual intent can still be compared with source behavior. No screenshots of these pages were inspected, so layout/contrast/font-scaling judgments below remain source-based concerns unless explicitly labeled.

Root current-source evidence: typecheck fails; full source suite has 692 pass, one fail and two skips of 695; current-source mock Chrome smoke has eight passes and one login-entry expectation failure. Those checks are neither live-backend nor native acceptance proof. This reviewer ran 19 focused checks (all pass, warning recorded below) and an isolated real-store session-clear repro. No store-policy certification is claimed; use root's release-readiness assessment.

## Complete per-file coverage

Paths below are relative to `src/app/screens/`. “Production” means current source route/flag registration, not installed release proof.

| File | Purpose and actual reachability | Design/source inspection | Findings and missing runtime proof |
|---|---|---|---|
| `post/PostComposerScreen.tsx` | Production root `Post`, authenticated creation entry and dish-context entry | Composer brief; target selection, catalog enumeration, auth return, gallery permission, media replacement/removal, caption sanitation, publishing/error boundary | RP-02/03/04/06/13; cold Supabase cache, native media/keyboard, interrupted upload and back navigation unverified |
| `post/PostComposerScreenV2.tsx` | Prototype-only root route; not production-registered | Composer brief; both tabs, shared metadata, preview/editor sheets, AI buttons, exit interception, Save/Discard/Keep editing | RP-15/16/18; exact layout, native interception and app-kill restoration unverified |
| `review/MusicSelectionScreen.tsx` | Root-registered/protected, but only incoming UI callers are behind `prototypeRoutesEnabled`; no ordinary production entry found | No dedicated approved source; every mock track/search/save/play/seek/select handler and animation inspected | RP-17/13; actual music is simulated and selection is not committed; audio rights/native behavior unverified |
| `review/QuickReviewModal.tsx` | Globally hosted when `useUIStore.quickReview` is set; **no caller of `showQuickReview` found in current source** | Quick-review design; payload/present/dismiss, backdrop semantics, 80% snap and content fit | RP-14/13; dormant host, not a proven customer production path; modal focus/keyboard/swipe-dismiss draft loss unverified |
| `review/QuickReviewSheet.tsx` | Dormant support for above; user vs merchant mode branches | Quick-review design; all steps, dish service fetch, rating/tags/caption, developer camera/OCR, submission, points, success/share | RP-14/13; no real review submission; no public reachability claimed |
| `review/ReviewFeedScreen.tsx` | Production Review tab | No approved feed design; paginated service path, local mock path, query/sort/save/share/report/block, cards, skeleton, refresh/retry/load-more | RP-09/10/11/12/13/19; cross-user enforcement and scrolling/assistive-tech unverified |
| `review/ReviewScreen.tsx` | Production `ReviewStack/ReviewMain` | Quick-review intent only; single-page editor, target hydration/picker, auth gate, persistent draft, recommend, submit, error/success | RP-01/02/05/06/07/08/13/18; cold server picker, native failure/retry and content controls unverified |
| `review/ReviewScreenShell.tsx` | Reusable wizard shell; no current import caller found outside export/test context | Quick-review progress intent; step/total clamping, text, shared Screen/scroll | No independent functional defect confirmed. Numeric progress is visual without progressbar semantics; include in RP-13 if reactivated. Device fit unverified |
| `review/ReviewShareSheet.tsx` | Production external share; chat recipient/send branch gated by DMs | Shared sheet/accessibility intent; recipient fetch, selection/reset, attribution, copy/system/WhatsApp/Telegram/in-app send | RP-11/12/13; native share cancellation, denied external open and multi-recipient partial success unverified |
| `review/ReviewStack.tsx` | Production nested navigator with one `ReviewMain` screen | Navigation contract, target params and header behavior inspected; no extra wizard steps registered | No independent stack defect confirmed; source has one screen, unlike old four-step inventory. Native parent route/focus behavior unverified |
| `review/ReviewStars.tsx` | Reusable 44pt star buttons; no active caller found in current source | Quick-review rating intent; button names, filled state, target dimensions | RP-13 selected state. This is separate from active `components/review/StarRating`, which has 44pt buttons but an adjustable role without adjustable actions |
| `review/ReviewSuccessModal.tsx` | Production global review-success host | Quick-review success intent; payload, modal closure/history action, haptics, conditional tags and unconditional rewards | RP-08/13; actual reward receipt, focus and Reduce Motion unverified |

## Findings, severity ordered

### RP-01 — P1 — An unpublished review draft crosses account/session boundaries

**Class:** confirmed privacy/state-isolation defect, independently reproduced in memory. **Evidence:** `src/store/useReviewDraftStore.ts:146-151` persists the draft, photo URIs and pending client review ID under the global key `hungry-review-draft-v1`; `src/store/useSessionStore.ts:100-116,268,278` resets other account stores but omits this one. `ReviewScreen.tsx:50,74` immediately reads the retained draft. A scoped script set an unpublished caption, called the real `clearSession()`, and observed `isAuthenticated:false` with the same caption still present (`draftSurvived:true`). Normal Settings Sign Out explicitly calls `resetDraft()` (`SettingsScreen.tsx:278-280`) and is not the leaking trigger. The production Profile menu's Sign Out (`ProfileHomeScreen.tsx:643-653`) calls only session signOut/root reset; session expiry/direct account transitions also lack a draft reset.

**Trigger/consequence:** A writes a private draft, signs out through the Profile menu (not Settings), expires or switches accounts, then B opens Write a review on the same installation. A's draft can be displayed or submitted under B; a retained pending review ID can also make B's submit fail against A's existing row. This is not a remote-device leak claim.

**Recommendation / owner:** mobile/session owner must namespace drafts by authenticated owner, clear in-memory and persisted account state on identity transitions, and explicitly define guest-draft transfer. **Close:** A→signout→B, direct A→B, expiry and cold restore tests, checking text/media/pending ID isolation and optional consented guest transfer. Shares a cause family with saved-tools ST-03, but concerns a different store/data surface.

### RP-02 — P1 — The production Post picker can be permanently empty on a cold Supabase cache

**Class:** confirmed source-supported cold-cache functional defect; configured-backend native reproduction still needed. **Evidence:** `PostComposerScreen.tsx:75-95` memoizes all dishes only on stable repository identity. Its synchronous `listBuildings()` starts async hydration but initially returns empty (`supabaseRepository.ts:164-174,749-752,1048-1070`); no subscription/version/async search updates the memo. Selected dish lookup is similarly memoized at `:106-114`. Bootstrap does not warm the legacy whole-catalog cache by default (`useAppBootstrap.ts:227-236`). `ReviewScreen.tsx:87-101,132-133` also uses only the synchronous venue/menu picker; routed dishes have an async fallback at `:104-116`, so do not generalize that fallback to its venue picker.

**Trigger/consequence:** open Create without a dish before cache hydration (the normal default cold condition). “No dishes found” can remain even after cache fills; typing recomputes against the same memoized empty array, so a core contribution entry is blocked until remount. Remote dishes outside this partial cache cannot be found. Review's picker similarly lacks authoritative loading/error/retry.

**Recommendation / owner:** discovery/contribution engineer: use bounded async service search/menu queries with load/error/retry, and hydrate explicit target IDs without a whole-catalog scan. **Close:** delayed empty→nonempty cache and server-only dish cases from cold starts in Supabase mode; errors must not be mislabeled as no catalog data. The mock browser passes do not close this.

### RP-03 — P2 — The production composer silently loses a post on Back or unmount

**Class:** confirmed data-loss behavior from source. **Evidence:** `PostComposerScreen.tsx:67-74` stores caption/media/target only in component-local state; there is no `beforeRemove`/draft-save path in this file. Its global composer store is populated only at Publish (`:206-210`) and is not persistent. The prototype has an exit dialog, but that does not protect production.

**Trigger/consequence:** select several photos and write a caption, then remove the route through header Back/gesture, root reset, app recreation or route unmount. Ordinary pushed authentication routes can preserve the underlying component and do not by themselves establish data loss (independent cross-check correction). No save/discard choice preserves that work. **Recommendation / owner:** composer owner: give production its own account-scoped resumable draft and explicit discard confirmation; freeze or safely preserve content while publishing. **Close:** back button/gesture, process kill, auth interruption and failed upload recovery with the same text/media intact.

### RP-04 — P2 — A venue-only Post route guesses the first dish

**Class:** confirmed target-integrity defect; route-specific. **Evidence:** `PostComposerScreen.tsx:110-111` uses `listDishesByVenue(selectedVenueId)[0]` when no explicit dish ID exists. This contradicts the explicit-dish contract in `features/post/publishing.ts:24-26`; by publish time the guessed dish is passed as though the user selected it (`PostComposerScreen.tsx:211-214`).

**Trigger/consequence:** navigate to Post with a venue only; the note can be attributed to the first menu item rather than what the diner ate. **Recommendation / owner:** contribution owner: show the venue's dish picker and require a real selection, as the main review flow already tries to do. **Close:** venue-only, absent/invalid dish, shuffled menu and dish/venue mismatch route tests. Do not infer that every current CTA supplies this route combination.

### RP-05 — P2 — Changing a dish destroys the current review without consent

**Class:** confirmed draft-loss behavior. **Evidence:** `ReviewScreen.tsx:423-424` selects a new dish immediately; `useReviewDraftStore.ts:49-71` replaces the entire draft with its initial state when dish differs. Existing text, rating and photos disappear. Re-selecting the same dish is correctly protected.

**Trigger/consequence:** after composing, tap Change and choose another dish at the same stall to correct attribution. Work is silently erased. **Recommendation / owner:** review owner: ask whether to move the existing content, or confirm a destructive reset with a clear consequence. **Close:** different-dish confirmation/cancel, same-dish preservation and failed lookup cases with text/photos retained until the choice is committed.

### RP-06 — P2 — “Filter applied” does not change the uploaded review photo

**Class:** confirmed media-output mismatch. **Evidence:** active `ReviewScreen.tsx:217-225` exposes MediaPicker/filter state in production. `components/review/MediaEditor.tsx:71,91-101,155-157` renders a Skia preview and returns only a filter ID. `MediaPicker.tsx:198-201` saves the ID and announces “Filter applied!”; no processed image URI is produced. `ReviewScreen.tsx:165-174` sends the original `draft.photos`; `supabaseService.ts:877-906` uploads those URIs. The filter ID appears only in analytics (`ReviewScreen.tsx:190`).

**Trigger/consequence:** choose a filter and Publish; saved media differs from the preview promise. **Recommendation / owner:** media engineer: either export the transformation into a new image, retain per-photo edits, and upload that result, or remove the active editing promise. **Close:** use a known local image, apply a visibly nonidentity filter, and compare saved/uploaded bytes and displayed final output; no live uploads were performed here.

### RP-07 — P2 — A failed photo step can leave a public review despite “Could not publish”

**Class:** confirmed non-atomic sequence; external visibility depends on deployed policy. **Evidence:** `supabaseService.ts:3220-3225` inserts the review first, then uploads/inserts photo records at `:3267-3280`; `ReviewScreen.tsx:197-201` presents an undifferentiated failure. Public-read review policies exist in source (`0008_phase7_auth_scaffold.sql:76-78`). Retry ID reuse is a real improvement and should stay, but does not make insert+upload one publication transaction. Resumed submissions return early if any existing photo row exists (`supabaseService.ts:3257-3264`), so edits to attached photos after a completed-media/lost-response attempt can be ignored.

**Trigger/consequence:** upload or photo-row insertion fails after review insert; text/rating may already be published although the diner was told publication failed. They cannot see which parts succeeded. **Recommendation / owner:** backend/review owner: save as unpublished until media attachment completes, or return a precise partial-success status and resume/cleanup affordance. **Close:** inject upload, attachment, final-response failures; assert public visibility, idempotent edits/retries and orphan-object cleanup. No deployed leak/exploit proof is claimed.

### RP-08 — P2 — Production success claims locally calculated points without an award receipt

**Class:** confirmed success-feedback mismatch. **Evidence:** `ReviewScreen.tsx:152-161` calculates 25+tag/photo points locally; it never calls gamification/award service on this path, while `ReviewSuccessModal.tsx:92` always displays `+… points`, regardless of `FEATURE_FLAGS.gamificationEnabled` (false in production). Actual review/profile writes are performed; the issue concerns the separate reward claim.

**Trigger/consequence:** submit a production review and see rewards that need not exist in an authoritative points balance and cannot be checked through gated gamification screens. **Recommendation / owner:** product/review owner: hide rewards when gated, or display only an actual returned award. **Close:** production flags and success receipt without gamification, plus enabled beta award idempotency; do not simply change the arithmetic.

### RP-09 — P2 — Review Search and Top Rated operate only on the currently loaded recent page

**Class:** confirmed behavior plus misleading scope UX. **Evidence:** `ReviewFeedScreen.tsx:581-584` always requests most-recent pages; `:659-666,685-695` sorts/searches locally. The service supports only a timestamp cursor (`supabaseService.ts:3282-3296`); filter/query are not passed. With 50 loaded items, older matching/top-rated reviews are absent until the user scrolls. If filtering makes the list empty/short, load-more visibility is especially uncertain.

**Recommendation / owner:** feed/search engineer: server-backed filter/sort/query, or explicitly label “Search loaded reviews” and offer load-more. “By Location” currently alphabetizes venue names, not distance/area; rename it or implement the intended geographic grouping. **Close:** a matching/high-rated record older than the first page, empty filtered first page with later matches, and location sorting using real areas. This is not a claim that local mock sorting is absent.

### RP-10 — P2 — A timestamp-only review cursor can permanently skip tied records

**Class:** confirmed pagination boundary defect from source. **Evidence:** `ReviewFeedScreen.tsx:633-637` sends only the oldest `createdAt`; `supabaseService.ts:3289-3296` orders only by `created_at` then uses strict `< before`, without a unique tie-breaker.

**Trigger/consequence:** records share the boundary timestamp and the page ends inside that group; remaining tied reviews are excluded from all later pages. **Recommendation / owner:** backend/feed owner: use a stable `(created_at,id)` cursor and matching deterministic order; dedupe appended IDs. **Close:** more than one page of rows sharing the same timestamp, append during refresh, and no gaps/duplicates across pages. No production incidence measured.

### RP-11 — P2 — “Share review” opens a dish and may reference someone else's post

**Class:** confirmed target mismatch. **Evidence:** `ReviewFeedScreen.tsx:716-728` picks the first stall post containing the dish, or any post at its venue, without matching review/author; external `link` is `webShareUrl('dish', item.dishId)` with no review anchor/ID. `ReviewShareSheet.tsx:98-104` sends that post ID to chat while using the current review's title/author.

**Trigger/consequence:** copy a specific review and recipient sees the dish without a route to that review; in gated DM sharing, a review can link an unrelated person's post or an empty ID. **Recommendation / owner:** share/navigation engineer: model a true review share target/deep link or label it “Share dish”; never guess a post by venue. **Close:** two authors reviewing one dish, two dishes at one stall, no linked post, cold link and deleted review cases. Production external and gated DM impact are distinct.

### RP-12 — P2 — Sharing lacks outcome-aware feedback and duplicate-send protection

**Class:** confirmed handler gaps and conditional async risk. **Evidence:** `ReviewShareSheet.tsx:91-120` runs unguarded Promise.all sends; a partial failure reports one overall error and retry resends successes. `:132-141` increments share after `Share.share` resolves without checking `dismissedAction`; `:144-157` awaits `openTrustedMessagingShareUrl`, whose `Promise<void>` helper catches failed opens and resolves after an alert (`safeLinking.ts:77–93`), so the caller still records a share despite the failed handoff. External-opener failures do not themselves reject to this caller. The separate `Share.share` path is fired with `void` without a local catch. This corrects the original boolean-return claim from independent cross-check. Recipient-load errors become an empty list at `:67-68`.

**Recommendation / owner:** share owner: busy guard, per-recipient success accounting/idempotency, explicit failed-open recovery, and respect share cancellation. **Close:** cancel share sheet, uninstalled app, denied open, one of multiple sends failing and rapid repeated taps. Chat behavior is beta-gated; native external sharing remains production-relevant. Do not equate a resolved promise with an externally delivered message.

### RP-13 — P2 — Contribution accessibility remains inconsistent in controls, rating and modal focus

**Class:** confirmed semantic/target omissions; assistive-tech impact requires device verification. **Evidence:** active `components/review/MediaPicker.tsx:155-167,243-248` has unlabeled 28×28 edit/remove icon buttons; `ReviewFeedScreen.tsx:233-253` dish link lacks a button role/name and `:370-444` safety/share/save actions have no 44pt min target. `components/review/StarRating.tsx:26-28` exposes an adjustable role/value without increment/decrement accessibility actions, and neither its buttons nor `ReviewStars.tsx:20-24` expose selected state. The review target picker is a plain absolute View (`ReviewScreen.tsx:379-382`) without modal focus containment/background hiding. Dormant QuickReview dish/star Pressables (`QuickReviewSheet.tsx:150,216`) and MusicSelection play/bookmark/back controls omit roles/names. Shared modal wrappers include several useful names, so this is not a blanket “no accessibility” claim.

**Recommendation / owner:** accessibility/media owner: name every icon, provide selected/value semantics and real adjustable actions or a consistent radio-like star group, use 44pt targets, modal initial/return focus and keyboard-safe sheet layouts. **Close:** VoiceOver/TalkBack complete select/rate/edit/remove/publish/share flow; large type, small-screen keyboard, landscape, Reduce Motion and focus restoration. No numeric contrast or visual certification claimed from source alone.

### RP-14 — P2 — Dormant Quick Review reports success without submitting a review

**Class:** confirmed support implementation defect; **no present production entry caller found**. **Evidence:** `QuickReviewSheet.tsx:48-49` sets user-mode success to step 3; the rating Next button goes straight there (`:256-259`), skipping any submit handler. In merchant mode, `handleSubmit` only optionally submits developer OCR then delays/awards local points (`:99-128`); it never calls `reviews.submitReview`. “Share this review” merely invokes the same dismissal callback as Back to stall (`:430-433`). Menu errors leave “Loading menu…” indefinitely (`:67,178-182`). `RootNavigator.tsx:424-432` hosts the modal, but full source search finds only showQuickReview definition, no invocation.

**Recommendation / owner:** review owner: keep unreachable until it shares the real review transaction, restore submit/retry/error states and a truthful success/share result. **Close:** activate only in a controlled test, verify actual stored review once, no success on failure, and guest auth gate. Do **not** count this dormant defect as an ordinary production funnel blocker.

### RP-15 — P2 — Prototype “Save Draft” discards the draft it claims to save

**Class:** confirmed gated-prototype data-loss defect. **Evidence:** `PostComposerScreenV2.tsx:254-261` sets a “draft” status then resets and exits after 1.5s; `features/post/useComposerStore.ts:115` is a plain nonpersisted Zustand store. `StatusOverlay.tsx:186-188` claims local drafts were saved, while its Finish Later action also resets (`:202`). Bottom Save Draft only sets status (`ComposerBottomBar.tsx:216-222`).

**Recommendation / owner:** composer engineer: implement account-scoped persisted draft records/resume UI before advertising Save Draft, or remove the misleading action. **Close:** save→exit→reopen/process-kill on both tabs, media/metadata restoration, A/B isolation and failed storage. Current exit regex test passes while missing this behavior.

### RP-16 — P2 — Prototype scheduling and metadata imply effects missing from publication

**Class:** confirmed gated-prototype wiring defect and mixed copy. **Evidence:** `ComposerBottomBar.tsx:79-91` stores only a local Date and sets scheduled status; `StatusOverlay.tsx:96` says “Post Scheduled!” although its body accurately says time is saved only to the composer. `features/post/publishing.ts:130-147` immediately calls postBite and sends none of `scheduledTime`, `collaborators`, selected `location`, music, CTA or sponsorship metadata. The Supabase path writes `published_at=now` (`supabaseService.ts:3704-3713`).

**Recommendation / owner:** product/composer/backend: either make unsupported controls explicitly preview-only or implement reviewed semantics, especially publication timing, collaborators' consent and sponsorship disclosure. **Close:** scheduled time never immediately publishes, canceled schedule does not persist incorrectly, selected metadata is actually stored/rendered, and no simulated AI “best time” claim is represented as empirical. Beta-only; no demand to ship all these features in MVP.

### RP-17 — P2 — Soundtrack playback/selection is a simulation that cannot attach music

**Class:** confirmed prototype-path functional mismatch. **Evidence:** `MusicSelectionScreen.tsx:29-119` defines inline mock tracks with no audio URI, `:230-244` increments a timer rather than using an audio player, and `:470-475` Select only calls goBack; no `setMusicId`/review-draft write exists. Save bookmarks are local component state. ReviewScreen intentionally does not send music/video to backend and gates its entry buttons to prototypes (`:35-37,249-276`). Root still registers MusicSelection unconditionally, but no normal production caller/deep-link mapping was found.

**Recommendation / owner:** review/media owner: remove from customer paths or label simulation; only build real selection/playback/persistence with rights cleared if approved scope requires it. **Close:** selected ID returns to draft, actual controlled audio starts/stops/cleans up and rights/license source is recorded; or prove the route remains inaccessible in production.

### RP-18 — P3 — Contribution design drifts from the concise food-first brief

**Class:** reasoned product/design critique, not a proven runtime bug. **Evidence:** the approved quick-review prototype foregrounds dish→rating→taste tags, optional note; current `ReviewScreen.tsx:215-225,314-347` starts with media/editing and hides taste tags for ordinary users. `PostComposerScreenV2.tsx:144-228` adds AI Creator Suite/preview abstractions that the composer design brief explicitly discourages. Recommend/Skip in `ReviewScreen.tsx:350-363` conflates neutral omission with the false boolean passed to storage; initial false is deliberate and tested, so changing it needs product agreement.

**Recommendation / owner:** product/designer: test a short dish-first/rating-first flow and clarify Recommend vs Not recommended vs No answer; keep media optional for reviews and avoid adding creator tooling to MVP merely to match competitors. Preserve existing low-friction optional text and visible dish context. **Close:** approved current design and timed usability sessions on actual devices; do not claim the promised 30-second completion time from code.

### RP-19 — P2 — Review blocking inherits the shared identity flaw and does not filter the current review feed

**Class:** shared safety defect; canonical cause is Home report **HS-01**, avoid duplicate blocker counting. **Evidence:** `ReviewFeedScreen.tsx:382-399` passes authorName/reviewId only to promptBlockReviewAuthor; shared `communitySafety.ts:26,82` uses a normalized display-name key where backend block checks use UUIDs. The feed's `filteredReviews` (`:685-695`) filters text only; no session hidden/blocked-author set is applied here, unlike some home surfaces. A success dialog therefore does not establish removal/enforcement.

**Recommendation / owner:** trust & safety/backend/feed: pass canonical author IDs, use policy-consistent review reads and immediately hide blocked author's items with rollback/retry on failure. **Close:** A blocks B, B rename/same-display-name C, warm/cold/feed/detail/anonymous checks against the intended staging schema. No external abuse-reporting or live policy mutation performed.

## State, data, security and performance review

| Area | What is actually good/checked | Remaining evidence or scope |
|---|---|---|
| Authentication/authorization | Root protects Post/ReviewStack; main review returns null and redirects when unauthenticated; service checks current Supabase user before writes | Expiry mid-upload, remote owner policies and guest return with exact dish/draft need staging/native proof; RP-01 is still a client privacy gap |
| Publish/retry | Shared publishing requires an explicit dish and checks dish/venue consistency; review retry reuses a client UUID; errors preserve main review draft | RP-04 bypasses explicit-choice intent upstream; RP-07 is partial publication. Post insert uses a new draft ID each call, so ambiguous commit response/idempotency and abandoned draft/media cleanup need failure-injection coverage; not established as an observed duplicate incident |
| Media/permissions | Permission explanation exists, production Post supports image/video and review hides unsupported video/music; caption/text are bounded/sanitized | RP-06; picker request/launch rejection is not caught locally (`PostComposerScreen.tsx:146-168`). No real media upload, compression-size, EXIF/location retention, background upload or rights proof was exercised; preview-only styling is not edited-media persistence |
| Feedback/empty/error | Review Feed distinguishes first-load error and no reviews, offers Retry and pull refresh; main Post/Review use busy Buttons and catch publish failures | Cold Post picker has false empty; dormant Quick Review has endless loading on error; no upload percentage/cancel/resume. A refresh error with existing feed data has no visible full error because error component is only ListEmptyComponent |
| Persistence/races | Main review persist + same-dish no-op reduce accidental clearing; service feed load IDs suppress old responses | RP-01/03/05/15; asynchronous session change/unmount during publish can still write UI/profile state for the wrong current identity and needs a generation/owner guard test |
| Scale/performance | Production review feed uses one bounded recent-review service request and FlatList, avoiding N+1 per-dish review fetches | Production Post traverses whole cache and renders up to 12 Cards in a ScrollView; review picker enumerates all venues every render. Server search/pagination is required for real catalog size; no latency/memory benchmark run |
| UGC/privacy | Report/block controls are exposed and shared safe-link helpers are used for messaging | Shared block issue RP-19; review audience disclosure, owner edit/delete entry after publication, moderation response, public/private-profile semantics and SDK/media disclosures require product/backend QA. This review did not invent a legal compliance verdict |
| Visual/accessibility | Shared tokens, named common Buttons and several modal/backdrop accessibility labels exist | RP-13; no inspected current screenshot, screen-reader, large-type, dark-mode, motion, dynamic device-size or pixel contrast proof for this area |

## Honest comparison with current first-party documentation

These are documented interaction comparisons, **not hands-on competitor app tests**. Sources checked 20 October 2026. Search also returned secondary/noncanonical pages and a canonical TikTok URL fetch error; only the first-party sources below support the comparison.

- **Google Maps:** current help documents explicit place selection, stars/optional text/photo, finding/sharing one's review, and editing/deleting it later. It also clearly explains review public visibility. Hungry's dish-level association is more precise for comparing what to eat, and optional text is a good fit for hawker visits. Maps' documented ownership/lifecycle is clearer than Hungry's source path with partial publication, no evident edit/delete affordance in these pages and review-share links that resolve only to a dish. Keep dish context; add accountable receipt/management and explicit audience. [Google Maps review help](https://support.google.com/maps/answer/6230175?hl=en), [Maps contribution visibility](https://support.google.com/maps/answer/9514690?hl=en).
- **TikTok:** first-party help distinguishes posting from saving a draft, explains drafts remain unavailable to others until posted, and says drafts cannot transfer between accounts. Hungry should match that basic boundary without copying the creator feature stack: real save/resume and account isolation matter more than mock soundtrack/AI/scheduling. Hungry's restrained production Post is closer to its brief than the V2 suite, but needs draft protection. [TikTok editing/posting/drafts help](https://support.tiktok.com/en/using-tiktok/creating-videos/editing-posting-and-deleting?lang=id) (first-party indexed text read successfully; canonical URL redirected to an inaccessible FAQ in this tool).

My assessment: the dish-first idea has a defensible advantage; the contribution lifecycle currently falls below these documented reliability patterns. “No errors” and “30-second flow” would be unsupported claims. Increasing features would worsen this until selection, draft ownership, publication truth and failure recovery are reliable.

## Verification and prioritized closeout

Exact focused command (exit 0, **19/19 pass**, no skips):

```sh
HUNGRY_DATA_SOURCE=mock HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/app/screens/review/review-posting-contracts.test.ts src/app/screens/review-feed-bites-contracts.test.ts src/features/review/reviewDraft.test.ts src/features/post/publishing.test.ts src/app/screens/post-composer-exit-contracts.test.ts src/features/post/post-composer-overlay-contracts.test.ts
```

Most screen checks are regex contracts; publishing/draft tests exercise mock store/service behavior. They do not cover Supabase/native failures identified here. The command emitted Node `DEP0205 module.register()` warnings. An isolated Node/tsx script with the same mock/storage-disabled environment exercised the actual review store and `clearSession()` and printed `{isAuthenticated:false,draftSurvived:true}`; it reset that process's draft afterward, wrote no persistent user state and made no provider call. Some exploratory reads used nonexistent guessed paths and returned file-not-found; corrected to `src/hooks/useAppBootstrap.ts` and `src/lib/services/supabase/mediaUpload.ts`, with no app mutation.

1. Session/mobile owner: close RP-01 with actual A/B isolation tests before release.
2. Contribution/discovery owner: close RP-02, preserve production post drafts (RP-03), require explicit target choice (RP-04), and protect change-dish edits (RP-05).
3. Media/backend/review owner: make edited output real, stage media before publication, and show only truthful success/reward outcomes (RP-06/07/08).
4. Feed/share/accessibility owners: correct query/cursor/share-target/safety semantics and device accessibility (RP-09–13/19); use HS-01 as the canonical shared block cause.
5. Product/prototype owner: keep RP-14–17 dormant/gated until real semantics exist; approve a concise current review design before expanding the creator suite (RP-18).

Independent cross-review is still required. This report does not mark the application release-ready or these findings remediated.
