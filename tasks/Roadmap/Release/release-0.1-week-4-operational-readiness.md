# Hungry Release 0.1 — Week 4 Stability and Operational Readiness

> Status: Prepared, not executed. Week 4 begins only after Week 3 core-flow exit criteria pass.

## Outcome

Hungry can be operated safely by a small team. The release has monitoring, support ownership, incident response, privacy/account-deletion proof, rollback procedures and a repeatable internal-alpha release process.

## Workstreams

### 4.1 Crash and error observability

- Sentry staging and production projects are distinct.
- Every event carries app version, build number, implementation SHA, EAS build/update ID and environment.
- Source maps upload successfully.
- A controlled staging error resolves to a readable source location.
- Error payloads exclude access tokens, passwords, verification codes, raw precise location, email and uploaded media content.
- Catalog errors include privacy-safe source/release/error-kind fields.

### 4.2 Core funnel analytics

Instrument only the minimum Release 0.1 funnel:

```text
auth_started
auth_completed
catalog_load_started
catalog_load_completed
catalog_fallback_used
search_submitted
search_no_results
dish_detail_opened
stall_detail_opened
directions_opened
account_deletion_started
account_deletion_completed
support_opened
```

Raw search text, exact coordinates and personal identifiers must not be included in analytics payloads.

### 4.3 Support and issue ownership

Assign named owners for:

- release decision;
- support inbox;
- catalog/data quality;
- security/privacy incident;
- Supabase operations;
- EAS/App Store/Play Store operations;
- rollback execution.

At least two people must be able to access critical owner accounts or a documented emergency recovery path must exist.

### 4.4 Privacy and account deletion

Prove:

- privacy policy accurately lists Supabase, Sentry, analytics, email, storage and location behavior;
- terms and community rules match enabled features;
- account deletion can be initiated in app;
- deletion removes or anonymizes account-linked data according to documented policy;
- deletion handles profile, preferences, favourites if enabled, reviews/posts if later enabled, media, logs and analytics identifiers;
- retention exceptions are documented;
- deletion completion and failure are visible to the user;
- support fallback exists.

### 4.5 Rollback readiness

Document and rehearse:

- rollback to previous EAS Update;
- replacement native build when rollback cannot fix native changes;
- catalog active-release pointer rollback;
- migration forward-fix/restore decision;
- feature-flag kill switch;
- account/auth incident response;
- bad image or data release quarantine.

### 4.6 Release runbook

For every internal-alpha build record:

- implementation SHA;
- evidence SHA;
- EAS build ID;
- iOS/Android version and build number;
- catalog release ID;
- migration state;
- feature flags;
- test results;
- known limitations;
- rollback target.

## Required tests

- controlled Sentry staging error;
- source-map resolution;
- analytics event schema tests;
- PII/log redaction tests;
- account-deletion happy path and failure path;
- support links;
- catalog rollback rehearsal;
- OTA rollback rehearsal;
- native replacement-build dry run;
- incident tabletop exercise.

## Exit criteria

Week 4 passes only when:

- crash monitoring and source maps are proven on final artifacts;
- privacy-safe funnel events are visible;
- support and incident owners are assigned;
- account deletion is proven end to end;
- privacy/terms/support URLs are live and accurate;
- OTA, catalog and feature-flag rollback paths are rehearsed;
- no P0 operational or privacy issue remains;
- every evidence item points to the same final implementation SHA.

## Week 4 QA/QC audit

| Area | Preparation status | Execution status |
|---|---:|---:|
| Monitoring event catalog | Complete | Pending implementation verification |
| Incident response runbook | Complete | Pending tabletop |
| Privacy/deletion proof matrix | Complete | Pending legal/owner and live proof |
| Rollback procedures | Defined | Pending rehearsal |
| Support ownership | Template ready | Pending names/access proof |
| Production readiness | Not claimable | No-Go until exit criteria pass |

## Blockers to minimize before Week 5

- unresolved P0/P1 Week 3 defects;
- no final iOS/Android artifact;
- missing Sentry/source-map evidence;
- missing legal/privacy owner sign-off;
- missing account-deletion proof;
- unassigned operational owners.
