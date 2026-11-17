# Hungry page expert audit — 20 October 2026

**Source audit complete: eleven specialist reports, all finding cross-checks, and independent artifact QA/QC passed. Public-release verdict: No-Go.** Review only; app code and pre-existing work are preserved.

## What was assigned

Eleven named specialist agents own page areas; each reviews its individual pages and supporting surfaces through product/UX, accessibility, software/debugging, state, backend/data/security, failure/recovery and relevant competitor lenses. A second set of agents independently challenges the findings. Finite agent slots were scheduled in waves; interrupted reviews were resumed after an account usage limit. These are task-scoped agents, not persistent sidebar chats or installed agents.

Coverage is the current app screen directory: **113 TSX files**, comprising 94 Screen-named files and 19 shells/stacks/modals/support components. File count is not a distinct route/page count: some files export multiple routes, and some are supporting UI. Actual route registration and release flags were inspected by each owner. See [coverage manifest](coverage-manifest.json) and [source fingerprints](source-fingerprints.json).

Candidate: current dirty working tree at base HEAD `50b2223e3ee058618bc23db48a97fb9fafac41ee`; this is not a certified build/release artifact. No implementation, provider mutation, push, merge, deployment or store submission was requested or performed.

## Page owners and reports

| Page area | Assigned TSX | Specialist owner | Detailed report |
|---|---:|---|---|
| Login, signup, verification, recovery, splash | 11 | login_auth_expert | [Authentication](auth.md) |
| Welcome, quiz, dietary, results, location | 11 | onboarding_expert | [Onboarding](onboarding.md) |
| Discover, search, filters, Quick Bites, Decide, Crave | 7 | discover_search_expert | [Discover/search](discover-search.md) |
| Maps, dish/stall/catalog detail, claims, recovery screens | 8 | maps_detail_finish | [Maps/detail](maps-detail.md) |
| Home feed, activity, chat, stories | 7 | home_expert | [Home/social](home-social.md) |
| Merchant dashboard, menu, OCR, verification, analytics, team, offers | 16 | merchant_expert | [Merchant](merchant.md) |
| Profile, public profiles, follows, history, favourites, add stall, gamification | 16 | profile_expert | [Profile](profile.md) |
| Settings, privacy, export, deletion, sign-out | 1 | settings_expert | [Settings](settings.md) |
| Review/feed/composer/media/success/share | 12 | reviews_post_finish | [Reviews/posts](reviews-post.md) |
| Lists, portfolios, collaborators, moderation, Wheel | 20 | saved_tools_expert | [Saved tools](saved-tools.md) |
| Reads, article handoff, developer/gallery tools | 4 | reads_dev_finish | [Reads/developer](reads-dev.md) |

Reports include per-file coverage, inspected design sources, strengths and critiques, evidence and confidence, severity, failure/edge states, first-party competitor links, owners and checks to close each finding. A reported omission of a screen-specific approved design is a design-proof gap, not permission to improvise one.

## Honest page-by-page assessment

These are product/source judgments; they are not scores from a user study or a full visual/device inspection. Detailed reports link current first-party competitor documentation and explain the tradeoffs.

| Area | Keep | Change first |
|---|---|---|
| Login/account | Clear email/password route, guest continuation, separate confirmation/reset callbacks | Make validation, preference transfer and recovery trustworthy; remove misleading success actions and protect concurrent requests |
| Onboarding | Dish-led taste setup and manual-location alternative | Preserve taste across the dietary route; never bypass selected needs on zero matches; make progress and verification/location handoffs consistent |
| Discover/search | Recognizable Singapore dish choices and multiple discovery intents | Enforce hard dietary constraints, connect taste controls to real ranking, keep photo/name identity stable and distinguish no results from failed loads |
| Maps/details | Address/directions/menu context, explicit fallback surfaces | Stop fabricated precision and cycling dish identities; make Tried state and public-review safety reliable. Repair filters/credits before exposing the map journey |
| Home/social | Food-forward feed and an activity hub | Turn food discovery into a real dish/stall action; copy usable links; use canonical identity for safety and accurate activity state |
| Merchant | Explicit menu/review work and a drafts-first intent | Make live image editing, resubmission and draft access work; protect trust metadata server-side and correct before publication. These pages are beta-gated |
| Profile | Central taste, saved/history and public identity surfaces | Make email/follow identity truthful, show the selected user's actual social graph, preserve contribution drafts and stop silently submitting unknown hours |
| Settings | Discoverable account/privacy/export/deletion entry points | Remove or implement inert controls; confirm visibility saves, sign-out and deletion cancellation; make every failure recoverable |
| Reviews/posts | Detailed media/review composition tools | Partition drafts across every account transition, await a usable catalog picker, apply actual photo edits, and report partial publication accurately |
| Lists/Wheel | Private-by-default list creation and a simple decision aid | Finish solo-spin resolution, partition account caches, repair portfolio authorization, and clarify Draft/Public/Publish semantics |
| Reads/dev | Source handoff and broad developer inspection tools | Resolve unused Reads routing before claiming a live feature; make cold article loads truthful; distinguish debug state from actual simulated feature/network behavior |

