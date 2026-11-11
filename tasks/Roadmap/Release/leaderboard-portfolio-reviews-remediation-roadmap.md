# Food Portfolio, Reviews and Leaderboards: remediation roadmap

Status: Accepted by the owner on 2026-11-10 with the recommended defaults. Phase 0 merged (#261). Phase 1 steps 1.1 to 1.5 in review (migration 20261110120000); the delete prompt in 1.4 and the owner check in 1.6 remain.
Source: `tasks/Roadmap/Audit/2026-11-leaderboard-portfolio-reviews-integrated-audit.md` (commit `ecb90e07`, 2026-11-10).

Recommendation in one line: **redesign first (small), then release in stages.** Production holds no posts,
reviews or rankings today, so the model can be corrected without a data migration. That stops being true with
the first public users.

Effort: S under a day, M one to three days, L about a week. Every code step follows the standing rules:
tests, one-statement or locked writes, no query in a loop, error reporting, rate rules, and for each migration
a rollback, a smoke header and a staging rehearsal, shipped to production only with `scripts/db/ship.sh`.

---

## 0. Decisions needed before any work starts

| #   | Decision                            | Recommended default                                                                   | Blocks          |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------- | --------------- |
| D1  | Portfolio model                     | Best by dish type + optional top three + diary                                        | Phase 2         |
| D2  | Stored entity                       | Keep posts as the entry, link the review, add `portfolio_picks`                       | Phase 2         |
| D3  | Private diary entries               | Yes, "Public" or "Only me" per entry; private entries earn no points                  | Phase 2         |
| D4  | Label on reviews                    | "X's best chicken rice"; "#N" only for the top three; 5-dish minimum stays            | Phase 2         |
| D5  | Production flag until Phase 1 ships | Build production with the Food Portfolio off                                          | any store build |
| D6  | Reviews of private accounts         | Stay public; leave People here for non-followers                                      | Phase 3         |
| D7  | Board at launch size                | Ranks, top-ten message and weekly achievements once 20 eligible diners are on a board | Phase 3         |
| D8  | Dishes not in the catalog           | Typed dish name at a known stall, tagged with a food type, pending review             | Phase 4         |
| D9  | Composer naming                     | One "Add a dish" composer                                                             | Phase 2         |
| D10 | Release shape                       | Redesign first, then staged                                                           | all             |

---

## Phase 0. Unblock testing (owner action plus one small PR)

| Step | What                                                                                                                                                          | Issue         | Effort | Check                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | --------------------------------------------------------------------------------- |
| 0.1  | Bring staging up to production: the next `scripts/db/rehearse.sh` run does it automatically (step 0/6); before then preview builds lack the ranking functions | P1-1 (now P2) | S      | the three RPCs answer on staging; preview build shows the place picker and labels |
| 0.2  | Switch the Food Portfolio on in the end-to-end and render runs; fix the stale comment                                                                         | P1-7          | S      | `playwright.config.ts`, `scripts/test-render.mjs`; suites green                   |
| 0.3  | Add the acceptance scenario (three chicken rice, two laksa, one curry puff, change a favourite) as an end-to-end spec, expected to fail until Phase 2         | P1-7          | M      | spec fails for the right reasons                                                  |
| 0.4  | Decide D5 for any production build made before Phase 1                                                                                                        | P0-1          | S      | `eas.json` or EAS variable, owner's call                                          |

## Phase 1. Trust and integrity (closes P0-1, P1-2, P1-3)

One migration, one client PR. Nothing in this phase changes what the diner sees.

| Step | What                                                                                                                                                                                                                      | Issue      | Effort | Regression tests                                                                       | Rollout risk                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1.1  | `publish_post` server function in the shape of `submit_review`: checks the stored photo exists under the caller's folder, runs the photo safety check before publishing, sets the status                                  | P0-1       | M      | post with no file refused; blocked photo never publishes; double publish race scenario | low                                        |
| 1.2  | Revoke column UPDATE on `posts.like_count, save_count, share_count, comment_count, board_credit_points, published_at, status` and on `user_profiles.pinned_post_ids` from signed-in users; route share through a function | P0-1       | M      | direct updates refused (service harness); counters still move through triggers         | low; older development builds stop posting |
| 1.3  | Write `posts.review_id`; extend `submit_review` to create the linked entry in the same transaction when the switch is on                                                                                                  | P1-2, P1-3 | M      | fault after review commit; relaunch mid-flow; idempotent resume                        | medium: protected review path              |
| 1.4  | Editing a review updates the linked entry's stars and words; deleting either side asks about the other                                                                                                                    | P1-3       | S      | edit and delete on both sides                                                          | low                                        |
| 1.5  | Honest result state in the editor: "Review posted. Portfolio entry failed. Try again" with a retry that survives relaunch                                                                                                 | P1-2       | S      | render test for each outcome                                                           | low                                        |
| 1.6  | Confirm the photo safety function has its key on production (still on the owner's to-do list as of 2026-11-04; not checked in this audit)                                                                                 | P0-1       | S      | a known test image is blocked on staging                                               | none                                       |

Exit: a post cannot exist without a checked photo; a review and its entry are one write; no counter is
writable from the phone.

## Phase 2. The model the owner described (closes P1-4, P1-5; removes P2-2, P2-3, P2-4, P2-11, P3-4, P3-6)

| Step | What                                                                                                                                                                                                                | Effort | Notes                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| 2.1  | `portfolio_picks` table and `set_portfolio_pick` (one `INSERT .. ON CONFLICT DO UPDATE`); foreign key to posts with cascade; backfill the first three ranked posts as overall picks; stop writing `pinned_post_ids` | M      | race scenario: two picks for the same dish type at once |
| 2.2  | Read functions: a diner's bests by dish type, top picks, diary page; label function returns "best <dish type>"                                                                                                      | M      | one batched call per screen                             |
| 2.3  | Profile: **My bests**, **Top picks**, **Diary**; "Make this my best <dish type>" on any entry, naming what it replaces                                                                                              | L      | previous favourite stays in the diary                   |
| 2.4  | One "Add a dish" composer: dish and stall, photo, stars, optional tastes, the pick switch, "Public" or "Only me"                                                                                                    | L      | replaces the place picker and the 60/40 suggestion      |
| 2.5  | Labels on reviews, dish and stall pages: "X's best chicken rice"                                                                                                                                                    | S      | 5-dish minimum stays                                    |
| 2.6  | Private entries: `visibility = 'private'`, excluded from points, boards, feeds and labels                                                                                                                           | M      | privacy tests per surface                               |
| 2.7  | Drop `pinned_post_ids`, `rank_portfolio_post`, `get_my_portfolio_ranking` in a later migration once no build calls them                                                                                             | S      | after one release cycle                                 |

Exit: the acceptance scenario passes end to end, on web and on a device.

## Phase 3. Fair boards (closes P1-6, P2-1, P2-5, P2-8, P2-10, P3-2, P3-3)

| Step | What                                                                                                                                      | Effort |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 3.1  | Minimum population per board and week (D7) before ranks, the top-ten message and weekly achievements appear; personal points always shown | M      |
| 3.2  | Void achievement points when the events behind them are voided                                                                            | M      |
| 3.3  | Like, save and share credit per (person, post); unlike voids only its own credit                                                          | S      |
| 3.4  | Engagement counts only from accounts 7 days old; rating bonus only with a linked review                                                   | S      |
| 3.5  | Ties share a place and a podium height; weekly close catches up missed weeks                                                              | S      |
| 3.6  | One points currency: remove the local review score or pay it through the ledger; movement line names its board                            | S      |
| 3.7  | Rank cache keyed by viewer, reset on sign-out and after publishing                                                                        | S      |
| 3.8  | People here leaves out private accounts for non-followers (D6)                                                                            | S      |

## Phase 4. Supply, scale and polish

| Step | What                                                                                            | Issue      | Effort                                          |
| ---- | ----------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| 4.1  | Entries for dishes not in the catalog (D8)                                                      | P2-7       | M                                               |
| 4.2  | `reviews.dish_id` no longer cascades on dish delete                                             | P2-9       | S                                               |
| 4.3  | Board read by index order with keyset paging; incremental standings                             | P2-6       | M, only when a board passes about 10,000 diners |
| 4.4  | Digest window covers the previous 24 hours                                                      | P3-1       | S                                               |
| 4.5  | Maestro smoke for add a dish, change a favourite, open the board; VoiceOver and TalkBack pass   | P1-7       | M                                               |
| 4.6  | Refresh `AGENTS.md`; retire the Seoul preview check; point the `development` profile at staging | P3-8, P3-9 | S                                               |

---

## Release sequencing

| Stage           | Who                                        | Needs                                                     | Flags                                                      |
| --------------- | ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| A. Internal     | owner's devices, preview builds on staging | Phase 0                                                   | as today on staging                                        |
| B. Limited beta | invited testers                            | Phase 1 and Phase 2, device evidence from 4.5             | portfolio and reviews on; board shows personal points only |
| C. Public       | everyone                                   | Phase 3; production rehearsal and ship for each migration | boards open per D7                                         |
| D. Scale        |                                            | Phase 4.3 when numbers call for it                        |                                                            |

Not recommended: releasing everything together as built (P0-1 open, model mismatch), or releasing the
leaderboard before the portfolio model is settled (points would be paid on entries that are about to change shape).

## Order of work

1. Owner: decisions D1 to D10 (accepted as recommended on 2026-11-10); staging catches up at the next rehearsal.
2. Phase 0 PR (tests on, acceptance spec).
3. Phase 1: migration + client PR.
4. Phase 2: migration + two client PRs (profile, composer).
5. Device pass (4.5), then limited beta.
6. Phase 3, then public.

## Done means

- The acceptance scenario passes on web and on a device, including changing a favourite without losing the entry.
- No table behind these features is writable from the phone except through a server function.
- A review and its entry cannot disagree.
- Staging and production carry the same migrations.
- The board shows no rank, message or achievement that one person alone can earn.
