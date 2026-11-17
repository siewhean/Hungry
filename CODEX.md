# Codex Entrypoint

Read `README.md` before planning or coding.

Then read `AGENTS.md`, `WORKFLOW.md`, and `ops/low-token-cheatsheet.md` and follow their workflow, including keeping `README.md` updated whenever task context, progress, decisions, or blockers change.

## Mandatory execution workflow for Hungry

1. Treat `tasks/backlog.md` as the shared active task contract between Claude and Codex.
2. For non-trivial work, update scoped task rows in `tasks/backlog.md` before implementation.
3. Update canonical task status frequently (at least once per focused work block, and always before ending a session).
4. Do not mark tasks done without recording verification in `tasks/verification.md`.
5. Append a concise entry in `tasks/session-log.md` with date, actor, status, blockers, and next step.
6. For vague, broad, or multi-step Hungry requests, route through `hungry-intent-router` first.
7. Default to low-token mode: bounded reads, bounded outputs, and delta-only reporting unless the user explicitly asks for a broad summary.
