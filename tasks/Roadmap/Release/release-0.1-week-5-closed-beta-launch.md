# Hungry Release 0.1 — Week 5 Closed-Beta Launch

> Status: Prepared, not launched. Closed beta starts only after Week 3–4 exit criteria and final-head iOS/Android internal-alpha acceptance pass.

## Outcome

Launch a controlled private beta with target users in the validated Jurong East pilot area. The objective is to validate the core food-decision journey and catalog trust—not to maximize downloads or test deferred features.

## Cohort

Recommended initial cohort:

- 20–30 invited users;
- at least 10 iOS and 10 Android participants where feasible;
- mix of Jurong East residents, workers, students and regular visitors;
- at least two accessibility testers;
- exclude project developers from the primary success-rate denominator.

If Google Play account rules require a minimum closed-test cohort/duration, confirm the requirement in the owner’s Play Console and recruit above the minimum to tolerate dropouts.

## Entry gates

- Week 3 core journey passes;
- Week 4 monitoring/privacy/rollback gates pass;
- final-head TestFlight and Play internal/closed artifacts installed;
- staging/production data environment is explicitly selected;
- catalog release and exact pilot manifest pass;
- support inbox and issue forms are monitored;
- known limitations are documented;
- no P0/P1 defect is open.

## Tester mission

Each tester must complete these tasks without live coaching:

1. install the beta build;
2. complete onboarding and create/sign into an account;
3. allow or deny location, then use Jurong East;
4. find one named dish through Discover;
5. find another dish through Search;
6. browse at least two pages of dishes or stalls;
7. open dish and stall/menu details;
8. open directions when valid;
9. force-quit and restore the session;
10. submit one structured app or catalog report;
11. sign out and confirm protected content is no longer accessible.

A subset of approved testers should execute authenticated Excel-fallback scenarios using a controlled catalog outage.

## Distribution

### iOS

- upload final-head build to TestFlight;
- provide accurate “What to Test” instructions;
- provide review/demo credentials through App Store Connect, never in repository docs;
- separate internal and external tester groups;
- record build ID, source SHA, expiration and tester group.

### Android

- upload final-head App Bundle to the appropriate closed-testing track;
- configure tester list/group and app-access instructions;
- verify Data Safety, privacy URL and account-deletion URL drafts;
- record version code, source SHA, track and tester group.

## Feedback channels

- Beta app defect issue form;
- Catalog/data-quality issue form;
- Beta session report form;
- owned support contact for account/deletion/privacy issues.

Do not accept passwords, verification codes, tokens or private user content in reports.

## Daily cadence

1. Review crash/ANR/auth/catalog dashboards.
2. Triage new reports before accepting new scope.
3. Confirm P0/P1 ownership and response target.
4. Verify any catalog correction against Supabase and Excel source policy.
5. Publish no more than one controlled beta build/update per day unless an incident requires it.
6. Post a concise tester update when a new build is available.

## Week 5 measurements

- invited, installed and active testers;
- first-session activation rate;
- primary journey completion rate;
- catalog load success and fallback rate;
- search-to-detail conversion;
- directions-open rate;
- crash-free sessions;
- auth failure rate;
- P0/P1 reports per 100 sessions;
- confirmed catalog issues and median resolution time.

## Exit criteria

Week 5 passes when:

- at least 20 invited testers and the approved minimum active cohort are available;
- at least 15 non-developer testers complete the primary journey;
- iOS and Android are both represented;
- no unresolved P0 exists;
- every P1 has an owner and resolution plan;
- at least one beta build has been updated from real tester feedback;
- support and catalog issue workflows are operating;
- beta metrics are recorded against one implementation SHA/build pair.

## Week 5 QA/QC audit

| Area | Preparation | Execution |
|---|---:|---:|
| Tester mission and guide | Complete | Pending distribution |
| Cohort register | Ready | Pending participants |
| Feedback forms | Complete | Pending use |
| Distribution checklists | Defined | Pending store access |
| Metrics | Defined | Pending live sessions |
| Production readiness | Not claimable | Closed-beta only after gates pass |

## Stop conditions

Pause the beta when:

- auth bypass, cross-user access or credential exposure is suspected;
- crash loop or startup failure blocks the core journey;
- catalog data is unsafe or materially misleading;
- account deletion or privacy controls fail;
- incident response or rollback ownership is unavailable.
