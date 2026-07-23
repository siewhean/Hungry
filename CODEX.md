# Codex Entrypoint — Hungry

1. Read `README.md` for the current repository map.
2. Read `AGENTS.md` for architecture, safety, code, documentation, and branch rules.
3. Read `WORKFLOW.md` for task, verification, and lifecycle governance.
4. Read `tasks/backlog.md` and the relevant portion of `tasks/verification.md`.
5. Use `ops/low-token-cheatsheet.md` for bounded repository reads when appropriate.

## Mandatory execution rules

- `tasks/backlog.md` is the active task contract.
- `tasks/verification.md` records exact pass, fail, skipped, and blocked evidence.
- `tasks/session-log.md` stores concise chronological history.
- Root docs are stable entrypoints; do not place volatile progress or blockers in `README.md`.
- Hungry has no guest mode. Main app surfaces require successful authentication.
- Supabase is mandatory for authentication and shared writes.
- Excel is an authenticated read-only catalog fallback only for eligible catalog outages.
- Do not expose mock providers or unfinished/disabled features in released builds.
- Do not claim skipped, credential-blocked, native-blocked, or failing checks passed.
- For vague or broad requests, resolve scope and acceptance criteria before destructive changes.
- Keep reads and diffs bounded, but provide full evidence when the user requests a broad audit.
