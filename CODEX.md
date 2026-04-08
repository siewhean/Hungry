# Codex Entrypoint

Read `README.md` before planning or coding.

Then read `AGENTS.md` and follow its workflow, including keeping `README.md` updated whenever task context, progress, decisions, or blockers change.

## Mandatory execution workflow for Hungry

1. Treat `tasks/todo.md` as the shared task contract between Claude and Codex.
2. For non-trivial work, write/update a scoped plan in `tasks/todo.md` before implementation.
3. Update checklist status frequently (at least once per focused work block, and always before ending a session).
4. Do not mark tasks done without recording a verification step.
5. Append a concise entry in the shared session log section of `tasks/todo.md` with date, actor, status, blockers, and next step.
