# Home, activity, messaging and stories expert audit

Reviewer: home/social UX designer, accessibility reviewer, social safety/backend engineer and debugger. Date: 20 October 2026 (Singapore). Scope: all **7/7** `home-social` manifest TSX files, current dirty source based on HEAD `50b2223e3ee058618bc23db48a97fb9fafac41ee`. Audit only; no app implementation edits.

## Decision and evidence boundary

**No-Go for release sign-off of this area from the reviewed evidence.** Production Home/activity have an identity mismatch in blocking plus substantive navigation, sharing and recovery defects. DMs, comments and stories remain correctly excluded from default production registration; the findings on those surfaces block their future enablement, not the current MVP merely because their files exist.

Actual reachability: `src/constants/featureFlags.ts:34-65` disables DMs/comments/stories in production; `RootNavigator.tsx:721-727,750-761` always registers ActivityInbox/ActivityPostDetail and conditionally registers chat/story routes. `SwipeableTabNavigator.tsx:187` mounts Home with `mode="social"`.

Read startup pointers and release-readiness skill/gates; this report supplies area evidence to the root release/policy review. It does not establish store compliance, deployment, installed-binary behavior, signed-in staging permissions or live moderation operations. No screenshots were inspected, no simulator navigation/build was performed, and no live database was mutated. Visual findings below are source/design critiques pending rendered review.

Governing design read **before screen source**: `design/figma-v2/home-feed.html`, notably the recommendation at lines 63-74 and its constraint at line 20 that post actions support food decisions. It provides multiple variants, not a demonstrated final selection for every current control. No specific approved activity inbox, standalone DM, chat, story creation or story viewer design was located by the scoped design inventory; fidelity for those pages is an explicit gap. Shared accessibility/offline specs were discovered; implementation was inspected against functional state requirements. An independent cross-review is scheduled by the root, not claimed complete here.

## Per-file coverage

| File | User purpose / reachability | Design and inspected paths | Findings / unverified runtime |
|---|---|---|---|
| `src/app/screens/home/HomeFeedScreen.tsx` (2,765 lines) | Discover community dishes, follow, react, save/share; production social mode | Home HTML variants; read complete screen, both card variants, headers, FlashList, gestures, share/comments sheets, auth/flags, load cancellation, stores, feed transforms | HS-01–07, HS-10, HS-13, HS-19, HS-20. Large text, image gestures, pagination performance, keyboard/footer and refresh races need runtime proof. |
| `src/app/screens/home/ActivityInboxScreen.tsx` (636) | Updates plus optional Messages tab; production updates | No dedicated design located; complete tabs, effect/focus fetch, target lookup, read acknowledgement, timestamps, row/badge styles | HS-08–10, HS-19, HS-20. Live private/blocked/missing target resolution and read persistence unverified. |
| `src/app/screens/home/ActivityPostDetailScreen.tsx` (452) | Open the post referenced by an update; production | Feed HTML is partial reference; complete sync resolution, update lookup, interaction actions, comments/share sheets, unavailable path | HS-01, HS-04, HS-08, HS-11, HS-19. Deep-link cold cache, hide/block visibility and compact-width layout unverified. |
| `src/app/screens/home/DirectMessagesScreen.tsx` (182) | List and search conversations; gated beta | No dedicated design; complete fetch/lifecycle guard, search, rows, missing identity filtering/error/empty | HS-12, HS-19, HS-20. Focus refresh, offline retry, long inbox and accessibility targets unverified. |
| `src/app/screens/home/ChatDetailScreen.tsx` (429) | Read/send text and receipts; gated beta | No dedicated design; complete parameter validation, initial load/realtime order, send/draft lifecycle, error and keyboard layout; service/RPC/RLS reviewed | HS-13–15, HS-19, HS-20. Two-client delivery/read races and keyboard/scroll position unverified. |
| `src/app/screens/home/AddStoryScreen.tsx` (292) | Choose media and publish story; gated beta | No dedicated design; complete gallery load/filter/selection, submit lock, footer, image/video preview, store/service | HS-16–18, HS-19. Real library permissions/upload, progress and exit-during-upload unverified; service is local seed/cache. |
| `src/app/screens/home/StoryViewerScreen.tsx` (807) | Watch/advance/react/reply; gated beta | Home rail is only partial reference; complete playback queue, media readiness, transitions, seen timers, gestures, reduce motion, missing-story path, reply/share | HS-14–18, HS-19. No runtime proof of media playback, screen-reader focus, background pause or expiry during playback. |

