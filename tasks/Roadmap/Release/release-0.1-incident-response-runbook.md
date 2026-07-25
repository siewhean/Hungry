# Hungry Release 0.1 — Incident Response and Rollback Runbook

## Severity

| Severity | Definition | Initial response target | Examples |
|---|---|---:|---|
| SEV-0 | Active security incident, credential exposure, destructive data loss, auth bypass | 15 minutes | service-role leak, cross-user private data access |
| SEV-1 | Core journey unavailable or unsafe for most users | 30 minutes | login outage, catalog unavailable with fallback broken, crash loop |
| SEV-2 | Major degradation with a safe workaround | 4 hours | one catalog source degraded, image service failure |
| SEV-3 | Minor defect or data-quality issue | 2 business days | isolated wrong price, cosmetic issue |

## Roles

| Role | Primary | Backup | Access verified |
|---|---|---|---:|
| Incident commander |  |  | ☐ |
| Release operator |  |  | ☐ |
| Supabase/database owner |  |  | ☐ |
| Mobile/EAS owner |  |  | ☐ |
| Catalog/data-quality owner |  |  | ☐ |
| Security/privacy owner |  |  | ☐ |
| User communications/support |  |  | ☐ |

## First 15 minutes

1. Open an incident issue using the release-incident form.
2. Record start time, implementation SHA, build/update IDs, catalog release ID and affected environments.
3. Stop rollout or pause distribution.
4. Protect evidence; do not paste secrets into chat or issues.
5. Decide whether to disable a feature, roll back catalog, roll back OTA, or replace the native binary.
6. Assign an incident commander and one communications owner.

## Containment paths

### Bad EAS Update

- pause rollout;
- republish the last known-good update compatible with the installed runtime;
- verify startup, auth and primary catalog journey;
- record update IDs and affected percentage.

### Bad native binary

- stop phased rollout where possible;
- remove the build from internal/beta availability when appropriate;
- create an expedited replacement build from the last known-good or fixed SHA;
- do not use OTA to patch native code, permissions or dependency changes.

### Bad catalog release

- switch the active release pointer to the last known-good release;
- keep the bad release immutable for investigation;
- quarantine offending IDs/media;
- verify three pages of dishes/stalls plus exact pilot records;
- confirm in-flight source-bound detail routes remain valid or fail safely.

### Authentication or session incident

- block new release rollout;
- revoke affected tokens/credentials;
- rotate secrets through owner-controlled stores;
- verify sign-out, revocation and invalid-session handling;
- inspect logs for cross-user access without exposing user data.

### Database migration incident

- stop further migrations;
- decide forward-fix versus restore with the database owner;
- preserve migration history and backups;
- never delete an applied migration to hide drift;
- rerun RLS, Advisor, catalog and account smokes.

### Unsafe or rights-restricted media

- remove from active projection or switch to neutral unavailable state;
- retain provenance and review record;
- do not replace it with generic Unsplash/placeholder imagery.

## Communications

Internal update template:

```text
Incident:
Severity:
Started:
Current impact:
Affected builds/releases:
Containment:
Next update by:
Owner:
```

External communication must be factual, approved by the incident/privacy owner, and avoid unsupported timelines.

## Recovery verification

Before closing:

- primary journey passes on affected platforms;
- auth and sign-out pass;
- healthy catalog and authenticated fallback pass;
- no-results remains correct;
- writes do not falsely succeed;
- monitoring is receiving new events;
- support has a user-facing resolution;
- root cause and preventive action are recorded.

## Post-incident review

Within two business days document:

- timeline;
- root cause;
- detection gap;
- user/data impact;
- containment and recovery;
- why existing gates did or did not catch it;
- tests, alerts and ownership changes;
- follow-up issues with deadlines.
