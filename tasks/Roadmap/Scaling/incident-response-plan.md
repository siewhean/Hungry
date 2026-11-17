# Incident Response Plan

Date: 2026-06-07

## Severity Levels

| Severity | Definition | Response |
| --- | --- | --- |
| SEV-1 | Data exposure, account takeover, payment/security risk, widespread outage | Immediate triage, stop risky deploys, owner escalation |
| SEV-2 | Major flow broken for many users or merchants | Triage within 30 minutes, rollback/flag disable if possible |
| SEV-3 | Degraded performance or isolated functional issue | Triage same day, patch or schedule fix |
| SEV-4 | Cosmetic/documentation/low-impact issue | Backlog and batch |

## First 15 Minutes

1. Assign incident lead.
2. Freeze unrelated deploys and migrations.
3. Capture user impact, affected versions, and first-seen time.
4. Check Sentry, Vercel, Supabase logs, and recent commits.
5. Decide rollback, feature flag disable, or hotfix.

## Data/Security Incidents

- Revoke exposed tokens or keys.
- Disable affected routes or Edge Functions if needed.
- Preserve logs and audit records.
- Notify legal/privacy owner before external communications.
- Avoid broad database writes until root cause is known.

## Communication

- Internal status every 30 minutes during SEV-1/SEV-2.
- User-facing update only after facts are confirmed.
- Postmortem due within 3 business days for SEV-1/SEV-2.

## Postmortem Template

- Summary
- Timeline
- Impact
- Root cause
- What went well
- What failed
- Corrective actions
- Owners and deadlines