## Findings, highest priority first

### HS-01 — P1, confirmed safety identity defect, production

**Location:** `HomeFeedScreen.tsx:1321-1329`; `src/lib/security/communitySafety.ts:72-88`; `supabaseService.ts:4351-4354`; `supabase/migrations/0041_full_audit_social_safety.sql:59-66,129`.

**Trigger/consequence:** Block a normal post author whose display name is not their UUID. The screen passes only `authorName`; the helper normalizes that display name and stores it as `user_blocks.blocked_user_key`. SQL's `app_user_block_exists` compares that field with the other user's UUID string. The success alert and immediate local name filtering can therefore conceal a block that does not activate server privacy/chat enforcement. Equal display names can also hide the wrong person's content locally; renaming evades the local key. Source-level mismatch is confirmed; an authenticated staging exploit was not run.

**Change/owner:** Social safety + backend: pass canonical author ID throughout block/report interfaces; require it for account blocks, migrate legacy name keys carefully, make local filtering account scoped, and use identity rather than display name. **Close with:** two actual accounts; block/read-back contains target UUID; blocked author's post reads and chat sends fail after restart/rename; an unrelated same-name account is unaffected.

### HS-14 — P1 for enabling public messaging/stories, confirmed missing safety entry points; gated beta

**Location:** complete `ChatDetailScreen.tsx` and `StoryViewerScreen.tsx` (no report/block/mute control); `StoryViewerScreen.tsx:523-539`.

**Trigger/consequence:** Receive abusive text/story in those viewers. These pages expose no direct report/block control. A story reply fabricates `story-<display-name>` as a conversation ID rather than calling `chat.openConversation` with author identity; the UUID-backed chat path cannot use it as a real target. This is a functional reply failure as well as an unsafe enablement state. Root owns exact store-policy classification; no claim of policy compliance is made here.

**Change/owner:** Messaging/social safety: identity-backed open-conversation flow plus report/block controls in context and explicit contact controls before enabling. **Close with:** two real beta accounts; story reply opens the correct authorized conversation; block prevents further contact and message/story reports reach the moderation path.

### HS-16 — P1 privacy barrier before story enablement, confirmed account-unscoped cache; gated beta

**Location:** `src/store/useStoryStore.ts:73-82,286-289`; `src/store/useSessionStore.ts:101-116`; `supabaseService.ts:814-827,3792-3798,3860-3880`.

**Trigger/consequence:** A creates/views stories, signs out, B signs in on the same installation. Entire story store persists under one key with `isOwn`, media and seen state, and account clearing omits it. Supabase-mode stories are additionally a process-global seed/cache built from the first profile, with no account key. B can inherit A's locally cached own-story identity/media/interaction state. This is cached local information exposure, not proof of cross-account server access.

**Change/owner:** Session/storage + stories service: reset and namespace stories/caches by verified account, guard pending responses by account generation, replace seed cache with a real permissioned service before shared stories launch. **Close with:** A/B switch and restart test with distinct private media and viewed/own-state; B never sees A's cache and late A responses cannot repopulate it.

### HS-02 — P2, confirmed missing task path, production

**Location:** `HomeFeedScreen.tsx:971-1041,1480-1531,1648-1725`; compare `:901-929,1739-1757` and design HTML `:20`.

**Trigger/consequence:** Find a dish in a normal populated Home social card and try to inspect its price/reviews/stall. Single media taps intentionally stay in the feed (or move the carousel); food title/location are plain text for consumer mode. `navigateToDish` is called by the review card variant, not the social card. The visible social card offers profile/follow/reactions but no direct related dish/stall action. Weekly picks/empty fallback provide other food routes, which does not complete the chosen card's task.

**Change/owner:** Home product/frontend: keep the requested double-tap media behavior and add an explicit dish/stall text action or food-context CTA. **Close with:** production consumer can open the exact card dish/stall in one clear action with VoiceOver and touch; verify missing dish uses the venue.

