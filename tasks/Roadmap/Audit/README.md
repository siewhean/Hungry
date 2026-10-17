# Audit Directory

Files in this directory are evidence snapshots for a named scope and date. They may describe branches, features, risks or environments that have since changed.

## How to use an audit

1. Confirm the audit date, branch, commit and environment.
2. Compare its assumptions with current product policy and code.
3. Use `tasks/backlog.md` for active status.
4. Use `tasks/verification.md` for current pass/fail/blocked evidence.
5. Use the latest task-specific audit only after confirming it targets the current change line.

An old audit does not override current code, an approved product-policy change or a newer verified audit.

## Current global policy

Hungry has no guest mode. Supabase is mandatory for authentication and shared writes. The bundled Excel catalog is an authenticated read-only fallback for eligible catalog outages only. Audits containing guest/public mobile browsing or mock-first production assumptions are historical unless explicitly reconciled.

## File naming

Prefer:

```text
<scope>-audit-YYYY-MM-DD.md
```

Include branch/commit, scope, evidence, limitations, remaining blockers and a Go/Go Candidate/No-Go verdict. Store raw generated logs, screenshots, traces and scanner output as ignored local/CI artifacts; link or summarize only the evidence required for the audit record.
