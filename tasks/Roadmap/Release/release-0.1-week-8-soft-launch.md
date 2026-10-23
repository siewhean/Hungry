# Hungry Release 0.1 — Week 8 Soft Launch

> Status: Prepared, not launched. Soft launch requires a signed Go decision for the Week 7 Release Candidate.

## Outcome

Release Hungry to a deliberately small Singapore pilot audience, monitor real-world reliability and catalog trust, and prove that the team can support, correct and roll back the product before wider promotion.

## Launch scope

- Jurong East and only other areas that pass the same catalog validation gate;
- approximately 50–200 invited/organic users initially;
- no broad paid campaign;
- no advanced features beyond the frozen Release 0.1 scope;
- one implementation SHA and one approved catalog release at launch.

## Rollout strategy

### Day 0

- confirm final Go decision and rollback owners;
- submit/release approved store artifacts;
- enable the smallest supported rollout/cohort;
- verify startup, auth, catalog, detail, account deletion and monitoring using production accounts;
- post internal launch status.

### Controlled expansion

Expand only when the previous cohort is healthy:

1. internal/review users;
2. first 25–50 pilot users;
3. approximately 100 users;
4. approximately 200 users;
5. hold for seven healthy days before deciding on broader growth.

Use store phased rollout capabilities where available for updates. Pause immediately when a stop condition triggers.

## Launch dashboard

Monitor at least:

- startup success;
- crash-free sessions and ANRs;
- auth success/failure;
- catalog request success and fallback rate;
- search no-results anomalies;
- exact pilot record/image failures;
- detail and directions events;
- account-deletion failures;
- support volume and severity;
- confirmed catalog defects and resolution time.

## Stop/pause conditions

Pause rollout and use the incident runbook when:

- a P0 issue is reported or detected;
- crash-free sessions fall below the approved threshold;
- startup or auth materially fails;
- authenticated fallback is unavailable during a catalog outage;
- signed-out/invalid users retain protected or Excel access;
- unsafe, incorrect or rights-restricted content is shown broadly;
- account deletion fails or falsely reports completion;
- monitoring, support or rollback ownership is unavailable;
- evidence/artifact/catalog SHA identity is uncertain.

## Daily operating cadence

### Morning

- check Sentry, store vitals and core funnel;
- review Supabase health, Advisor alerts and catalog diagnostics;
- review new support and data-quality reports;
- confirm rollout percentage/cohort.

### Midday

- triage and assign every P0/P1;
- validate catalog corrections and rights/provenance;
- decide whether a build/update/catalog release is needed.

### End of day

- publish a concise status;
- record metrics, incidents, fixes and known limitations;
- confirm rollback targets remain available;
- set the next day’s rollout decision.

## User support

- one owned support inbox/contact;
- response templates for login, data correction, privacy/deletion and outages;
- catalog reports retain source/release/entity context;
- no credentials or private data requested in tickets;
- deletion/privacy requests routed to the responsible owner.

## Catalog operations

- all corrections go through source/provenance review;
- no direct silent production edits outside the approved process;
- bad releases remain immutable for audit and can be retired/reverted;
- active release totals, checksum and quality findings are recorded;
- initial Discover and pilot records are sampled daily during soft launch.

## Exit criteria

Week 8 passes when:

- the soft launch has operated for at least seven healthy days;
- no unresolved P0 exists;
- no unowned P1 exists;
- reliability and catalog trust remain above approved thresholds;
- support volume is manageable;
- account deletion and privacy operations function in production;
- at least one production issue/data correction has been handled through the documented workflow or a tabletop substitute is completed;
- rollback targets remain verified;
- the owner records a decision to hold, iterate, or expand.

## Week 8 QA/QC audit

| Area | Preparation | Execution |
|---|---:|---:|
| Rollout sequence | Complete | Pending stores/Go decision |
| Daily dashboard | Complete | Pending production data |
| Pause thresholds | Defined | Pending owner approval |
| Support/catalog operations | Defined | Pending staffing/live use |
| Rollback/incident integration | Complete | Pending production rehearsal |
| Production readiness | Not claimable | GO only after Week 7 and live Week 8 evidence |

## Expansion decision

Do not expand geography, marketing, merchant features or social scope merely because the app is publicly available. Expansion requires evidence that the core dish-decision promise is reliable, trusted and operationally sustainable.
