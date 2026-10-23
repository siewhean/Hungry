# Hungry Release 0.1 — Privacy and Account-Deletion Proof Matrix

> Legal text requires owner/legal approval. This file defines the technical and operational evidence needed before beta/public release.

## Public documents

| Document | Public URL | Matches actual behavior | Owner review | Legal review | Result |
|---|---|---:|---:|---:|---:|
| Privacy Policy |  | ☐ | ☐ | ☐ | |
| Terms of Use |  | ☐ | ☐ | ☐ | |
| Account Deletion |  | ☐ | ☐ | ☐ | |
| Support/Contact |  | ☐ | ☐ | n/a | |
| Community/UGC rules | Deferred unless UGC is enabled | ☐ | ☐ | ☐ | |

## Data inventory

| Data category | Collected | Purpose | Storage/provider | Retention | User control | Store disclosure verified |
|---|---:|---|---|---|---|---:|
| Email/auth identifiers | ☐ | Account/authentication | Supabase Auth |  | Delete/change through approved account flow | ☐ |
| Display name/avatar | ☐ | Profile | Supabase DB/Storage |  | Edit/delete | ☐ |
| Taste/dietary preferences | ☐ | Personalization | Supabase DB + provisional local state |  | Edit/delete | ☐ |
| Approximate/precise location | ☐ | Nearby discovery | In-memory/request only unless documented |  | Deny/change area | ☐ |
| Search interactions | ☐ | Search operation/aggregate analytics | Supabase/analytics |  | Privacy policy/settings | ☐ |
| Catalog issue reports | ☐ | Data quality/support | GitHub/support system |  | Redaction/removal request | ☐ |
| Crash/error diagnostics | ☐ | Reliability/security | Sentry |  | Privacy policy | ☐ |
| App interactions | ☐ | Release funnel | Analytics |  | Privacy policy/settings where applicable | ☐ |
| Reviews/posts/media | Deferred | n/a | Not enabled in Release 0.1 | n/a | n/a | ☐ |
| Favourites | Deferred | n/a | Not enabled in Release 0.1 | n/a | n/a | ☐ |

## Account deletion technical proof

| Step | Expected | Automated | iOS | Android | Evidence |
|---|---|---:|---:|---:|---|
| Entry point | Available from Settings without contacting support first | ☐ | ☐ | ☐ | |
| Reauthentication | Required when security policy needs it | ☐ | ☐ | ☐ | |
| Confirmation | Explains consequences and irreversible scope | ☐ | ☐ | ☐ | |
| Backend request | Authenticated server-side deletion path; no client service-role key | ☐ | ☐ | ☐ | |
| Profile/preferences | Deleted or anonymized per policy | ☐ | ☐ | ☐ | |
| Media/storage | Owned avatar and enabled user media deleted | ☐ | ☐ | ☐ | |
| Auth identity | Supabase Auth user removed or disabled according to policy | ☐ | ☐ | ☐ | |
| Sessions | Revoked and local secure state cleared | ☐ | ☐ | ☐ | |
| Analytics/crash identity | Deleted, anonymized or disconnected where supported/documented | ☐ | ☐ | ☐ | |
| Completion | User receives truthful completion state | ☐ | ☐ | ☐ | |
| Failure | Request remains recoverable; no false completion | ☐ | ☐ | ☐ | |
| Public fallback URL | Works outside the app | ☐ | ☐ | ☐ | |

## Privacy/security checks

- no service-role key in client bundle;
- auth tokens only in secure storage;
- analytics/error payload redaction tests;
- location denial does not block the app after authentication;
- no background location permission for Release 0.1;
- permissions match visible released features;
- account-deletion operation has audit logging without sensitive content;
- breach-response owner and contact path are documented;
- DPO/business contact requirements are reviewed for Singapore operations.

## Sign-off

| Role | Name | Date | Decision | Notes |
|---|---|---|---|---|
| Product owner |  |  |  | |
| Privacy/DPO owner |  |  |  | |
| Security owner |  |  |  | |
| Legal reviewer |  |  |  | |
| Release owner |  |  |  | |