## Independent review

The primary reports preserve original findings; independent adjudication is authoritative wherever it narrows/rejects an original claim. The [finding register](findings-index.json) indexes all 187 raw observations and their independent dispositions. This total includes shared causes, beta/dormant issues, product critiques and evidence gaps; it is not a count of unique confirmed production bugs.

- [Accounts, onboarding, settings, profile](crosscheck-accounts.md).
- [Merchant, backend authorization, saved tools](crosscheck-merchant-tools.md).
- [Discovery, social, maps, Reads](crosscheck-discovery-social.md).
- [Reviews/posts independent adjudication](crosscheck-reviews-post.md).
- [Final audit QA/QC and residual app errors](final-qaqc.md).

## Material corrections from independent review

- Change Password has an Edit Profile entry; the primary no-caller claim was rejected and corrected.
- The public-feed switch is confirmed inert, but its audience semantics are ambiguous; SET-01 is P2, not a demonstrated privacy disclosure.
- Ordinary pushed quiz/password routes can preserve an editor; draft-loss claims apply to actual removal/reset/restart paths. Connections and SocialGrid have initial loading indicators.
- ST-01 is an overbroad private-note authorization path conditional on readable RLS; recursive policies can deny the read first. No deployed note extraction was demonstrated.
- OCR accept-before-edit/batch defects are downstream of the draft-access mismatch; notification rows can exist even when email delivery is unknown.
- Map routes are registered but ordinary consumer Home/Discover entries hide them; map P1s apply to exposing that journey. Reads has a true flag but no active feed entry point.
- Shared privacy/account/cache causes are grouped for remediation; raw finding totals include duplicates, beta issues, product critiques and evidence gaps.

## Current engineering evidence

- TypeScript fails: two Change Password validator-signature errors plus five root-compilation diagnostics from the untracked email Edge Function.
- Source suite: **692 pass, 1 fail, 2 skipped** out of 695. The failing contract flags Change Password importing Supabase internals directly.
- Chrome mock browser route/guest run: **8 pass, 1 fail**. Fresh-entry test expects Login but current source/screenshot show Welcome. An audit-only follow-up confirms Welcome → Sign in: **1/1 pass** at 390×844.
- Existing iOS artifact: Discover renders, but an offline banner obscures the location heading. No matching Hungry error/fault log entries appeared in a three-minute filtered window; a tooling warning occurred. The binary has not been matched to the current source, and full native/Android/assistive-tech/device journeys remain unverified.

See [verification provenance, errors and limitations](runtime-evidence.md) and [release readiness / Apple and Google policy evidence / owners](release-readiness.md). Passing mock/source checks do not establish provider-backed behavior, deployed SQL permissions, native rendering or store acceptance.

## Findings to prioritize

Independent source review supports the following order; native/live closure remains separate:

1. Repair compiler/service-boundary gates and account/session/deletion/privacy correctness. Change Password is reachable from Edit Profile; this is not an unused-screen exception.
2. Preserve quiz answers and enforce dietary constraints across zero-results and entry paths.
3. Repair portfolio/review-draft account isolation, the cold composer picker and the solo Wheel result calculation; resolve portfolio read-policy recursion together with private-note protection.
4. Use canonical identity in blocking, follows and attribution; make visibility controls honest.
5. Restore core task completion: meaningful filtering/ranking, dish navigation, real links, durable media/editor state and actionable errors.
6. Reconcile the governing designs and verify accessibility and native behavior; treat merchant/stories/chat issues as beta-gate blockers where production routes are disabled, while evaluating server authorization independently.

The product has a clear local dish-first proposition and coherent food-forward visual direction in the limited screens inspected. The recurring weakness is that visible controls and trust signals often promise more than their backing state/service paths guarantee. Competitor documentation is used to compare successful user outcomes and recovery patterns; reviewers did not claim hands-on current competitor use.

## Final QA/QC result

Independent final QA passed the audit deliverables: 113/113 screen-area TSX accounted in eleven reports; 187/187 observations independently adjudicated exactly once; 117/117 fingerprinted source paths unchanged; register line pointers and local report links valid; Markdown and scoped canonical-document checks clean. Application checks remain failed and native/live/store acceptance remains unverified. See [final QA/QC](final-qaqc.md). No remediation or release completion is implied.