### HS-03 — P2, confirmed misleading sharing, production

**Location:** `HomeFeedScreen.tsx:708-722,2517-2534`; compare `ActivityPostDetailScreen.tsx:286-296` using `webShareUrl`.

**Trigger/consequence:** “Copy link” copies `dish - Hungry: venue`, with no URL. External Share similarly omits a post URL, and increments the share metric even when the native share resolves as dismissed. Recipients cannot reopen the selected post. A rejected native share promise is also uncaught by the `void` event handler.

**Change/owner:** Home/sharing: reuse the canonical URL builder and shared outcome/error handler; report success/count only on the appropriate result, add copy acknowledgement. **Close with:** paste and open the actual copied URL; cancel sharing leaves count unchanged; forced native failure yields recoverable feedback.

### HS-04 — P2, confirmed save-state inconsistency, production

**Location:** `HomeFeedScreen.tsx:806-817`; `ActivityPostDetailScreen.tsx:309-319`; `useSocialStore.ts:237-281`.

**Trigger/consequence:** Save two posts about the same dish, or save a post whose dish was already favourited. Home independently toggles the post saved flag and the dish favourite. The second save can remove the dish favourite while both posts show saved. Backend post-save rollback does not roll back the separately toggled dish. Activity detail saves only the post, creating another entry-point difference.

**Change/owner:** Saved-state/domain frontend: decide whether the action saves the post or dish; use idempotent setters and a single defined relationship rather than independent toggles. **Close with:** pre-favourited dish, two posts/same dish, detail-vs-feed action and failed post write maintain the documented state.

### HS-05 — P2, confirmed unrecoverable truncated caption, production

**Location:** `HomeFeedScreen.tsx:1648-1725`.

**Trigger/consequence:** A long caption overflows with comments disabled. The text is limited to two lines and may advertise “more”, yet that branch is plain AppText with no expand/detail action. Users cannot read the full content; with comments enabled the same cue opens comments rather than an actual inline expansion.

**Change/owner:** Home UX/frontend: independent accessible “Read more” expansion/detail action regardless of comments gate. **Close with:** long captions at default/large text and production flags remain completely readable and collapsible.

### HS-06 — P2, confirmed load-state contract gap, production

**Location:** `src/features/social/sharedStallPosts.ts:34-49`; `HomeFeedScreen.tsx:492-518,2089-2100`.

**Trigger/consequence:** The remote bites request fails and cached repository content is empty, or stale content exists. Shared-post loading catches individual service failures and returns empty/cache data without error metadata; Home can show “No posts yet”/ready instead of the available retry state. A real community with unavailable data looks empty. Home's preserved-ready refresh failures similarly set `feedError` but show no refresh error acknowledgement in the ready branch.

**Change/owner:** Feed service/frontend: distinguish valid empty, partial cache and network failure; retain content with a stale/retry message. **Close with:** initial offline cold cache, partial-service outage and failed pull-refresh demonstrate distinct states without discarding known data.

### HS-07 — P2, confirmed misleading local activity, production

**Location:** `src/store/useSocialStore.ts:196-209`; `HomeFeedScreen.tsx:286-302`; `ActivityInboxScreen.tsx:67-81,123-125`.

**Trigger/consequence:** Like another person's UUID-backed post. `toggleLike` always queues a local “liked your post” update using the current actor name, with no recipient ID or mode restriction. It is merged into the current user's production inbox and counted even before backend success; a failed like rolls back the interaction but leaves its notification. The user is notified as though their own post received engagement.

**Change/owner:** Social frontend/backend integration: let authoritative recipient-scoped activity drive production notifications; restrict demo synthesis to mock mode or provide verified recipient identity and rollback. **Close with:** A likes B's post; only B receives a server-confirmed update, A's inbox stays unchanged, failed reaction produces none.

### HS-08 — P2, confirmed incomplete activity destinations, production

**Location:** `useActivityStore.ts:87-108`; `ActivityInboxScreen.tsx:386-413`; `ActivityPostDetailScreen.tsx:40-46,122-131`.

