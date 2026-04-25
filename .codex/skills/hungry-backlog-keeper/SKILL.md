---
name: hungry-backlog-keeper
description: Check whether Hungry work is actually done and update the project tracking files to match the real state. Use this when you want to verify task status, fix outdated backlog rows, sync evidence after implementation, or close a small batch of work without re-auditing the whole project.
---

# Hungry Backlog Keeper

Use this skill when you need a simple answer to: what is done, what is not done, and which tracking files need updating.

## Workflow

1. Read `tasks/backlog.md` first. Treat it as the canonical active task surface.
2. Read `tasks/verification.md` if the task claims command or QA completion.
3. Read `tasks/session-log.md` only after the canonical row is correct.
4. Verify the code or docs for the exact task IDs requested.
5. Patch only the stale rows or evidence.
6. Append a concise session-log entry if work changed state.

## Rules

- Never use `tasks/todo.md` as the live status source when the task already exists in `tasks/backlog.md`.
- Do not restate task status in multiple places before updating the canonical row.
- Prefer bounded audits by task ID.
- Report status as `Open`, `In Progress`, `Blocked`, `Done`, or `Optional` only.
- If verification is missing, the task is not done.

## Output

Return only:
- task IDs checked
- current status
- evidence
- docs updated
- residual risk

## References

- Read `references/status-surfaces.md` for the exact file responsibilities.