**Trigger/consequence:** Open a new-follower or reply notification, or a post not present in the synchronous repository cache. The mapper discards non-post targets by setting `postId=""` and labels followers as shares. Rows search only `repository.listStallPosts()`, mark the update read first, and silently do nothing if unresolved. Detail likewise uses only the synchronous list with no by-ID loading, so cold/cache-miss links can falsely say unavailable. Cache misses must not be represented as deletion.

**Change/owner:** Activity/navigation + service contracts: retain discriminated target type/ID, route follower to actor profile, resolve comment to its parent, fetch post by ID; acknowledge read only with a defined resolution outcome. Reuse the parent `postById` instead of per-row scans. **Close with:** follower, post, reply, missing/deleted/private post and cold-start fixtures all produce their correct destination or explicit recovery.

### HS-09 — P2, confirmed missing inbox error/retry state, production

**Location:** `useActivityStore.ts:110-114`; `ActivityInboxScreen.tsx:153-172,482-484`.

**Trigger/consequence:** Notification service/auth request fails. Store logs a warning and replaces existing events with `[]`; the updates screen has no loading/error/retry prop, so it shows “No updates yet” and loses previously visible content. Mount effect plus focus effect also issue duplicate fetches without a generation guard, allowing an older response to win.

**Change/owner:** Activity store/frontend: preserve last good data, expose status/error/retry, use one focus-driven fetch or deduplicate with generation/account identity. **Close with:** delayed/out-of-order success/failure, offline and expired-session scenarios show stable content and explicit retry.

### HS-10 — P2, confirmed unread-accounting mismatch, production; gated DM adds another stale source

**Location:** `HomeFeedScreen.tsx:286-302,337-340,608-629,1077-1079`; `ActivityInboxScreen.tsx:123-125,198-208`.

**Trigger/consequence:** Account-scoped local activity for a different recipient exists (story store can generate it in beta). Inbox filters recipient while Home unread computation does not; counts disagree. Home fetches DB activity on mount and chat unread only on mount/share-open, so returning after reading a chat may leave a stale bell badge. Production self-generated activity in HS-07 compounds the problem.

**Change/owner:** Activity/frontend: one recipient-scoped store selector for both counts, focus/realtime refresh with deduplication, read acknowledgements and errors. **Close with:** same account/unread counts across feed/inbox, read a conversation then return, switch accounts, background/reconnect.

### HS-11 — P2, confirmed safety feedback does not update detail, production

**Location:** `ActivityPostDetailScreen.tsx:243-253`; `communitySafety.ts:81-88,100-105`.

**Trigger/consequence:** Hide a post or block its author while viewing activity detail. Unlike Home, this screen supplies neither removal callback, so the success alert leaves the targeted content visibly in place. The hidden sets are non-reactive; its memo does not rerun merely because a helper Set changes. HS-01 separately governs whether the account is actually blocked.

**Change/owner:** Activity frontend: close/remove detail on successful hide/block and centralize reactive safety state. **Close with:** action immediately removes the viewed content and it remains absent across eligible entry points after reload.

### HS-12 — P2, confirmed nonfunctional search and stale standalone inbox, gated beta

**Location:** `DirectMessagesScreen.tsx:32-54,79-83`.

**Trigger/consequence:** Type a name/message; the Input has no `value`/`onChangeText` or filtering. Conversations load only on mount, so returning from a send/read keeps old preview/time with no refresh/retry. The separate Activity Messages tab implements another list behavior, increasing inconsistency.

**Change/owner:** Messaging frontend: implement a bounded accessible search with empty results, or remove the affordance until ready; share one conversation list/query and refresh policy. **Close with:** actual query filters seeded conversations, clear restores, failed load retries in place and new messages update both lists.

### HS-13 — P2, confirmed realtime/history race and recovery gaps, gated beta

**Location:** `ChatDetailScreen.tsx:85-115,130-137,232-284`; `supabaseService.ts:4187-4210,4266-4310`.

**Trigger/consequence:** An INSERT arrives while `listMessages` is pending: realtime appends it, then the load replaces the entire array with its earlier snapshot. A locally sent response can be overwritten likewise. ID dedupe only protects appends; it does not merge initial history. Messages/receipts have no chronological reconciliation beyond append. Realtime error is permanent loadError with no reconnect/retry control, and chat has no automatic scroll-to-latest or new-message affordance. Sending uses a new timestamp nonce on each attempt; if RPC commits but participant hydration fails, the user sees “not sent”, and retry may duplicate it.

**Change/owner:** Chat service/frontend: merge a generation-bound snapshot with buffered events, sort/dedupe IDs, preserve stable client nonce for retry, separate connection status from history load, show retry and intentional latest-message scrolling. **Close with:** two-client test with deferred history, simultaneous sends, out-of-order receipt, post-commit hydration failure and reconnect; no loss/duplicates and accessible latest-message announcement.

### HS-15 — P2, confirmed draft loss and uncaught read-ack failures, gated beta

**Location:** `ChatDetailScreen.tsx:50-55,89,103,124-140`; `DirectMessagesScreen.tsx:116`; `ActivityInboxScreen.tsx:318-320`.

**Trigger/consequence:** Type a message, go back/unmount and reopen: draft exists only in component state and is lost with no warning. Send failure preserves text, which is good. Several `void markConversationRead` calls have no rejection handler even though the service explicitly throws on participant/receipt failure; unread is locally cleared before acknowledgement in Activity. There is no failed-read state/retry.

**Change/owner:** Chat/activity frontend: per-account/per-conversation draft persistence or explicit discard behavior, catch/read retry and reconcile authoritative counts. **Close with:** leave/reopen/relaunch draft case; acknowledgement failure and recovery; no unhandled promise or false read state.

### HS-17 — P2, confirmed story media/reduce-motion failures, gated beta

**Location:** `StoryViewerScreen.tsx:82-88,190-201,350-357,429-434,542-552,563-570`; `AddStoryScreen.tsx:117-133`.

**Trigger/consequence:** Select a video: both preview and StoryMedia always use AccessibleImage with its URL; content type never reaches a video player. With Reduce Motion, `startProgress` immediately sets progress to 1, which the completion reaction turns into next-story/close; reduced animation changes viewing duration to effectively zero. An empty/failed story load renders an indefinite spinner with no close/retry. Failed media is declared ready after 1.2 seconds and can become seen despite never displaying. Viewer lacks an explicit accessible close/pause control and focus/background pause handling.

**Change/owner:** Stories/native accessibility: real type-aware player and media-error state; keep duration or make progression manual with reduced motion; explicit close/pause/retry; pause off-focus/background. **Close with:** real video, invalid URL, empty/error load, Reduce Motion, VoiceOver/TalkBack, app background and chat navigation; no forced skip or false seen state.

### HS-18 — P2, confirmed story publication/gallery semantics, gated beta

**Location:** `AddStoryScreen.tsx:30-50,57-59,61-79,149-166`; `useStoryStore.ts:229-242,260-280`; `supabaseService.ts:3796-3798,3860-3880`.

**Trigger/consequence:** “Gallery” loads static service assets rather than the user's media library, without a loading/empty/retry explanation. Filtering Photos/Videos can leave the selected preview from the hidden opposite type because selection is looked up in the complete gallery first. Posting reports success but Supabase-mode implementation only changes the local cache, replacing the previous own story; no cross-device publication exists. Seen tracking groups by displayName and marks all matching stories seen, including unseen siblings or another same-name author. Share similarly increments a local cache metric and says shared without a destination.

**Change/owner:** Stories product/service: label as demo until genuine upload/publication exists; make filtered selection deliberate; support per-story identity/seen state and destination-backed sharing. **Close with:** filter/selection matrix, actual library denial/empty cases, two-device publish/view/share and duplicate-display-name stories. Keep all this gated until those contracts exist.

### HS-19 — P2, accessibility correctness gaps with runtime measurements outstanding

**Location:** `HomeFeedScreen.tsx:1410-1431,1703-1720,2266-2279`; `ActivityPostDetailScreen.tsx:309-365,430-441`; `DirectMessagesScreen.tsx:65-72`; `ChatDetailScreen.tsx:355-357`; `StoryViewerScreen.tsx:195-197,582-599`.

**Trigger/consequence:** Screen-reader user activates feed “Open media” yet the production tap is intentionally inert (except carousel navigation); long caption's “more” is unavailable in production. Activity detail like/save labels never describe selected/unlike/unsave state, unlike Home. DirectMessages/Chat back affordances are bare 28px icons without expanded targets; detail action row uses a non-wrapping author+icons layout that warrants 320px/large-text overflow checks. Comment Post/Reply/avatar controls omit explicit roles/labels in several places. Story playback and close problems are HS-17. Colors/font scaling cannot be certified by source alone.

**Change/owner:** Accessibility + page frontend: accurate action semantics, selected state, at least platform-appropriate expanded touch targets and responsive rows; structured screen-reader/focus/large-text review against the approved design. **Close with:** VoiceOver/TalkBack, 200% text, compact width, keyboard and dark/light contrast evidence. Do not interpret these unmeasured layout concerns as demonstrated clipping.

### HS-20 — P2, test evidence gaps conceal confirmed defects

**Location:** `src/app/screens/activity-production-contracts.test.ts:34-42`; `src/app/screens/story-viewer-contracts.test.ts:1-180`; `src/lib/services/supabase/chat-service-contract.test.ts:1-135`.

**Trigger/consequence:** All checked tests pass, yet the “avoid per-row scans” contract merely forbids `posts.find`; `UpdatesTab` still performs `repository.listStallPosts().find` for every row. Story contracts require strings that include a loading spinner and fabricated chat navigation, not successful playback/reply. Chat contracts prove service method/table names, not race ordering or live authorization. Passing them is useful coverage, but not behavior/release proof.

**Change/owner:** QA + feature owners: add focused behavioral tests for HS-01–18 with deferred services and actual user outcomes; signed staging multi-user permission/abuse smoke and native accessibility/media checks before enablement. **Close with:** tests fail on the current defect and pass on remediation, plus exact-build runtime evidence.

## State, backend and operational coverage

| Area | What was checked / source-supported strengths | Remaining proof or defect |
|---|---|---|
| Production gates/auth | Actual flags + route registration, protected feed reaction guard, invalid chat ID fail-closed UI; no promotion of gated beta defects to MVP blockers | Installed production config/build and deep links not executed. |
| Home loading/ready/empty/error/refresh | Request generation guard, dedupe, FlashList, cached preload, native refresh keeps ready content, retry screen, contextual empty dishes | HS-06; no long-feed memory/device trace; no pagination contract for growing feed. |
| Like/save/follow | Shared interactions + optimistic rollback for UUID post reactions; canonical author IDs for follow when available | HS-04/07; rapid-toggle ordering and old-account in-flight responses need behavioral tests; no user-facing failure toast for several store console-only failures. |
| Activity | Server `activity_events` reads, mark-read RPC, local read-key persistence, production DM tab suppression | HS-08–10; ISO timestamp/UUID target presentation is raw and less readable; server polling/realtime freshness, deletion and RLS need signed proof. |
| Chat | List/open/message/receipt methods; checked open/send RPC; RLS intent via SQL; unsubscribe cleanup; ID append dedupe; text preserved after rejected send | HS-12–15; unbounded all-message load (`supabaseService.ts:2766-2782`) and ScrollView mapping need pagination for history; no live two-client proof. |
| Comments/replies | Shared store counter and server createComment bridge, flags hide public entry points, safety menu present | Optimistic failures log only and preserve false posted comment/count; draft cleared immediately (`HomeFeedScreen.tsx:872-890`, `useSocialStore.ts:483-485,552-554`); no retry/failed state. Enabling blocker at P2; fold into HS-06/20 remediation and test matrix. |
| Stories | Fixed playback queue, unsubscribe/timer cleanup, persisted seen TTL, own-story create action separation, optimistic like rollback | HS-14/16–18; no backend story publication/privacy enforcement, no video playback proof. |
| Report/hide/block | Checked service calls and success/failure alerts, SQL moderation/privacy predicates exist | HS-01/11/14; live moderation queue/response ownership, account-reset safety sets, Android safety-menu actions and report receipt workflow need independent root checks. |
| Offline/recovery | Feed retry and send-failure alert exist; context-specific unavailable chat target exists | No offline queue, per-message failed status, draft survival or connection recovery proof. Avoid claiming offline writes are durable. |

Focused read-only check executed:

```sh
HUNGRY_DATA_SOURCE=mock HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/app/screens/activity-production-contracts.test.ts src/app/screens/story-viewer-contracts.test.ts src/features/home/feed.test.ts src/lib/services/supabase/chat-service-contract.test.ts
```

**Result:** exit 0; 23 passed, 0 failed, 0 skipped. Terminal emitted Node `[DEP0205] module.register()` deprecation warning from test tooling. This was not a clean “no warnings” terminal and is not a simulator result. Feed tests include callable ordering/cache behavior; most page/chat contracts read and regex source. No broad suite/build was run by this agent. Root-owned `runtime-evidence.md` separately records current-source typecheck failure and full suite failure (692 pass, 1 fail, 2 skipped); those failures concern auth/service-boundary and compilation sources outside this group. Existing installed iOS Discover snapshot lacks current-source equivalence and provides no Home/chat/story acceptance proof. I read that evidence note, not the screenshot, and do not claim a visual inspection.

## Honest comparison with first-party product evidence

Sources opened 20 October 2026. These are documented product patterns, not a claim of hands-on comparative app testing or visual parity.

| Comparator | First-party behavior | Hungry keep / change / tradeoff |
|---|---|---|
| Google Maps | Saving names a concrete place/list and has a defined Saved destination; saved places are private unless a list is shared. [Google Maps Help](https://support.google.com/maps/answer/3184808?hl=en) | Keep a clear food-saving action, but explicitly distinguish saved post from favourite dish (HS-04). Deterministic state and a usable share URL outperform adding more social metrics. Hungry's dish focus can be more precise for hawker meals; that advantage requires a direct dish detail path. |
| Burpple | Describes food discovery through community reviews, editorial content and trending data; photo reviews help other diners. [About Burpple](https://burpple.com/about-us) | Keep food imagery, useful venue context and the weekly dish rail. Current Home's no-direct-dish route and unreadable full captions weaken the actual meal decision. Prefer useful dish price/location/context over four tag pills plus vanity actions; this is a reasoned UX recommendation, not evidence that Burpple's live UI uses a particular layout. |
| Instagram | Meta documents contextual DM safety information and a combined block/report path, especially for Teen Accounts. [Meta safety update](https://about.fb.com/news/2025/07/expanding-teen-account-protections-child-safety-features/) | Keep familiar social gestures when they work, but familiarity is not messaging readiness. Hungry lacks contextual message/story reporting, identity-backed story replies and reliable media/recovery. Do not copy Instagram's breadth; a narrow text-only chat with reliable blocking, drafts and retries is a defensible first version. Teen-specific features are a comparison example, not asserted as a universal requirement for Hungry. |

**Assessment:** Strong prototype foundation: recognisable feed rhythm, warm restrained palette, actual dish/venue association, useful empty-feed fallback, production gating and some optimistic rollback. Production social Home presently favours reacting/following over completing a meal choice, and its sharing/save semantics are less coherent than the documented alternatives. Stories are still demonstrative local functionality despite Supabase mode; chat has a real service/RPC architecture but incomplete user recovery and safety. Rendered typography, visual polish, actual responsiveness and comparative aesthetic quality remain unscored without device evidence.

## Priorities and readiness implications

1. **Production safety:** fix UUID-backed blocking (HS-01), verify on signed staging across reload/rename/two accounts; social safety + backend own this.
2. **Production utility:** explicit dish/stall action, genuine link sharing, deterministic save semantics, independent caption expansion (HS-02–05); Home + saved-state owners.
3. **Production truth/recovery:** authoritative activity recipients/targets, non-destructive fetch failure and consistent unread selectors (HS-06–10); social/activity owners.
4. **Detail safety:** immediate hide/block outcome and by-ID target resolution (HS-08/11); activity owner.
5. **Keep beta gates:** stories require account-scoped real publication, real playback, accessibility and contextual safety; DMs require snapshot/realtime reconciliation, identity-backed replies, report/block, stable retry nonce/drafts, pagination and two-client proof (HS-12–18).
6. **QA ownership:** replace source-string proxies with targeted behavior checks and exact-artifact native/staging evidence (HS-19/20). No risks have been waived by this reviewer. Root must separately complete current Apple/Google policy, runtime, deployment and independent cross-review gates before an overall release decision.
